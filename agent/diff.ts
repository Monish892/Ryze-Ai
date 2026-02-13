import { UIPlan, ComponentNode, LayoutNode } from './schema';

// ============================================================================
// DIFF & PATCH LOGIC - DETERMINISTIC INCREMENTAL UPDATES
// ============================================================================

export interface NodeDiff {
  type: 'added' | 'removed' | 'updated' | 'unchanged';
  nodeId: string;
  component: string;
  oldProps?: Record<string, any>;
  newProps?: Record<string, any>;
  children?: NodeDiff[];
}

export interface PlanDiff {
  modificationType: 'create' | 'edit' | 'regenerate';
  changedNodeIds: Set<string>;
  diffs: Map<string, NodeDiff>;
}

/**
 * Compare two plans and generate a diff
 * Returns minimal set of changes needed
 */
export function diffPlans(
  previousPlan: UIPlan | undefined,
  currentPlan: UIPlan
): PlanDiff {
  // If regenerate mode, all nodes are changed
  if (currentPlan.modificationType === 'regenerate') {
    return {
      modificationType: 'regenerate',
      changedNodeIds: new Set(getAllNodeIds(currentPlan.root)),
      diffs: new Map(),
    };
  }

  // If no previous plan, all nodes are added (create mode)
  if (!previousPlan) {
    const nodeIds = getAllNodeIds(currentPlan.root);
    const diffs = new Map<string, NodeDiff>();
    
    flattenNode(currentPlan.root).forEach((node) => {
      diffs.set(node.id, {
        type: 'added',
        nodeId: node.id,
        component: node.component,
        newProps: 'props' in node ? node.props : undefined,
      });
    });

    return {
      modificationType: 'create',
      changedNodeIds: new Set(nodeIds),
      diffs,
    };
  }

  // Diff mode: compare and identify changes
  const previousNodes = new Map<string, any>(
    flattenNode(previousPlan.root).map(n => [n.id, n])
  );
  const currentNodes = new Map<string, any>(
    flattenNode(currentPlan.root).map(n => [n.id, n])
  );

  const diffs = new Map<string, NodeDiff>();
  const changedNodeIds = new Set<string>();

  // Check for removed and updated nodes
  previousNodes.forEach((prevNode, id) => {
    const currNode = currentNodes.get(id);

    if (!currNode) {
      // Node was removed
      diffs.set(id, {
        type: 'removed',
        nodeId: id,
        component: prevNode.component,
        oldProps: 'props' in prevNode ? prevNode.props : undefined,
      });
      changedNodeIds.add(id);
    } else if (JSON.stringify(prevNode.props) !== JSON.stringify(currNode.props)) {
      // Node props were updated
      diffs.set(id, {
        type: 'updated',
        nodeId: id,
        component: currNode.component,
        oldProps: 'props' in prevNode ? prevNode.props : undefined,
        newProps: 'props' in currNode ? currNode.props : undefined,
      });
      changedNodeIds.add(id);
    } else {
      diffs.set(id, {
        type: 'unchanged',
        nodeId: id,
        component: currNode.component,
        newProps: 'props' in currNode ? currNode.props : undefined,
      });
    }
  });

  // Check for added nodes
  currentNodes.forEach((currNode, id) => {
    if (!previousNodes.has(id)) {
      diffs.set(id, {
        type: 'added',
        nodeId: id,
        component: currNode.component,
        newProps: 'props' in currNode ? currNode.props : undefined,
      });
      changedNodeIds.add(id);
    }
  });

  return {
    modificationType: 'edit',
    changedNodeIds,
    diffs,
  };
}

/**
 * Get all node IDs in a tree (flattened)
 */
export function getAllNodeIds(node: LayoutNode | ComponentNode): string[] {
  const ids: string[] = [node.id];
  
  if ('children' in node && node.children) {
    node.children.forEach((child: any) => {
      ids.push(...getAllNodeIds(child));
    });
  }

  return ids;
}

/**
 * Flatten tree into array of nodes
 */
export function flattenNode(node: LayoutNode | ComponentNode): Array<LayoutNode | ComponentNode> {
  const result: Array<LayoutNode | ComponentNode> = [node];
  
  if ('children' in node && node.children) {
    node.children.forEach((child: any) => {
      result.push(...flattenNode(child));
    });
  }

  return result;
}

/**
 * Get only the changed nodes from diff result
 */
export function getChangedNodes(diff: PlanDiff): NodeDiff[] {
  return Array.from(diff.diffs.values()).filter(
    (d) => d.type !== 'unchanged'
  );
}

/**
 * Check if a node was changed in the diff
 */
export function isNodeChanged(nodeId: string, diff: PlanDiff): boolean {
  return diff.changedNodeIds.has(nodeId);
}

/**
 * Generate human-readable summary of changes
 */
export function summarizeDiff(diff: PlanDiff): string {
  const added = Array.from(diff.diffs.values()).filter(d => d.type === 'added');
  const removed = Array.from(diff.diffs.values()).filter(d => d.type === 'removed');
  const updated = Array.from(diff.diffs.values()).filter(d => d.type === 'updated');

  const parts: string[] = [];

  if (diff.modificationType === 'create') {
    parts.push(`Created UI with ${diff.diffs.size} components`);
  } else if (diff.modificationType === 'regenerate') {
    parts.push(`Regenerated UI (${diff.diffs.size} total components)`);
  } else {
    if (added.length > 0) {
      parts.push(`Added ${added.length} component${added.length > 1 ? 's' : ''}`);
    }
    if (removed.length > 0) {
      parts.push(`Removed ${removed.length} component${removed.length > 1 ? 's' : ''}`);
    }
    if (updated.length > 0) {
      parts.push(`Updated ${updated.length} component${updated.length > 1 ? 's' : ''}`);
    }
  }

  return parts.length > 0 ? parts.join(', ') : 'No changes';
}
