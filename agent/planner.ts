import {
  UIPlan,
  validateUIPlan,
  validateUIPlanStrict,
  checkPromptInjectionStrict,
  generateDeterministicId,
} from './schema';

// ============================================================================
// PLANNER SYSTEM PROMPT
// ============================================================================

const PLANNER_SYSTEM_PROMPT = `You are a strict UI planner that converts natural language into structured JSON plans.

CRITICAL RULES (NON-NEGOTIABLE):

1. Output ONLY valid JSON matching the UIPlan schema
2. Root must be ONE of: ColumnLayout, RowLayout, or GridLayout
3. Use ONLY these UI components: Button, Card, Input, Table, Modal, Sidebar, Navbar, Chart
4. Use ONLY these Layout components: ColumnLayout, RowLayout, GridLayout
5. NEVER output JSX, CSS, or any code
6. NEVER include 'style' or 'className' props
7. NEVER invent new components
8. IDs are auto-generated deterministically - don't create them

UIPlan JSON Schema:
{
  "modificationType": "create" | "edit" | "regenerate",
  "root": {
    "id": "root",
    "component": "ColumnLayout" | "RowLayout" | "GridLayout",
    "props": { "gap": number, "padding": number },
    "children": [ComponentNode or LayoutNode array]
  }
}`;

export async function planUI(
  userIntent: string,
  previousPlan?: UIPlan,
  apiKey?: string
): Promise<{ plan?: UIPlan; error?: string }> {
  try {
    // STRICT: Check for prompt injection with detailed detection
    const injectionCheck = checkPromptInjectionStrict(userIntent);
    if (!injectionCheck.safe) {
      return {
        error: `PROMPT_INJECTION_DETECTED: ${injectionCheck.reason}. Cannot process request.`,
      };
    }

    // STRICT: Validate input is not empty or too long
    if (!userIntent || typeof userIntent !== 'string') {
      return { error: 'INVALID_INPUT: Intent must be non-empty string' };
    }
    if (userIntent.length > 2000) {
      return { error: 'INVALID_INPUT: Intent exceeds maximum length (2000 chars)' };
    }

    // Parse intent and generate plan
    const plan = parseIntentToDeterministicPlan(userIntent, previousPlan);

    // STRICT: Validate plan with all checks
    const validation = validateUIPlanStrict(plan);
    if (!validation.valid) {
      return { error: `PLAN_VALIDATION_ERROR: ${validation.error}` };
    }

    if (!validation.data) {
      return { error: 'PLAN_VALIDATION_ERROR: Plan validation succeeded but no data returned' };
    }

    return { plan: validation.data };
  } catch (error) {
    return { error: `PLANNING_ERROR: ${String(error)}` };
  }
}

/**
 * Extract card title from intent
 * Looks for patterns like: "titled 'X'", "titled \"X\""
 */
function extractCardTitle(intent: string): string | null {
  const patterns = [
    /titled\s+['"`]([^'"`]+)['"`]/i,        // titled 'X' or titled "X" or titled `X`
    /titled\s+([^\s,.;]+)/i,                // titled X (single word)
    /title\s+['"`]([^'"`]+)['"`]/i,         // title 'X'
    /title\s+([^\s,.;]+)/i,                 // title X
    /card\s+['"`]([^'"`]+)['"`]/i,          // card 'X'
    /card\s+titled\s+['"`]([^'"`]+)['"`]/i, // card titled 'X'
  ];

  for (const pattern of patterns) {
    const match = intent.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return null;
}

/**
 * Apply minimal patches in edit mode to preserve existing structure
 * Rules:
 * 1. Remove only specified components (e.g., "remove sidebar")
 * 2. Add new components to appropriate parents
 * 3. Preserve all other structure unchanged
 * 4. Do not collapse or rebuild layout
 */
function applyEditModePatch(intent: string, previousPlan: UIPlan): UIPlan {
  const lower = intent.toLowerCase();

  // Determine what to remove
  const shouldRemoveSidebar = lower.includes('remove') && lower.includes('sidebar');
  const shouldRemoveNavbar = lower.includes('remove') && lower.includes('navbar');
  const shouldRemoveChart = lower.includes('remove') && lower.includes('chart');
  const shouldRemoveTable = lower.includes('remove') && lower.includes('table');
  const shouldRemoveModal = lower.includes('remove') && lower.includes('modal');

  // Determine what to add
  const shouldAddModal = (lower.includes('add') || lower.includes('modal')) && !shouldRemoveModal;
  const shouldAddChart = lower.includes('add') && lower.includes('chart') && !shouldRemoveChart;
  const shouldAddTable = lower.includes('add') && lower.includes('table') && !shouldRemoveTable;
  const shouldAddInput = lower.includes('input') && shouldAddModal;

  // Deep clone previous plan to avoid mutation
  let newPlan = JSON.parse(JSON.stringify(previousPlan)) as UIPlan;
  newPlan.modificationType = 'edit';

  // Helper: Remove component by name from tree
  function removeComponentFromTree(root: any, componentName: string): any {
    if (!root) return root;

    if (root.component === componentName) {
      return null; // Mark for removal
    }

    if (root.children && Array.isArray(root.children)) {
      // Filter out removed children and recursively process remaining
      root.children = root.children
        .map((child: any) => removeComponentFromTree(child, componentName))
        .filter((child: any) => child !== null);
    }

    return root;
  }

  // Helper: Add component to appropriate parent
  function addComponentToTree(root: any, componentToAdd: any, parentComponentName?: string): void {
    if (!root) return;

    // If parent specified, find it and add to its children
    if (parentComponentName) {
      if (root.component === parentComponentName) {
        if (!root.children) root.children = [];
        root.children.push(componentToAdd);
        return;
      }
      if (root.children) {
        for (const child of root.children) {
          addComponentToTree(child, componentToAdd, parentComponentName);
        }
      }
    } else {
      // Add to root's children if it's a layout
      if (['ColumnLayout', 'RowLayout', 'GridLayout'].includes(root.component)) {
        if (!root.children) root.children = [];
        root.children.push(componentToAdd);
      }
    }
  }

  // Apply removals
  if (shouldRemoveSidebar) {
    newPlan.root = removeComponentFromTree(newPlan.root, 'Sidebar');
    
    // If sidebar was removed from a RowLayout with ColumnLayout inside, promote the ColumnLayout
    if (newPlan.root.component === 'RowLayout' && newPlan.root.children) {
      const columnLayoutIndex = newPlan.root.children.findIndex(
        (c: any) => c.component === 'ColumnLayout'
      );
      if (columnLayoutIndex !== -1 && newPlan.root.children.length === 1) {
        // Replace RowLayout with its only ColumnLayout child
        newPlan.root = newPlan.root.children[0];
      }
    }
  }

  if (shouldRemoveNavbar) {
    newPlan.root = removeComponentFromTree(newPlan.root, 'Navbar');
  }

  if (shouldRemoveChart) {
    newPlan.root = removeComponentFromTree(newPlan.root, 'Chart');
  }

  if (shouldRemoveTable) {
    newPlan.root = removeComponentFromTree(newPlan.root, 'Table');
  }

  if (shouldRemoveModal) {
    newPlan.root = removeComponentFromTree(newPlan.root, 'Modal');
  }

  // Apply additions
  if (shouldAddModal) {
    const childIndex = newPlan.root.children?.length ?? 0;
    const modal: any = {
      id: generateDeterministicId('root', 'Modal', childIndex),
      component: 'Modal',
      props: {
        isOpen: false,
        title: 'Settings',
      },
    };

    // Add inputs to modal if requested
    if (shouldAddInput) {
      modal.children = [
        {
          id: generateDeterministicId(modal.id, 'Input', 0),
          component: 'Input',
          props: {
            label: 'Setting 1',
            type: 'text',
            placeholder: 'Enter value',
          },
        },
        {
          id: generateDeterministicId(modal.id, 'Input', 1),
          component: 'Input',
          props: {
            label: 'Setting 2',
            type: 'text',
            placeholder: 'Enter value',
          },
        },
      ];
    }

    // Add modal to root's children
    addComponentToTree(newPlan.root, modal);
  }

  if (shouldAddChart) {
    const childIndex = newPlan.root.children?.length ?? 0;
    const chartCardId = generateDeterministicId('root', 'Card', childIndex);
    const chart: any = {
      id: chartCardId,
      component: 'Card',
      props: { title: 'Chart', padding: 16 },
      children: [
        {
          id: generateDeterministicId(chartCardId, 'Chart', 0),
          component: 'Chart',
          props: {
            title: 'Performance',
            data: [
              { label: 'Jan', value: 45 },
              { label: 'Feb', value: 60 },
            ],
          },
        },
      ],
    };
    addComponentToTree(newPlan.root, chart);
  }

  if (shouldAddTable) {
    const childIndex = newPlan.root.children?.length ?? 0;
    const tableCardId = generateDeterministicId('root', 'Card', childIndex);
    const table: any = {
      id: tableCardId,
      component: 'Card',
      props: { title: 'Table', padding: 16 },
      children: [
        {
          id: generateDeterministicId(tableCardId, 'Table', 0),
          component: 'Table',
          props: {
            columns: [
              { header: 'ID', key: 'id' },
              { header: 'Name', key: 'name' },
            ],
            data: [
              { id: '1', name: 'Item 1' },
            ],
          },
        },
      ],
    };
    addComponentToTree(newPlan.root, table);
  }

  return newPlan;
}

/**
 * Extract form field definitions from intent
 * Detects common field types: email, password, username, name, phone, search, etc.
 */
function parseFormFields(intent: string): Array<{ label: string; type: string; placeholder: string }> {
  const lower = intent.toLowerCase();
  const fields: Array<{ label: string; type: string; placeholder: string }> = [];

  // Field patterns: detect field types mentioned in the intent
  const patterns = [
    { keyword: /email/i, label: 'Email', type: 'email', placeholder: 'Enter email' },
    { keyword: /password/i, label: 'Password', type: 'password', placeholder: 'Enter password' },
    { keyword: /username|user name/i, label: 'Username', type: 'text', placeholder: 'Enter username' },
    { keyword: /confirm password|re-enter password/i, label: 'Confirm Password', type: 'password', placeholder: 'Confirm password' },
    { keyword: /full name|name/i, label: 'Full Name', type: 'text', placeholder: 'Enter full name' },
    { keyword: /phone|phone number/i, label: 'Phone', type: 'tel', placeholder: 'Enter phone number' },
    { keyword: /search/i, label: 'Search', type: 'text', placeholder: 'Search...' },
    { keyword: /address/i, label: 'Address', type: 'text', placeholder: 'Enter address' },
    { keyword: /comment|message|feedback/i, label: 'Message', type: 'text', placeholder: 'Enter message' },
  ];

  for (const pattern of patterns) {
    if (pattern.keyword.test(lower)) {
      fields.push({
        label: pattern.label,
        type: pattern.type,
        placeholder: pattern.placeholder,
      });
    }
  }

  // If no specific fields detected but it's a login form, add email and password
  if (fields.length === 0 && /login|sign in/i.test(lower)) {
    fields.push(
      { label: 'Email', type: 'email', placeholder: 'Enter email' },
      { label: 'Password', type: 'password', placeholder: 'Enter password' }
    );
  }

  // If no fields detected but it's a signup/register form, add common signup fields
  if (fields.length === 0 && /sign up|register|signup/i.test(lower)) {
    fields.push(
      { label: 'Email', type: 'email', placeholder: 'Enter email' },
      { label: 'Username', type: 'text', placeholder: 'Enter username' },
      { label: 'Password', type: 'password', placeholder: 'Enter password' },
      { label: 'Confirm Password', type: 'password', placeholder: 'Confirm password' }
    );
  }

  return fields;
}

/**
 * Parse intent handling negations like "remove", "without", "no"
 * Returns the effective state after processing all directives
 */
function parseComponentRequirement(keyword: string, intent: string): boolean {
  const lower = intent.toLowerCase();
  
  // Check if this component is mentioned
  const mentioned = lower.includes(keyword);
  if (!mentioned) return false;

  // Check if explicitly removed/disabled
  const negationPatterns = [
    new RegExp(`remove\\s+(?:the\\s+)?${keyword}`, 'i'),
    new RegExp(`without\\s+(?:the\\s+)?${keyword}`, 'i'),
    new RegExp(`no\\s+${keyword}`, 'i'),
    new RegExp(`(?:don't|do not)\\s+(?:add|use|include)\\s+(?:the\\s+)?${keyword}`, 'i'),
  ];

  for (const pattern of negationPatterns) {
    if (pattern.test(intent)) {
      return false; // Explicitly removed/disabled
    }
  }

  return true; // Mentioned and not removed
}

function parseIntentToDeterministicPlan(
  intent: string,
  previousPlan?: UIPlan
): UIPlan {
  const lower = intent.toLowerCase();

  // Determine modification type
  let modificationType: 'create' | 'edit' | 'regenerate' = 'create';
  if (previousPlan) {
    if (lower.includes('regenerate') || lower.includes('completely') || lower.includes('start over')) {
      modificationType = 'regenerate';
    } else if (
      lower.includes('add') ||
      lower.includes('modify') ||
      lower.includes('change') ||
      lower.includes('update') ||
      lower.includes('remove') ||
      lower.includes('delete')
    ) {
      modificationType = 'edit';
    }
  }

  // ============================================================================
  // EDIT MODE: PRESERVE STRUCTURE AND APPLY MINIMAL PATCHES
  // ============================================================================
  if (modificationType === 'edit' && previousPlan) {
    return applyEditModePatch(intent, previousPlan);
  }

  // ============================================================================
  // FINAL DIRECTIVE DETECTION (HIGHEST PRIORITY)
  // ============================================================================
  // Check for directives that appear late in the intent (they override earlier ones)
  
  // Split intent into sentences/clauses to find "final" directives
  const sentences = intent.split(/[.;]/);
  const lastClauses = sentences.slice(-2).join('.').toLowerCase();
  const allContent = lower;

  // Check if user explicitly requested complex structure elements
  const hasExplicitComplexElements = allContent.includes('dashboard') || 
    allContent.includes('sidebar') || 
    allContent.includes('navbar') || 
    allContent.includes('two columns') || 
    allContent.includes('two cards') || 
    allContent.includes('chart') || 
    allContent.includes('table');

  // "make minimal" at the end AFTER explicit complex requests = simplify existing structure
  // NOT = reduce to single card
  const hasExplicitMinimalCard = allContent.includes('only one card') ||
    (allContent.includes('only') && allContent.includes('card') && allContent.includes('nothing else')) ||
    (allContent.includes('minimal') && (allContent.includes('only one') || 
                                        allContent.includes('minimal page') ||
                                        allContent.includes('minimal interface')));

  // Only treat "minimal" in final directives as single-card IF no complex elements were requested
  const isMinimalInFinal = !hasExplicitComplexElements && 
    (lastClauses.includes('minimal') || 
     lastClauses.includes('only one card') ||
     lastClauses.includes('simplif'));

  if (isMinimalInFinal || hasExplicitMinimalCard) {
    const title = extractCardTitle(intent) || 'Welcome';
    return createMinimalCardPlan(modificationType, title);
  }

  // ============================================================================
  // GENERAL MINIMAL INTENT DETECTION
  // ============================================================================
  // Check for explicit minimal requests (NOT preceded by complex structure requests)
  const isMinimal = !hasExplicitComplexElements && (
    lower.includes('only one card') ||
    lower.includes('only one') ||
    lower.includes('minimal ') ||
    lower.includes('minimal\n') ||
    lower.includes('minimal.') ||
    lower.includes('minimal,') ||
    (lower.includes('one card') && lower.includes('nothing else')) ||
    (lower.includes('one') && lower.includes('centered') && lower.includes('card'))
  );

  if (isMinimal) {
    const title = extractCardTitle(intent) || 'Welcome';
    return createMinimalCardPlan(modificationType, title);
  }

  // ============================================================================
  // PARSE LAYOUT REQUIREMENTS (Handle Negations)
  // ============================================================================
  // Parse keywords with negation handling
  const hasNavbar = parseComponentRequirement('navbar', intent) || 
    (parseComponentRequirement('nav bar', intent) || parseComponentRequirement('navigation', intent));
  const hasSidebar = parseComponentRequirement('sidebar', intent) || 
    parseComponentRequirement('side bar', intent);
  
  // Two columns is special - check for explicit mentions with negation checks
  const mentionsTwoColumns = lower.includes('side by side') || 
    lower.includes('two columns') || 
    lower.includes('two cards');
  const hasTwoColumns = mentionsTwoColumns && !lower.includes('remove') && !lower.includes('without');
  
  const hasChart = parseComponentRequirement('chart', intent) || parseComponentRequirement('graph', intent);
  const hasTable = parseComponentRequirement('table', intent);
  const hasForm = parseComponentRequirement('form', intent) || parseComponentRequirement('input', intent) || parseComponentRequirement('login', intent);
  const hasModal = parseComponentRequirement('modal', intent) || parseComponentRequirement('dialog', intent);
  const hasDashboard = parseComponentRequirement('dashboard', intent) || parseComponentRequirement('overview', intent);

  // NEW: Detect specific UI patterns
  const hasProductCard = /product\s+card|product\s+display|product\s+listing|product\s+item|displaying.*product/i.test(lower) &&
    (lower.includes('image') || lower.includes('title') || lower.includes('price') || lower.includes('button'));
  const hasItemCard = /item\s+card|listing\s+card|card.*item|item.*card/i.test(lower) && !hasProductCard;
  const hasProfileCard = /profile\s+card|user\s+card|contact\s+card|team\s+member|showing.*profile/i.test(lower);
  const hasStatCard = /stat\s+card|statistics|metric|counter|number|stat.*display/i.test(lower);
  const hasHeroSection = /hero|banner|header\s+section|large.*header|featured|showcase/i.test(lower);
  const hasGallery = /gallery|grid.*images|image\s+grid|photos|portfolio|collection/i.test(lower);
  const hasTestimonial = /testimonial|review|comment|feedback.*display|quote\s+card/i.test(lower);
  const hasPricing = /pricing\s+card|price.*display|tier|plan.*card|pricing\s+table/i.test(lower);
  const hasSearchBar = /search\s+bar|search\s+box|find.*search|search\s+with/i.test(lower);

  // ============================================================================
  // MULTI-LEVEL LAYOUT ROUTING (Priority Order)
  // ============================================================================
  // Highest priority: Complex layouts with multiple structural elements
  // Lower priority: Simple layouts

  // 1. Sidebar + Navbar + Two Columns (highest complexity)
  if (hasSidebar && hasNavbar && hasTwoColumns) {
    return createSidebarNavbarTwoColumnsLayout(modificationType, hasChart, hasTable);
  }

  // 2. Sidebar + Two Columns
  if (hasSidebar && hasTwoColumns) {
    return createSidebarWithColumnsLayout(modificationType, hasChart, hasTable);
  }

  // 3. Sidebar + Dashboard
  if (hasSidebar && hasDashboard) {
    return createSidebarDashboardLayout(modificationType);
  }

  // 4. Sidebar only
  if (hasSidebar) {
    return createSidebarLayout(modificationType, hasNavbar);
  }

  // 5. Navbar + Two Columns (chart and table)
  if (hasNavbar && hasTwoColumns && hasChart && hasTable) {
    return createNavbarWithChartTableLayout(modificationType);
  }

  // 6. Navbar + Two Columns (generic)
  if (hasNavbar && hasTwoColumns) {
    return createNavbarWithColumnsLayout(modificationType, hasChart, hasTable);
  }

  // 7. Navbar + Dashboard
  if (hasNavbar && hasDashboard) {
    return createNavbarDashboardLayout(modificationType);
  }

  // 8. Navbar only
  if (hasNavbar) {
    return createNavbarOnlyLayout(modificationType);
  }

  // 9. Two Columns with Chart and Table
  if (hasTwoColumns && hasChart && hasTable) {
    return createTwoColumnsChartTableLayout(modificationType);
  }

  // 10. Two Columns (generic)
  if (hasTwoColumns) {
    return createTwoColumnsLayout(modificationType, hasChart);
  }

  // 11. Dashboard
  if (hasDashboard) {
    return createDashboardPlan(modificationType);
  }

  // 12. Modal
  if (hasModal) {
    return createModalPlan(modificationType);
  }

  // ============================================================================
  // SPECIALIZED UI PATTERNS (New)
  // ============================================================================

  // 13. Product Card
  if (hasProductCard) {
    return createProductCardPlan(modificationType);
  }

  // 14. Profile Card
  if (hasProfileCard) {
    return createProfileCardPlan(modificationType);
  }

  // 15. Stat Card
  if (hasStatCard) {
    return createStatCardPlan(modificationType);
  }

  // 16. Hero Section
  if (hasHeroSection) {
    return createHeroSectionPlan(modificationType);
  }

  // 17. Gallery/Grid
  if (hasGallery) {
    return createGalleryPlan(modificationType);
  }

  // 18. Testimonial/Review Card
  if (hasTestimonial) {
    return createTestimonialPlan(modificationType);
  }

  // 19. Pricing Card
  if (hasPricing) {
    return createPricingCardPlan(modificationType);
  }

  // 20. Search Bar
  if (hasSearchBar) {
    return createSearchBarPlan(modificationType);
  }

  // 21. Item Card
  if (hasItemCard) {
    return createItemCardPlan(modificationType);
  }

  // 22. Form
  if (hasForm) {
    return createFormPlan(modificationType, intent);
  }

  // 23. Table
  if (hasTable) {
    return createTablePlan(modificationType);
  }

  // Default: simple card layout
  return createDefaultPlan(modificationType);
}

// ============================================================================
// MINIMAL CARD PLAN (Respects User Intent - No Auto-population)
// ============================================================================

/**
 * Creates a minimal single card with ONLY a title and no auto-populated children.
 * STRICTLY respects user intent: "only one card" means exactly one card, nothing else.
 *
 * HIERARCHY:
 * ColumnLayout (root)
 *   └─ Card (with title only, NO children)
 */
function createMinimalCardPlan(
  modificationType: 'create' | 'edit' | 'regenerate',
  title: string
): UIPlan {
  return {
    modificationType,
    root: {
      id: 'root',
      component: 'ColumnLayout',
      props: { gap: 16, padding: 24 },
      children: [
        {
          id: 'root_Card_0',
          component: 'Card',
          props: { title, padding: 16 },
          // NO children - user said "only one card", not "card with content"
        },
      ],
    },
  };
}

// ============================================================================
// ADVANCED LAYOUT COMPOSITION FUNCTIONS
// ============================================================================

/**
 * Sidebar on the left + navbar at top + two columns with chart and table
 * HIERARCHY:
 * RowLayout (root)
 *   ├─ Sidebar
 *   └─ ColumnLayout
 *       ├─ Navbar
 *       └─ RowLayout (two columns)
 *           ├─ Card (chart)
 *           └─ Card (table)
 */
function createSidebarNavbarTwoColumnsLayout(
  modificationType: 'create' | 'edit' | 'regenerate',
  hasChart: boolean,
  hasTable: boolean
): UIPlan {
  return {
    modificationType,
    root: {
      id: 'root',
      component: 'RowLayout',
      props: { gap: 0, padding: 0 },
      children: [
        {
          id: 'root_Sidebar_0',
          component: 'Sidebar',
          props: { width: 250 },
        },
        {
          id: 'root_ColumnLayout_0',
          component: 'ColumnLayout',
          props: { gap: 0, padding: 0 },
          children: [
            {
              id: 'root_ColumnLayout_0_Navbar_0',
              component: 'Navbar',
              props: { title: 'Dashboard' },
            },
            {
              id: 'root_ColumnLayout_0_RowLayout_0',
              component: 'RowLayout',
              props: { gap: 16, padding: 24 },
              children: [
                {
                  id: 'root_ColumnLayout_0_RowLayout_0_Card_0',
                  component: 'Card',
                  props: { title: hasChart ? 'Analytics' : 'Left Panel', padding: 16 },
                  children: hasChart
                    ? [
                        {
                          id: 'root_ColumnLayout_0_RowLayout_0_Card_0_Chart_0',
                          component: 'Chart',
                          props: {
                            title: 'Performance',
                            data: [
                              { label: 'Jan', value: 45 },
                              { label: 'Feb', value: 60 },
                              { label: 'Mar', value: 75 },
                            ],
                            type: 'bar',
                          },
                        },
                      ]
                    : [],
                },
                {
                  id: 'root_ColumnLayout_0_RowLayout_0_Card_1',
                  component: 'Card',
                  props: { title: hasTable ? 'Data' : 'Right Panel', padding: 16 },
                  children: hasTable
                    ? [
                        {
                          id: 'root_ColumnLayout_0_RowLayout_0_Card_1_Table_0',
                          component: 'Table',
                          props: {
                            columns: [
                              { header: 'Item', key: 'item' },
                              { header: 'Status', key: 'status' },
                              { header: 'Value', key: 'value' },
                            ],
                            data: [
                              { item: 'Item 1', status: 'Active', value: '100' },
                              { item: 'Item 2', status: 'Inactive', value: '80' },
                            ],
                          },
                        },
                      ]
                    : [],
                },
              ],
            },
          ],
        },
      ],
    },
  };
}

/**
 * Navbar at top with two cards side by side (chart and table)
 * HIERARCHY:
 * ColumnLayout (root)
 *   ├─ Navbar
 *   └─ RowLayout (two columns)
 *       ├─ Card (chart)
 *       └─ Card (table)
 */
function createNavbarWithChartTableLayout(modificationType: 'create' | 'edit' | 'regenerate'): UIPlan {
  return {
    modificationType,
    root: {
      id: 'root',
      component: 'ColumnLayout',
      props: { gap: 0, padding: 0 },
      children: [
        {
          id: 'root_Navbar_0',
          component: 'Navbar',
          props: { title: 'Dashboard' },
        },
        {
          id: 'root_RowLayout_0',
          component: 'RowLayout',
          props: { gap: 16, padding: 24 },
          children: [
            {
              id: 'root_RowLayout_0_Card_0',
              component: 'Card',
              props: { title: 'Analytics', padding: 16 },
              children: [
                {
                  id: 'root_RowLayout_0_Card_0_Chart_0',
                  component: 'Chart',
                  props: {
                    title: 'Performance',
                    data: [
                      { label: 'Q1', value: 40 },
                      { label: 'Q2', value: 55 },
                      { label: 'Q3', value: 70 },
                      { label: 'Q4', value: 65 },
                    ],
                    type: 'bar',
                  },
                },
              ],
            },
            {
              id: 'root_RowLayout_0_Card_1',
              component: 'Card',
              props: { title: 'Data', padding: 16 },
              children: [
                {
                  id: 'root_RowLayout_0_Card_1_Table_0',
                  component: 'Table',
                  props: {
                    columns: [
                      { header: 'ID', key: 'id' },
                      { header: 'Value', key: 'value' },
                      { header: 'Status', key: 'status' },
                    ],
                    data: [
                      { id: '1', value: '100', status: 'Active' },
                      { id: '2', value: '200', status: 'Active' },
                    ],
                  },
                },
              ],
            },
          ],
        },
      ],
    },
  };
}

/**
 * Navbar only layout
 * HIERARCHY:
 * ColumnLayout (root)
 *   ├─ Navbar
 *   └─ Card (content)
 */
function createNavbarOnlyLayout(modificationType: 'create' | 'edit' | 'regenerate'): UIPlan {
  return {
    modificationType,
    root: {
      id: 'root',
      component: 'ColumnLayout',
      props: { gap: 0, padding: 0 },
      children: [
        {
          id: 'root_Navbar_0',
          component: 'Navbar',
          props: { title: 'App' },
        },
        {
          id: 'root_Card_0',
          component: 'Card',
          props: { title: 'Content', padding: 24 },
          children: [
            {
              id: 'root_Card_0_Button_0',
              component: 'Button',
              props: { label: 'Get Started', variant: 'primary' },
            },
          ],
        },
      ],
    },
  };
}

/**
 * Sidebar on the left + two columns with chart and table
 * HIERARCHY:
 * RowLayout (root)
 *   ├─ Sidebar
 *   └─ ColumnLayout
 *       └─ RowLayout (two columns)
 *           ├─ Card (chart)
 *           └─ Card (table)
 */
function createSidebarWithColumnsLayout(
  modificationType: 'create' | 'edit' | 'regenerate',
  hasChart: boolean,
  hasTable: boolean
): UIPlan {
  return {
    modificationType,
    root: {
      id: 'root',
      component: 'RowLayout',
      props: { gap: 0, padding: 0 },
      children: [
        {
          id: 'root_Sidebar_0',
          component: 'Sidebar',
          props: { width: 250 },
        },
        {
          id: 'root_ColumnLayout_0',
          component: 'ColumnLayout',
          props: { gap: 0, padding: 0 },
          children: [
            {
              id: 'root_ColumnLayout_0_Navbar_0',
              component: 'Navbar',
              props: { title: 'Dashboard' },
            },
            {
              id: 'root_ColumnLayout_0_RowLayout_0',
              component: 'RowLayout',
              props: { gap: 16, padding: 24 },
              children: [
                {
                  id: 'root_ColumnLayout_0_RowLayout_0_Card_0',
                  component: 'Card',
                  props: { title: hasChart ? 'Analytics' : 'Data', padding: 16 },
                  children: hasChart
                    ? [
                        {
                          id: 'root_ColumnLayout_0_RowLayout_0_Card_0_Chart_0',
                          component: 'Chart',
                          props: {
                            title: 'Performance',
                            data: [
                              { label: 'Jan', value: 45 },
                              { label: 'Feb', value: 60 },
                              { label: 'Mar', value: 75 },
                              { label: 'Apr', value: 65 },
                            ],
                            type: 'bar',
                          },
                        },
                      ]
                    : [],
                },
                {
                  id: 'root_ColumnLayout_0_RowLayout_0_Card_1',
                  component: 'Card',
                  props: { title: hasTable ? 'Recent Data' : 'Content', padding: 16 },
                  children: hasTable
                    ? [
                        {
                          id: 'root_ColumnLayout_0_RowLayout_0_Card_1_Table_0',
                          component: 'Table',
                          props: {
                            columns: [
                              { header: 'Item', key: 'item' },
                              { header: 'Status', key: 'status' },
                              { header: 'Value', key: 'value' },
                            ],
                            data: [
                              { item: 'Item 1', status: 'Active', value: '100' },
                              { item: 'Item 2', status: 'Inactive', value: '80' },
                              { item: 'Item 3', status: 'Active', value: '95' },
                            ],
                          },
                        },
                      ]
                    : [],
                },
              ],
            },
          ],
        },
      ],
    },
  };
}

/**
 * Sidebar + dashboard layout
 */
function createSidebarDashboardLayout(modificationType: 'create' | 'edit' | 'regenerate'): UIPlan {
  return {
    modificationType,
    root: {
      id: 'root',
      component: 'RowLayout',
      props: { gap: 0, padding: 0 },
      children: [
        {
          id: 'root_Sidebar_0',
          component: 'Sidebar',
          props: { width: 250 },
        },
        {
          id: 'root_ColumnLayout_0',
          component: 'ColumnLayout',
          props: { gap: 16, padding: 24 },
          children: [
            {
              id: 'root_ColumnLayout_0_Card_0',
              component: 'Card',
              props: { title: 'Dashboard Overview', padding: 16 },
              children: [
                {
                  id: 'root_ColumnLayout_0_Card_0_Chart_0',
                  component: 'Chart',
                  props: {
                    title: 'Metrics',
                    data: [
                      { label: 'Week 1', value: 40 },
                      { label: 'Week 2', value: 50 },
                      { label: 'Week 3', value: 65 },
                      { label: 'Week 4', value: 75 },
                    ],
                    type: 'line',
                  },
                },
              ],
            },
            {
              id: 'root_ColumnLayout_0_Card_1',
              component: 'Card',
              props: { title: 'Details', padding: 16 },
              children: [
                {
                  id: 'root_ColumnLayout_0_Card_1_Table_0',
                  component: 'Table',
                  props: {
                    columns: [
                      { header: 'Metric', key: 'metric' },
                      { header: 'Value', key: 'value' },
                    ],
                    data: [
                      { metric: 'Users', value: '1,234' },
                      { metric: 'Revenue', value: '$50K' },
                      { metric: 'Growth', value: '15%' },
                    ],
                  },
                },
              ],
            },
          ],
        },
      ],
    },
  };
}

/**
 * Sidebar layout (optionally with navbar)
 */
function createSidebarLayout(
  modificationType: 'create' | 'edit' | 'regenerate',
  hasNavbar: boolean
): UIPlan {
  const mainContent: any[] = hasNavbar
    ? [
        {
          id: 'root_ColumnLayout_0_Navbar_0',
          component: 'Navbar',
          props: { title: 'App' },
        },
        {
          id: 'root_ColumnLayout_0_Card_0',
          component: 'Card',
          props: { title: 'Content', padding: 16 },
          children: [
            {
              id: 'root_ColumnLayout_0_Card_0_Button_0',
              component: 'Button',
              props: { label: 'Get Started', variant: 'primary' },
            },
          ],
        },
      ]
    : [
        {
          id: 'root_ColumnLayout_0_Card_0',
          component: 'Card',
          props: { title: 'Welcome', padding: 16 },
          children: [
            {
              id: 'root_ColumnLayout_0_Card_0_Button_0',
              component: 'Button',
              props: { label: 'Start', variant: 'primary' },
            },
          ],
        },
      ];

  return {
    modificationType,
    root: {
      id: 'root',
      component: 'RowLayout',
      props: { gap: 0, padding: 0 },
      children: [
        {
          id: 'root_Sidebar_0',
          component: 'Sidebar',
          props: { width: 250 },
        },
        {
          id: 'root_ColumnLayout_0',
          component: 'ColumnLayout',
          props: { gap: 16, padding: 24 },
          children: mainContent,
        },
      ],
    },
  };
}

/**
 * Navbar at top + two columns with chart and table
 */
function createNavbarWithColumnsLayout(
  modificationType: 'create' | 'edit' | 'regenerate',
  hasChart: boolean,
  hasTable: boolean
): UIPlan {
  return {
    modificationType,
    root: {
      id: 'root',
      component: 'ColumnLayout',
      props: { gap: 0, padding: 0 },
      children: [
        {
          id: 'root_Navbar_0',
          component: 'Navbar',
          props: { title: 'App' },
        },
        {
          id: 'root_RowLayout_0',
          component: 'RowLayout',
          props: { gap: 16, padding: 24 },
          children: [
            {
              id: 'root_RowLayout_0_Card_0',
              component: 'Card',
              props: { title: hasChart ? 'Analytics' : 'Left Panel', padding: 16 },
              children: hasChart
                ? [
                    {
                      id: 'root_RowLayout_0_Card_0_Chart_0',
                      component: 'Chart',
                      props: {
                        title: 'Trends',
                        data: [
                          { label: 'A', value: 30 },
                          { label: 'B', value: 45 },
                          { label: 'C', value: 55 },
                        ],
                        type: 'pie',
                      },
                    },
                  ]
                : [],
            },
            {
              id: 'root_RowLayout_0_Card_1',
              component: 'Card',
              props: { title: hasTable ? 'Table Data' : 'Right Panel', padding: 16 },
              children: hasTable
                ? [
                    {
                      id: 'root_RowLayout_0_Card_1_Table_0',
                      component: 'Table',
                      props: {
                        columns: [
                          { header: 'Name', key: 'name' },
                          { header: 'Status', key: 'status' },
                        ],
                        data: [
                          { name: 'Item A', status: 'Done' },
                          { name: 'Item B', status: 'Pending' },
                        ],
                      },
                    },
                  ]
                : [],
            },
          ],
        },
      ],
    },
  };
}

/**
 * Navbar + dashboard layout
 */
function createNavbarDashboardLayout(modificationType: 'create' | 'edit' | 'regenerate'): UIPlan {
  return {
    modificationType,
    root: {
      id: 'root',
      component: 'ColumnLayout',
      props: { gap: 0, padding: 0 },
      children: [
        {
          id: 'root_Navbar_0',
          component: 'Navbar',
          props: { title: 'Dashboard' },
        },
        {
          id: 'root_ColumnLayout_0',
          component: 'ColumnLayout',
          props: { gap: 16, padding: 24 },
          children: [
            {
              id: 'root_ColumnLayout_0_Card_0',
              component: 'Card',
              props: { title: 'Overview', padding: 16 },
              children: [
                {
                  id: 'root_ColumnLayout_0_Card_0_Chart_0',
                  component: 'Chart',
                  props: {
                    title: 'Performance',
                    data: [
                      { label: 'Mon', value: 50 },
                      { label: 'Tue', value: 60 },
                      { label: 'Wed', value: 70 },
                      { label: 'Thu', value: 65 },
                      { label: 'Fri', value: 80 },
                    ],
                    type: 'line',
                  },
                },
              ],
            },
          ],
        },
      ],
    },
  };
}

/**
 * Two columns with chart and table side by side
 */
function createTwoColumnsChartTableLayout(modificationType: 'create' | 'edit' | 'regenerate'): UIPlan {
  return {
    modificationType,
    root: {
      id: 'root',
      component: 'ColumnLayout',
      props: { gap: 16, padding: 24 },
      children: [
        {
          id: 'root_RowLayout_0',
          component: 'RowLayout',
          props: { gap: 16, padding: 0 },
          children: [
            {
              id: 'root_RowLayout_0_Card_0',
              component: 'Card',
              props: { title: 'Chart', padding: 16 },
              children: [
                {
                  id: 'root_RowLayout_0_Card_0_Chart_0',
                  component: 'Chart',
                  props: {
                    title: 'Data Visualization',
                    data: [
                      { label: 'Q1', value: 40 },
                      { label: 'Q2', value: 55 },
                      { label: 'Q3', value: 70 },
                      { label: 'Q4', value: 65 },
                    ],
                    type: 'bar',
                  },
                },
              ],
            },
            {
              id: 'root_RowLayout_0_Card_1',
              component: 'Card',
              props: { title: 'Table', padding: 16 },
              children: [
                {
                  id: 'root_RowLayout_0_Card_1_Table_0',
                  component: 'Table',
                  props: {
                    columns: [
                      { header: 'ID', key: 'id' },
                      { header: 'Value', key: 'value' },
                      { header: 'Status', key: 'status' },
                    ],
                    data: [
                      { id: '1', value: '100', status: 'Active' },
                      { id: '2', value: '200', status: 'Active' },
                      { id: '3', value: '150', status: 'Inactive' },
                    ],
                  },
                },
              ],
            },
          ],
        },
      ],
    },
  };
}

/**
 * Two columns layout (generic)
 */
function createTwoColumnsLayout(
  modificationType: 'create' | 'edit' | 'regenerate',
  hasChart: boolean
): UIPlan {
  return {
    modificationType,
    root: {
      id: 'root',
      component: 'RowLayout',
      props: { gap: 16, padding: 24 },
      children: [
        {
          id: 'root_RowLayout_0_Card_0',
          component: 'Card',
          props: { title: 'Left Panel', padding: 16 },
          children: hasChart
            ? [
                {
                  id: 'root_RowLayout_0_Card_0_Chart_0',
                  component: 'Chart',
                  props: {
                    title: 'Analytics',
                    data: [
                      { label: 'Data 1', value: 30 },
                      { label: 'Data 2', value: 45 },
                      { label: 'Data 3', value: 35 },
                    ],
                    type: 'pie',
                  },
                },
              ]
            : [
                {
                  id: 'root_RowLayout_0_Card_0_Button_0',
                  component: 'Button',
                  props: { label: 'Action', variant: 'primary' },
                },
              ],
        },
        {
          id: 'root_RowLayout_0_Card_1',
          component: 'Card',
          props: { title: 'Right Panel', padding: 16 },
          children: [
            {
              id: 'root_RowLayout_0_Card_1_Button_0',
              component: 'Button',
              props: { label: 'Submit', variant: 'primary' },
            },
          ],
        },
      ],
    },
  };
}

function createFormPlan(
  modificationType: 'create' | 'edit' | 'regenerate',
  intent: string
): UIPlan {
  // Parse fields from intent
  const fields = parseFormFields(intent);

  // Extract a title from intent if possible
  let formTitle = 'Form';
  if (/login|sign in/i.test(intent)) {
    formTitle = 'Login';
  } else if (/sign up|register|signup/i.test(intent)) {
    formTitle = 'Register';
  }

  // Build field children
  const cardChildren: any[] = [];

  // Add input fields
  fields.forEach((field, index) => {
    cardChildren.push({
      id: `root_Card_0_Input_${index}`,
      component: 'Input',
      props: {
        label: field.label,
        type: field.type,
        placeholder: field.placeholder,
      },
    });
  });

  // Add submit button
  if (cardChildren.length > 0) {
    const submitLabel = /login|sign in/i.test(intent) ? 'Login' : 'Submit';
    cardChildren.push({
      id: `root_Card_0_Button_0`,
      component: 'Button',
      props: {
        label: submitLabel,
        variant: 'primary',
      },
    });
  }

  return {
    modificationType,
    root: {
      id: 'root',
      component: 'ColumnLayout',
      props: { gap: 16, padding: 24 },
      children: [
        {
          id: 'root_Card_0',
          component: 'Card',
          props: { title: formTitle, padding: 16 },
          children: cardChildren.length > 0 ? cardChildren : undefined,
        },
      ],
    },
  };
}

function createTablePlan(modificationType: 'create' | 'edit' | 'regenerate'): UIPlan {
  return {
    modificationType,
    root: {
      id: 'root',
      component: 'ColumnLayout',
      props: { gap: 16, padding: 24 },
      children: [
        {
          id: 'root_Card_0',
          component: 'Card',
          props: { title: 'Data Table', padding: 16 },
          // Removed: Don't auto-populate with sample data
          // User should specify columns and data they need
        },
      ],
    },
  };
}

function createDashboardPlan(modificationType: 'create' | 'edit' | 'regenerate'): UIPlan {
  return {
    modificationType,
    root: {
      id: 'root',
      component: 'RowLayout',
      props: { gap: 0, padding: 0 },
      children: [
        {
          id: 'root_Sidebar_0',
          component: 'Sidebar',
          props: { width: 250 },
        },
        {
          id: 'root_ColumnLayout_0',
          component: 'ColumnLayout',
          props: { gap: 16, padding: 24 },
          children: [
            {
              id: 'root_ColumnLayout_0_Card_0',
              component: 'Card',
              props: { title: 'Dashboard', padding: 16 },
              children: [
                {
                  id: 'root_ColumnLayout_0_Card_0_Chart_0',
                  component: 'Chart',
                  props: {
                    title: 'Performance',
                    data: [
                      { label: 'Jan', value: 50 },
                      { label: 'Feb', value: 75 },
                      { label: 'Mar', value: 60 },
                    ],
                    type: 'bar',
                  },
                },
              ],
            },
          ],
        },
      ],
    },
  };
}

function createModalPlan(modificationType: 'create' | 'edit' | 'regenerate'): UIPlan {
  return {
    modificationType,
    root: {
      id: 'root',
      component: 'ColumnLayout',
      props: { gap: 16, padding: 24 },
      children: [
        {
          id: 'root_Modal_0',
          component: 'Modal',
          props: {
            isOpen: false,
            title: 'Modal',
          },
          // Removed: Don't auto-populate modal content
          // User should specify what goes in the modal
        },
      ],
    },
  };
}

/**
 * Default simple plan
 */
function createDefaultPlan(modificationType: 'create' | 'edit' | 'regenerate'): UIPlan {
  return {
    modificationType,
    root: {
      id: 'root',
      component: 'ColumnLayout',
      props: { gap: 16, padding: 24 },
      children: [
        {
          id: 'root_Card_0',
          component: 'Card',
          props: { title: 'Welcome', padding: 16 },
          // Card is intentionally empty - user intent was vague, not adding assumptions
        },
      ],
    },
  };
}

// ============================================================================
// SPECIALIZED UI PATTERN PLANS
// ============================================================================

/**
 * Product Card Plan
 * Creates a card with title, description, price, image placeholder, and buy button
 */
function createProductCardPlan(modificationType: 'create' | 'edit' | 'regenerate'): UIPlan {
  return {
    modificationType,
    root: {
      id: 'root',
      component: 'ColumnLayout',
      props: { gap: 16, padding: 24 },
      children: [
        {
          id: 'root_Card_0',
          component: 'Card',
          props: { title: 'Product', padding: 16 },
          children: [
            {
              id: 'root_Card_0_Card_0',
              component: 'Card',
              props: { title: 'Image', padding: 12 },
              // Placeholder for image
            },
            {
              id: 'root_Card_0_Card_1',
              component: 'Card',
              props: { title: 'Product Name', padding: 12 },
            },
            {
              id: 'root_Card_0_Card_2',
              component: 'Card',
              props: { title: '$99.99', padding: 12 },
            },
            {
              id: 'root_Card_0_Button_0',
              component: 'Button',
              props: { label: 'Buy Now', variant: 'primary' },
            },
          ],
        },
      ],
    },
  };
}

/**
 * Profile Card Plan
 * Creates a card displaying user/profile information
 */
function createProfileCardPlan(modificationType: 'create' | 'edit' | 'regenerate'): UIPlan {
  return {
    modificationType,
    root: {
      id: 'root',
      component: 'ColumnLayout',
      props: { gap: 16, padding: 24 },
      children: [
        {
          id: 'root_Card_0',
          component: 'Card',
          props: { title: 'Profile', padding: 16 },
          children: [
            {
              id: 'root_Card_0_Card_0',
              component: 'Card',
              props: { title: 'Avatar Placeholder', padding: 12 },
            },
            {
              id: 'root_Card_0_Card_1',
              component: 'Card',
              props: { title: 'Name', padding: 8 },
            },
            {
              id: 'root_Card_0_Card_2',
              component: 'Card',
              props: { title: 'Contact Info', padding: 8 },
            },
            {
              id: 'root_Card_0_Button_0',
              component: 'Button',
              props: { label: 'View Profile', variant: 'primary' },
            },
          ],
        },
      ],
    },
  };
}

/**
 * Stat Card Plan
 * Creates a card displaying statistics/metrics
 */
function createStatCardPlan(modificationType: 'create' | 'edit' | 'regenerate'): UIPlan {
  return {
    modificationType,
    root: {
      id: 'root',
      component: 'ColumnLayout',
      props: { gap: 16, padding: 24 },
      children: [
        {
          id: 'root_Card_0',
          component: 'Card',
          props: { title: 'Statistics', padding: 16 },
          children: [
            {
              id: 'root_Card_0_Card_0',
              component: 'Card',
              props: { title: 'Metric 1: 1,234', padding: 12 },
            },
            {
              id: 'root_Card_0_Card_1',
              component: 'Card',
              props: { title: 'Metric 2: 5,678', padding: 12 },
            },
            {
              id: 'root_Card_0_Card_2',
              component: 'Card',
              props: { title: 'Metric 3: 9,012', padding: 12 },
            },
          ],
        },
      ],
    },
  };
}

/**
 * Hero Section Plan
 * Creates a large header/banner section
 */
function createHeroSectionPlan(modificationType: 'create' | 'edit' | 'regenerate'): UIPlan {
  return {
    modificationType,
    root: {
      id: 'root',
      component: 'ColumnLayout',
      props: { gap: 16, padding: 0 },
      children: [
        {
          id: 'root_Card_0',
          component: 'Card',
          props: { title: 'Hero Section', padding: 48 },
          children: [
            {
              id: 'root_Card_0_Card_0',
              component: 'Card',
              props: { title: 'Main Heading', padding: 16 },
            },
            {
              id: 'root_Card_0_Card_1',
              component: 'Card',
              props: { title: 'Subheading or Description', padding: 16 },
            },
            {
              id: 'root_Card_0_Button_0',
              component: 'Button',
              props: { label: 'Call to Action', variant: 'primary' },
            },
          ],
        },
      ],
    },
  };
}

/**
 * Gallery Plan
 * Creates a grid layout for displaying multiple items
 */
function createGalleryPlan(modificationType: 'create' | 'edit' | 'regenerate'): UIPlan {
  return {
    modificationType,
    root: {
      id: 'root',
      component: 'GridLayout',
      props: { gap: 16, padding: 24, columns: 3 },
      children: [
        {
          id: 'root_GridLayout_0_Card_0',
          component: 'Card',
          props: { title: 'Item 1', padding: 12 },
        },
        {
          id: 'root_GridLayout_0_Card_1',
          component: 'Card',
          props: { title: 'Item 2', padding: 12 },
        },
        {
          id: 'root_GridLayout_0_Card_2',
          component: 'Card',
          props: { title: 'Item 3', padding: 12 },
        },
      ],
    },
  };
}

/**
 * Testimonial/Review Card Plan
 */
function createTestimonialPlan(modificationType: 'create' | 'edit' | 'regenerate'): UIPlan {
  return {
    modificationType,
    root: {
      id: 'root',
      component: 'ColumnLayout',
      props: { gap: 16, padding: 24 },
      children: [
        {
          id: 'root_Card_0',
          component: 'Card',
          props: { title: 'Testimonial', padding: 16 },
          children: [
            {
              id: 'root_Card_0_Card_0',
              component: 'Card',
              props: { title: 'Review Text', padding: 12 },
            },
            {
              id: 'root_Card_0_Card_1',
              component: 'Card',
              props: { title: '- Author Name', padding: 8 },
            },
          ],
        },
      ],
    },
  };
}

/**
 * Pricing Card Plan
 * Creates a pricing tier card with features and CTA
 */
function createPricingCardPlan(modificationType: 'create' | 'edit' | 'regenerate'): UIPlan {
  return {
    modificationType,
    root: {
      id: 'root',
      component: 'ColumnLayout',
      props: { gap: 16, padding: 24 },
      children: [
        {
          id: 'root_Card_0',
          component: 'Card',
          props: { title: 'Pricing Plan', padding: 16 },
          children: [
            {
              id: 'root_Card_0_Card_0',
              component: 'Card',
              props: { title: 'Standard - $49/month', padding: 12 },
            },
            {
              id: 'root_Card_0_Card_1',
              component: 'Card',
              props: { title: 'Features included', padding: 12 },
            },
            {
              id: 'root_Card_0_Button_0',
              component: 'Button',
              props: { label: 'Subscribe', variant: 'primary' },
            },
          ],
        },
      ],
    },
  };
}

/**
 * Search Bar Plan
 * Creates a card with search input
 */
function createSearchBarPlan(modificationType: 'create' | 'edit' | 'regenerate'): UIPlan {
  return {
    modificationType,
    root: {
      id: 'root',
      component: 'ColumnLayout',
      props: { gap: 16, padding: 24 },
      children: [
        {
          id: 'root_Card_0',
          component: 'Card',
          props: { title: 'Search', padding: 16 },
          children: [
            {
              id: 'root_Card_0_Input_0',
              component: 'Input',
              props: {
                label: 'Search',
                type: 'text',
                placeholder: 'Search...',
              },
            },
            {
              id: 'root_Card_0_Button_0',
              component: 'Button',
              props: { label: 'Search', variant: 'primary' },
            },
          ],
        },
      ],
    },
  };
}

/**
 * Item Card Plan
 * Creates a card for displaying a single item
 */
function createItemCardPlan(modificationType: 'create' | 'edit' | 'regenerate'): UIPlan {
  return {
    modificationType,
    root: {
      id: 'root',
      component: 'ColumnLayout',
      props: { gap: 16, padding: 24 },
      children: [
        {
          id: 'root_Card_0',
          component: 'Card',
          props: { title: 'Item', padding: 16 },
          children: [
            {
              id: 'root_Card_0_Card_0',
              component: 'Card',
              props: { title: 'Item Details', padding: 12 },
            },
            {
              id: 'root_Card_0_Button_0',
              component: 'Button',
              props: { label: 'View Details', variant: 'primary' },
            },
          ],
        },
      ],
    },
  };
}
