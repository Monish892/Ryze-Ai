import { z } from 'zod';

// ============================================================================
// STRICT SCHEMA DEFINITIONS - NON-NEGOTIABLE
// ============================================================================

// Deterministic ID generation - no Math.random(), based on hierarchy
export function generateDeterministicId(parentId: string, componentName: string, index: number): string {
  // Format: parent_component_index (e.g., root_Button_0)
  return `${parentId}_${componentName}_${index}`.replace(/[^a-zA-Z0-9_]/g, '_');
}

// ============================================================================
// COMPONENT SCHEMAS
// ============================================================================

// UI Components (not layout)
const UI_COMPONENT_NAMES = ['Button', 'Card', 'Input', 'Table', 'Modal', 'Sidebar', 'Navbar', 'Chart'] as const;

// Layout Components ONLY
const LAYOUT_COMPONENT_NAMES = ['ColumnLayout', 'RowLayout', 'GridLayout'] as const;

// All allowed components
const ALL_ALLOWED_COMPONENTS = [...UI_COMPONENT_NAMES, ...LAYOUT_COMPONENT_NAMES] as const;

// ============================================================================
// NODE SCHEMAS
// ============================================================================

export const ComponentNodeSchema: z.ZodType<any> = z.object({
  id: z.string()
    .min(1, 'ID required')
    .regex(/^[a-zA-Z0-9_]+$/, 'ID must be alphanumeric with underscores')
    .describe('Unique deterministic identifier'),
  
  component: z.enum(UI_COMPONENT_NAMES)
    .describe('UI component type (not layout)'),
  
  props: z.record(z.any())
    .refine(
      (props) => !('style' in props),
      'Component props cannot include "style"'
    )
    .refine(
      (props) => !('className' in props),
      'Component props cannot include "className"'
    )
    .describe('Component-specific props (no style/className allowed)'),
  
  children: z.lazy(() => z.array(ComponentNodeSchema).optional())
    .describe('Nested UI components (not layouts)'),
});

export type ComponentNode = z.infer<typeof ComponentNodeSchema>;

export const LayoutNodeSchema: z.ZodType<any> = z.object({
  id: z.string()
    .min(1, 'ID required')
    .regex(/^[a-zA-Z0-9_]+$/, 'ID must be alphanumeric with underscores'),
  
  component: z.enum(LAYOUT_COMPONENT_NAMES)
    .describe('Layout component type (ColumnLayout, RowLayout, or GridLayout)'),
  
  props: z.object({
    gap: z.number().optional().describe('Spacing between children'),
    padding: z.number().optional().describe('Internal padding'),
    columns: z.number().optional().describe('Grid columns (GridLayout only)'),
  }).strict()
    .describe('Layout props (only gap, padding, columns allowed)'),
  
  children: z.lazy(() => z.array(
    z.union([LayoutNodeSchema, ComponentNodeSchema])
  ).min(1, 'Layout must have at least one child'))
    .describe('Child nodes (layout or UI components)'),
});

export type LayoutNode = z.infer<typeof LayoutNodeSchema>;

export const UIPlanSchema: z.ZodType<any> = z.object({
  modificationType: z.enum(['create', 'edit', 'regenerate'])
    .describe('Type of modification'),
  
  root: LayoutNodeSchema
    .describe('Root layout node (must be ColumnLayout, RowLayout, or GridLayout)'),
});

export type UIPlan = z.infer<typeof UIPlanSchema>;

// ============================================================================
// VERSION STORAGE SCHEMA
// ============================================================================

export const VersionRecordSchema = z.object({
  id: z.string(),
  plan: UIPlanSchema,
  code: z.string().min(1),
  explanation: z.string().min(1),
  timestamp: z.number(),
});

export type VersionRecord = z.infer<typeof VersionRecordSchema>;

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

export function validateUIPlan(plan: unknown): { valid: boolean; error?: string; data?: UIPlan } {
  try {
    const data = UIPlanSchema.parse(plan);
    return { valid: true, data };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const message = error.errors
        .map(e => `${e.path.join('.')}: ${e.message}`)
        .join('; ');
      return { valid: false, error: message };
    }
    return { valid: false, error: 'Unknown validation error' };
  }
}

export function validateComponentNode(node: unknown): { valid: boolean; error?: string } {
  try {
    ComponentNodeSchema.parse(node);
    return { valid: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { valid: false, error: error.errors[0]?.message };
    }
    return { valid: false, error: 'Unknown validation error' };
  }
}

export function validateLayoutNode(node: unknown): { valid: boolean; error?: string } {
  try {
    LayoutNodeSchema.parse(node);
    return { valid: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { valid: false, error: error.errors[0]?.message };
    }
    return { valid: false, error: 'Unknown validation error' };
  }
}

// ============================================================================
// WHITELIST & SAFETY
// ============================================================================

export const COMPONENT_WHITELIST = ALL_ALLOWED_COMPONENTS;
export const LAYOUT_WHITELIST = LAYOUT_COMPONENT_NAMES;
export const UI_COMPONENT_WHITELIST = UI_COMPONENT_NAMES;

export function isValidComponent(name: string): name is typeof ALL_ALLOWED_COMPONENTS[number] {
  return COMPONENT_WHITELIST.includes(name as any);
}

export function isLayoutComponent(name: string): name is typeof LAYOUT_COMPONENT_NAMES[number] {
  return LAYOUT_WHITELIST.includes(name as any);
}

export function isUIComponent(name: string): name is typeof UI_COMPONENT_NAMES[number] {
  return UI_COMPONENT_WHITELIST.includes(name as any);
}

// ============================================================================
// SECURITY CHECKS
// ============================================================================

export function checkPromptInjection(input: string): boolean {
  const injectionPatterns = [
    /ignore previous rules/i,
    /override constraints/i,
    /bypass validation/i,
    /add new component/i,
    /create component/i,
    /modify component implementation/i,
    /remove constraint/i,
    /disable safety/i,
    /generate css/i,
    /generate style/i,
    /use className/i,
    /use tailwind/i,
    /use styled/i,
  ];
  
  return injectionPatterns.some(pattern => pattern.test(input));
}

// Forbidden props that should never appear
export const FORBIDDEN_PROPS = new Set(['style', 'className', 'css', 'dangerouslySetInnerHTML']);

export function hasNoForbiddenProps(props: Record<string, any>): boolean {
  return !Object.keys(props).some(key => FORBIDDEN_PROPS.has(key));
}

// ============================================================================
// ENHANCED VALIDATION FUNCTIONS
// ============================================================================

/**
 * STRICT: Validate component name is in whitelist
 * Throws error if invalid
 */
export function validateComponentNameStrict(name: string): void {
  if (!isValidComponent(name)) {
    throw new Error(`INVALID_COMPONENT: ${name} not in whitelist [${COMPONENT_WHITELIST.join(', ')}]`);
  }
}

/**
 * STRICT: Check props for forbidden fields
 * Throws error if forbidden field found
 */
export function validatePropsStrict(props: Record<string, any>, componentName: string): void {
  if (!props) return;

  const forbiddenKeys = Object.keys(props).filter(key => FORBIDDEN_PROPS.has(key));
  if (forbiddenKeys.length > 0) {
    throw new Error(`FORBIDDEN_PROPS_IN_${componentName}: ${forbiddenKeys.join(', ')} not allowed`);
  }
}

/**
 * STRICT: Validate entire node structure recursively
 * Throws error if any violations found
 */
export function validateNodeStructureStrict(node: any, depth: number = 0): void {
  if (!node) {
    throw new Error('Node cannot be null or undefined');
  }

  // Check ID format
  if (!node.id || typeof node.id !== 'string') {
    throw new Error('Node must have string ID');
  }
  if (!/^[a-zA-Z0-9_]+$/.test(node.id)) {
    throw new Error(`Invalid ID format: ${node.id}`);
  }

  // Check component name
  if (!node.component || typeof node.component !== 'string') {
    throw new Error(`Node ${node.id} must have string component name`);
  }
  validateComponentNameStrict(node.component);

  // Check props
  if (node.props && typeof node.props === 'object') {
    validatePropsStrict(node.props, node.component);
  }

  // Recursively check children
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      validateNodeStructureStrict(child, depth + 1);
    }
  }
}

/**
 * STRICT: Enhanced prompt injection detection with comprehensive patterns
 */
export function checkPromptInjectionStrict(input: string): { safe: boolean; reason?: string } {
  const injectionPatterns = [
    // Constraint bypass
    { pattern: /ignore\s+(previous|earlier|prior|these)\s+(rules|instructions|constraints)/i, reason: 'Constraint bypass attempt' },
    { pattern: /override\s+(constraint|rule|validation|check)/i, reason: 'Override attempt' },
    { pattern: /disable\s+(safeguard|safety|check|validation|constraint)/i, reason: 'Safety disable attempt' },
    { pattern: /bypass.*validation/i, reason: 'Validation bypass attempt' },
    { pattern: /remove.*constraint/i, reason: 'Constraint removal attempt' },
    
    // Component manipulation
    { pattern: /add\s+(new\s+)?component/i, reason: 'Dynamic component creation attempt' },
    { pattern: /create\s+(new\s+)?component/i, reason: 'Dynamic component creation attempt' },
    { pattern: /modify\s+(component|implementation)/i, reason: 'Component modification attempt' },
    { pattern: /generate.*component.*dynamically/i, reason: 'Dynamic component generation attempt' },
    
    // Style/CSS injection
    { pattern: /use\s+(tailwind|styled|css|styles?)/i, reason: 'Style injection attempt' },
    { pattern: /add.*style/i, reason: 'Style injection attempt' },
    { pattern: /generate.*css/i, reason: 'CSS injection attempt' },
    { pattern: /className.*allowed/i, reason: 'ClassName constraint bypass attempt' },
    { pattern: /style.*prop/i, reason: 'Style prop injection attempt' },
    
    // Code execution
    { pattern: /eval|execute|run.*code/i, reason: 'Code execution attempt' },
    { pattern: /dangerous|innerHTML/i, reason: 'Dangerous content attempt' },
    
    // Rule modification
    { pattern: /change.*rule/i, reason: 'Rule modification attempt' },
    { pattern: /forget.*whitelist/i, reason: 'Whitelist bypass attempt' },
    { pattern: /new.*component.*type/i, reason: 'New component type injection attempt' },
  ];

  for (const { pattern, reason } of injectionPatterns) {
    if (pattern.test(input)) {
      return { safe: false, reason };
    }
  }

  return { safe: true };
}

/**
 * STRICT: Validate full UIPlan with all checks
 */
export function validateUIPlanStrict(plan: unknown): { valid: boolean; error?: string; data?: UIPlan } {
  // First do Zod validation
  const zodValidation = validateUIPlan(plan);
  if (!zodValidation.valid) {
    return zodValidation;
  }

  // Then do structural validation
  try {
    if (zodValidation.data) {
      validateNodeStructureStrict(zodValidation.data.root);
    }
    return zodValidation;
  } catch (error) {
    return { valid: false, error: String(error) };
  }
}
