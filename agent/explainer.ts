import { UIPlan } from './schema';

const EXPLAINER_SYSTEM_PROMPT = `You are a UI explainer that provides clear, structured explanations of UI plans.

Your job is to explain:
1. Layout structure and reasoning
2. Component selection reasoning
3. What changed (if edit mode)
4. Why changes were made
5. Tradeoffs

Format: Plain English, reference components by ID, be concise.`;

export async function explainPlan(
  currentPlan: UIPlan,
  previousPlan?: UIPlan,
  apiKey?: string
): Promise<{ explanation?: string; error?: string }> {
  try {
    const explanation = generateExplanation(currentPlan, previousPlan);
    return { explanation };
  } catch (error) {
    return { error: String(error) };
  }
}

export function generateExplanation(currentPlan: UIPlan, previousPlan?: UIPlan): string {
  const sections: string[] = [];

  // Layout Reasoning
  sections.push(describeLayout(currentPlan.root));

  // Component Selection
  sections.push(describeComponents(currentPlan.root));

  // Changes (if edit mode)
  if (previousPlan && currentPlan.modificationType === 'edit') {
    const changes = diffPlans(previousPlan, currentPlan);
    if (changes) {
      sections.push(changes);
    }
  }

  // Tradeoffs
  sections.push(describeTradeoffs(currentPlan));

  return sections.filter(Boolean).join('\n\n');
}

function describeLayout(layout: any): string {
  const layoutComponent = layout.component || 'ColumnLayout';
  const componentCount = countComponents(layout);

  let description = '';
  
  if (layoutComponent === 'ColumnLayout') {
    description = `The layout uses a vertical column structure, stacking components from top to bottom.`;
  } else if (layoutComponent === 'RowLayout') {
    description = `The layout uses a horizontal row structure, placing components side-by-side.`;
  } else if (layoutComponent === 'GridLayout') {
    description = `The layout uses a responsive grid structure, automatically adapting to available space.`;
  }

  description += ` The layout contains ${componentCount} components arranged hierarchically.`;

  return `**Layout Structure:**\n${description}`;
}

function describeComponents(node: any, components: Map<string, any> = new Map()): string {
  if (node.component) {
    components.set(node.id, node);
  }
  if (node.children?.length) {
    node.children.forEach((child: any) => describeComponents(child, components));
  }

  const componentDescriptions = Array.from(components.values())
    .map((comp) => `- **${comp.id}** (${comp.component}): ${describeComponentPurpose(comp)}`)
    .join('\n');

  return `**Components Used:**\n${componentDescriptions}`;
}

function describeComponentPurpose(component: any): string {
  const comp = component.component;
  const props = component.props || {};

  switch (comp) {
    case 'Button':
      return `Interactive button${props.label ? ` labeled "${props.label}"` : ''}`;
    case 'Card':
      return `Container card${props.title ? ` with title "${props.title}"` : ''}`;
    case 'Input':
      return `Text input${props.label ? ` for "${props.label}"` : ''}`;
    case 'Table':
      return `Data table displaying structured information`;
    case 'Modal':
      return `Modal dialog${props.title ? ` titled "${props.title}"` : ''}`;
    case 'Sidebar':
      return `Navigation sidebar`;
    case 'Navbar':
      return `Top navigation bar${props.title ? ` titled "${props.title}"` : ''}`;
    case 'Chart':
      return `Data visualization${props.title ? ` showing "${props.title}"` : ''}`;
    default:
      return `Component for displaying content`;
  }
}

function countComponents(node: any): number {
  let count = 0;
  
  if (node.component) {
    count++;
  }
  
  if (node.children?.length) {
    node.children.forEach((child: any) => {
      count += countComponents(child);
    });
  }

  return count;
}

function diffPlans(previousPlan: UIPlan, currentPlan: UIPlan): string {
  const previousComponents = new Map<string, any>();
  const currentComponents = new Map<string, any>();

  collectComponents(previousPlan.root, previousComponents);
  collectComponents(currentPlan.root, currentComponents);

  const added: string[] = [];
  const removed: string[] = [];
  const modified: string[] = [];

  // Find added and modified
  currentComponents.forEach((comp, id) => {
    if (!previousComponents.has(id)) {
      added.push(id);
    } else {
      const prevComp = previousComponents.get(id)!;
      if (JSON.stringify(prevComp.props) !== JSON.stringify(comp.props)) {
        modified.push(id);
      }
    }
  });

  // Find removed
  previousComponents.forEach((comp, id) => {
    if (!currentComponents.has(id)) {
      removed.push(id);
    }
  });

  if (added.length === 0 && removed.length === 0 && modified.length === 0) {
    return '';
  }

  let changes = '**Changes:**\n';
  
  if (added.length > 0) {
    changes += `- Added: ${added.join(', ')}\n`;
  }
  if (removed.length > 0) {
    changes += `- Removed: ${removed.join(', ')}\n`;
  }
  if (modified.length > 0) {
    changes += `- Modified: ${modified.join(', ')}\n`;
  }

  return changes.trim();
}

function collectComponents(node: any, map: Map<string, any>): void {
  if (node.component) {
    map.set(node.id, node);
  }
  if (node.children?.length) {
    node.children.forEach((child: any) => collectComponents(child, map));
  }
}

function describeTradeoffs(plan: UIPlan): string {
  const componentCount = countComponents(plan.root);
  const hasModals = hasComponent(plan.root, 'Modal');
  const hasTables = hasComponent(plan.root, 'Table');

  const tradeoffs: string[] = [];

  if (componentCount > 5) {
    tradeoffs.push('Complex layout with many components – may impact initial load time');
  }

  if (hasModals) {
    tradeoffs.push('Modal dialogs provide focused interactions but may reduce visibility of background content');
  }

  if (hasTables) {
    tradeoffs.push('Tables display data efficiently but may need responsive adjustments on smaller screens');
  }

  if (tradeoffs.length === 0) {
    return '**Tradeoffs:**\nThis layout provides a good balance between functionality and simplicity.';
  }

  return `**Tradeoffs:**\n- ${tradeoffs.join('\n- ')}`;
}

function hasComponent(node: any, componentName: string): boolean {
  if (node.component === componentName) {
    return true;
  }
  if (node.children?.length) {
    return node.children.some((child: any) => hasComponent(child, componentName));
  }
  return false;
}
