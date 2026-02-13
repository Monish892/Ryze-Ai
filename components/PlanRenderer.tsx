'use client';

import React from 'react';
import { UIPlan, ComponentNode, LayoutNode } from '@/agent/schema';
import { ALLOWED_COMPONENTS } from '@/components/system';

/**
 * Safe Plan-to-React Renderer
 * Converts validated UIPlan to actual React components
 * 
 * SECURITY:
 * - Only renders whitelisted components
 * - No eval, Function, or dynamic code execution
 * - No dangerouslySetInnerHTML
 * - No style or className props
 * - Throws on invalid component or props
 */

export function renderNode(node: LayoutNode | ComponentNode): React.ReactNode {
  if (!node) {
    throw new Error('Node cannot be null or undefined');
  }

  // Validate component exists in whitelist
  const ComponentToRender =
    ALLOWED_COMPONENTS[node.component as keyof typeof ALLOWED_COMPONENTS];

  if (!ComponentToRender) {
    throw new Error(
      `COMPONENT_NOT_WHITELISTED: ${node.component} is not an allowed component`
    );
  }

  // Validate no forbidden props
  const props = node.props || {};
  if ('style' in props) {
    throw new Error(
      `FORBIDDEN_PROP: "style" not allowed in ${node.component}`
    );
  }
  if ('className' in props) {
    throw new Error(
      `FORBIDDEN_PROP: "className" not allowed in ${node.component}`
    );
  }
  if ('css' in props) {
    throw new Error(
      `FORBIDDEN_PROP: "css" not allowed in ${node.component}`
    );
  }
  if ('dangerouslySetInnerHTML' in props) {
    throw new Error(
      `FORBIDDEN_PROP: "dangerouslySetInnerHTML" not allowed in ${node.component}`
    );
  }

  // Render children recursively
  const children = ('children' in node && node.children)
    ? node.children.map((child: LayoutNode | ComponentNode, idx: number) => (
        <React.Fragment key={child.id || idx}>
          {renderNode(child)}
        </React.Fragment>
      ))
    : undefined;

  // Return React element
  return React.createElement(ComponentToRender as any, props, children);
}

export function PlanRenderer({ plan }: { plan: UIPlan }) {
  if (!plan || !plan.root) {
    return (
      <div style={{ padding: '16px', color: '#9ca3af' }}>
        No plan available
      </div>
    );
  }

  try {
    return <>{renderNode(plan.root)}</>;
  } catch (error) {
    throw error;
  }
}
