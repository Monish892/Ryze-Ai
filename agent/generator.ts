import { 
  UIPlan, 
  validateUIPlanStrict, 
  isValidComponent, 
  LayoutNode, 
  ComponentNode,
  validateComponentNameStrict,
  validatePropsStrict,
  validateNodeStructureStrict,
  FORBIDDEN_PROPS,
} from './schema';

// ============================================================================
// CODE GENERATION SYSTEM PROMPT
// ============================================================================

const GENERATOR_SYSTEM_PROMPT = `You are a strict React JSX code generator.

RULES (ENFORCED):

1. Generate ONLY valid React TSX code
2. Import ONLY allowed components from '@/components/system'
3. NO inline styles (all styling is in components)
4. NO className prop
5. NO style prop
6. NO CSS generation
7. NO Tailwind classes
8. NO external libraries
9. NO eval, Function, or dynamic imports

Layout Components:
- ColumnLayout({ gap?, padding?, children })
- RowLayout({ gap?, padding?, children })
- GridLayout({ columns?, gap?, padding?, children })

UI Components:
- Button, Card, Input, Table, Modal, Sidebar, Navbar, Chart

Code must:
- Import components from '@/components/system'
- Use layout components for positioning (not raw divs)
- Pass only safe props
- Handle state for interactive components
- Export as default function`;

// ============================================================================
// GENERATOR FUNCTION
// ============================================================================

export async function generateCode(
  plan: UIPlan,
  previousPlan?: UIPlan,
  apiKey?: string
): Promise<{ code?: string; error?: string }> {
  try {
    // STRICT: Validate plan with all checks
    const validation = validateUIPlanStrict(plan);
    if (!validation.valid) {
      return { error: `PLAN_VALIDATION_ERROR: ${validation.error}` };
    }

    if (!validation.data) {
      return { error: 'Plan validation succeeded but no data returned' };
    }

    // STRICT: Validate node structure before code generation
    try {
      validateNodeStructureStrict(validation.data.root);
    } catch (error) {
      return { error: `NODE_VALIDATION_ERROR: ${String(error)}` };
    }

    // Generate code
    const code = generateJSXFromPlan(validation.data, previousPlan);

    // Validate generated code
    if (!code || typeof code !== 'string' || code.length < 50) {
      return { error: 'CODE_GENERATION_FAILED: Generated code is invalid or too short' };
    }

    return { code };
  } catch (error) {
    return { error: `GENERATION_ERROR: ${String(error)}` };
  }
}

/**
 * Generate JSX string from UIPlan
 * Validates no style/className is used
 */
export function generateJSXFromPlan(plan: UIPlan, previousPlan?: UIPlan): string {
  // Determine what components to import
  const usedComponents = extractUsedComponents(plan.root);

  // Build imports
  const componentList = Array.from(usedComponents).sort().join(', ');
  const imports = componentList
    ? `import { ${componentList} } from '@/components/system';`
    : '';

  // Generate JSX
  const jsxContent = nodeToJSX(plan.root, 0);

  // Wrap in component
  const fullCode = `'use client';

import React, { useState } from 'react';
${imports}

export default function GeneratedUI() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
${jsxContent}
  );
}`;

  return fullCode;
}

/**
 * Convert a node (layout or component) to JSX string
 * STRICT: Validates component, props, and structure
 */
function nodeToJSX(node: LayoutNode | ComponentNode, depth: number): string {
  const indent = '    ' + '  '.repeat(depth);

  // STRICT: Validate component name
  try {
    validateComponentNameStrict(node.component);
  } catch (error) {
    throw new Error(`${String(error)} at node ${node.id}`);
  }

  // STRICT: Validate forbidden props
  try {
    validatePropsStrict(node.props || {}, node.component);
  } catch (error) {
    throw new Error(`${String(error)} at node ${node.id}`);
  }

  // STRICT: NO FALLBACK DIVS - Only whitelisted components
  if (!isValidComponent(node.component)) {
    throw new Error(`COMPONENT_NOT_WHITELISTED: ${node.component} at ${node.id}`);
  }

  // Build props
  const propsArray = buildPropsArray(node.props || {});
  const propsStr = propsArray.length > 0 ? ' ' + propsArray.join(' ') : '';

  // Handle children
  if (!('children' in node) || !node.children || node.children.length === 0) {
    // Self-closing tag
    return `${indent}<${node.component}${propsStr} />`;
  }

  // Has children
  const childrenJSX = node.children
    .map((child: any) => nodeToJSX(child, depth + 1))
    .join('\n');

  return `${indent}<${node.component}${propsStr}>\n${childrenJSX}\n${indent}</${node.component}>`;
}

/**
 * Build JSX props array from props object
 */
function buildPropsArray(props: Record<string, any>): string[] {
  const result: string[] = [];

  for (const [key, value] of Object.entries(props)) {
    // Skip undefined/null
    if (value === undefined || value === null) continue;

    // Skip forbidden props
    if (key === 'style' || key === 'className') {
      throw new Error(`Forbidden prop: ${key}`);
    }

    // Handle different value types
    if (typeof value === 'string') {
      result.push(`${key}="${escapeString(value)}"`);
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      result.push(`${key}={${value}}`);
    } else if (Array.isArray(value)) {
      result.push(`${key}={${JSON.stringify(value)}}`);
    } else if (typeof value === 'object') {
      result.push(`${key}={${JSON.stringify(value)}}`);
    }
  }

  return result;
}

/**
 * Escape string for JSX attribute
 */
function escapeString(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

/**
 * Extract all component names used in the tree
 */
function extractUsedComponents(node: LayoutNode | ComponentNode): Set<string> {
  const components = new Set<string>();

  function traverse(n: any) {
    if (isValidComponent(n.component)) {
      components.add(n.component);
    }
    if ('children' in n && n.children) {
      n.children.forEach((child: any) => traverse(child));
    }
  }

  traverse(node);
  return components;
}
