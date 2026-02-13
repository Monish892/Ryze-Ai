# Ryze AI - Deterministic UI Generator

A production-ready full-stack application that uses AI agents to generate deterministic, type-safe React UIs from natural language instructions.

## Overview

Ryze AI is a **multi-step deterministic agent pipeline** that converts natural language intent into production-ready React components. The system enforces strict rules around component selection, styling, and determinism to ensure consistent, safe output.

Key Features:
- ✅ **Multi-step Agent Pipeline**: Intent → Plan → Code → Explanation
- ✅ **Deterministic Output**: Same input always produces identical output
- ✅ **Strict Component Whitelist**: Fixed set of 11 allowed components (8 UI + 3 layout)
- ✅ **Type-Safe Validation**: Full TypeScript with Zod schema enforcement
- ✅ **Zero-External-CSS**: All styling via internal React.CSSProperties only
- ✅ **Incremental Edits**: Diff-based updates for edit mode
- ✅ **Comprehensive Safety**: Prompt injection detection, forbidden props validation, whitelist enforcement

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     RYZE AI PIPELINE                             │
└─────────────────────────────────────────────────────────────────┘

User provides intent
    ↓
┌──────────────────────────────────────────────────┐
│ PLANNER AGENT (agent/planner.ts)                │
│ ──────────────────────────────────────────────  │
│ Input: Natural language intent                   │
│ Output: Structured UIPlan (JSON/TypeScript)     │
│ Safety: Prompt injection check                   │
│ Determinism: Hierarchical ID generation         │
└──────────────────────────────────────────────────┘
    ↓
Route: POST /api/plan
    ↓
UIPlan (validated by Zod)
    ↓
┌──────────────────────────────────────────────────┐
│ GENERATOR AGENT (agent/generator.ts)            │
│ ──────────────────────────────────────────────  │
│ Input: UIPlan                                    │
│ Output: Production React TSX code               │
│ Safety: No style/className props allowed         │
│ Validation: Component whitelist check            │
└──────────────────────────────────────────────────┘
    ↓
Route: POST /api/generate
    ↓
React JSX Code
    ↓
┌──────────────────────────────────────────────────┐
│ EXPLAINER AGENT (agent/explainer.ts)            │
│ ──────────────────────────────────────────────  │
│ Input: UIPlan + Optional previous plan          │
│ Output: Markdown explanation of design          │
│ Features: Change diff if edit mode              │
│ Purpose: Human-readable design rationale        │
└──────────────────────────────────────────────────┘
    ↓
Route: POST /api/explain
    ↓
Markdown Explanation
    ↓
┌──────────────────────────────────────────────────┐
│ VERSION STORE (lib/versionStore.ts)             │
│ ──────────────────────────────────────────────  │
│ Stores: Plan + Code + Explanation + Timestamp   │
│ Enables: Rollback to previous versions          │
│ Scope: In-memory, lost on server restart        │
└──────────────────────────────────────────────────┘

Frontend Three-Panel Layout:
┌──────────────┬──────────────┬──────────────┐
│              │              │              │
│  ChatPanel   │  CodePanel   │ PreviewPanel │
│ (input)      │ (edit/diffs) │ (render)     │
│              │              │              │
└──────────────┴──────────────┴──────────────┘
```

---

## Schema Definitions

### UIPlan Structure (Root Entry Point)

```typescript
interface UIPlan {
  modificationType: "create" | "edit" | "regenerate"
  root: LayoutNode  // MUST start with layout component
}

// modifications:
// - "create": First generation, all nodes are new
// - "edit": Incremental update, only changed nodes regenerated
// - "regenerate": Full rewrite allowed (ignores previous plan)
```

### LayoutNode (Container Component)

```typescript
interface LayoutNode {
  id: string                    // Deterministic ID (see Determinism section)
  component: LayoutComponentName // "ColumnLayout" | "RowLayout" | "GridLayout"
  props: {
    gap?: number                // Spacing between children (pixels)
    padding?: number            // Internal padding (pixels)
    columns?: number            // GridLayout only: number of grid columns
  }
  children: (LayoutNode | ComponentNode)[]  // Can nest layouts or UI components
}
```

### ComponentNode (UI Component)

```typescript
interface ComponentNode {
  id: string                    // Deterministic ID (see Determinism section)
  component: UIComponentName    // Button | Card | Input | Table | Modal | Sidebar | Navbar | Chart
  props: Record<string, any>    // Component-specific props
                                // FORBIDDEN PROPS: "style", "className", "css", "dangerouslySetInnerHTML"
  children?: ComponentNode[]    // Nested components only (cannot contain layouts)
}
```

### VersionRecord (History Storage)

```typescript
interface VersionRecord {
  id: string                    // Unique version ID (e.g., "v1699564800000")
  plan: UIPlan                  // The plan at this version
  code: string                  // Generated React TSX code
  explanation: string           // Markdown explanation
  timestamp: number             // Unix timestamp when created
}
```

---

## Component System

### UI Components (8)

Fixed set, no custom components allowed.

| Component | Purpose | Example Props |
|-----------|---------|----------------|
| **Button** | Interactive clickable element | `label`, `onClick`, `variant`, `disabled` |
| **Card** | Container with optional header | `title`, `children` |
| **Input** | Text input field | `placeholder`, `type`, `value`, `onChange` |
| **Table** | Data table with rows/columns | `columns`, `data`, `headers` |
| **Modal** | Dialog overlay | `title`, `isOpen`, `children` |
| **Sidebar** | Side navigation panel | `items`, `activeIndex` |
| **Navbar** | Top navigation bar | `title`, `items`, `logo` |
| **Chart** | Data visualization | `title`, `data`, `type` |

### Layout Components (3)

Required for structural positioning. Root MUST be one of these.

| Component | Purpose | Props |
|-----------|---------|-------|
| **ColumnLayout** | Flexbox column (vertical stacking) | `gap`, `padding`, `children` |
| **RowLayout** | Flexbox row (horizontal stacking) | `gap`, `padding`, `children` |
| **GridLayout** | CSS Grid (responsive) | `gap`, `padding`, `columns`, `children` |

### Export Mechanism

All components exported via whitelist in [components/system/index.ts](components/system/index.ts):

```typescript
export const ALLOWED_COMPONENTS = {
  // UI
  Button,
  Card,
  Input,
  Table,
  Modal,
  Sidebar,
  Navbar,
  Chart,
  // Layout
  ColumnLayout,
  RowLayout,
  GridLayout,
};
```

---

## Deterministic ID Generation

All node IDs are **deterministic, hierarchical, and based on position**, never random.

### Format: `parentId_ComponentName_index`

**Examples:**

```
Root Layout:
  "root_ColumnLayout_0"

First Level Children:
  "root_ColumnLayout_0_Card_0"        (first Card child)
  "root_ColumnLayout_0_Card_1"        (second Card child)
  "root_ColumnLayout_0_Button_0"      (first Button child)

Nested Children:
  "root_ColumnLayout_0_Card_0_Input_0"
  "root_ColumnLayout_0_Card_0_Button_0"
  "root_ColumnLayout_0_Card_0_Button_1"
  "root_ColumnLayout_0_Card_1_Input_0"
```

### Properties:

✅ **Deterministic**: No Math.random(), same structure always generates same IDs
✅ **Hierarchical**: Parent-child relationship encoded in the ID
✅ **Index-based**: Position in parent's children array determines uniqueness
✅ **URL-safe**: Alphanumeric and underscores only (lowercase)
✅ **Readable**: Component name is visible in ID

### Implementation:

See [agent/schema.ts](agent/schema.ts#L9-L11) - `generateDeterministicId()` function:

```typescript
export function generateDeterministicId(
  parentId: string,
  componentName: string,
  index: number
): string {
  return `${parentId}_${componentName}_${index}`.replace(/[^a-z0-9_]/gi, '_').toLowerCase();
}
```

---

## Safety Strategy

### 1. Prompt Injection Detection

**What:** Pre-checks user input for malicious patterns before planning
**Where:** [agent/schema.ts](agent/schema.ts#L168-L180) - `checkPromptInjection()` 
**When:** Called at start of `planUI()` in [agent/planner.ts](agent/planner.ts#L25-L28)
**Patterns (12+):**
- "ignore previous rules"
- "override constraints"
- "bypass validation"
- "add new component"
- "create component"
- "modify component implementation"
- "remove constraint"
- "disable safety"
- "generate css"
- "generate style"
- "use className"
- "use tailwind"
- "use styled"

**Action:** Returns 400 error if pattern detected

### 2. Forbidden Props Validation

**What:** Prevents dangerous or unwanted props from appearing in components
**Where:** [agent/schema.ts](agent/schema.ts#L39-L50) - ComponentNodeSchema with `.refine()`
**When:** On every plan validation, before code generation
**Forbidden Props:**
- ❌ `style` - No inline React.CSSProperties in props
- ❌ `className` - No Tailwind or CSS-in-JS
- ❌ `css` - No CSS injection
- ❌ `dangerouslySetInnerHTML` - No HTML injection

**Validation Points:**
1. Schema validation (Zod `.refine()`)
2. Code generation (explicit check in `nodeToJSX()`)
3. Generator validation (before JSX string creation)

**Action:** Throws validation error with specific message

### 3. Component Whitelist Enforcement

**What:** Only 11 specific components allowed, no dynamic generation
**Where:** [agent/schema.ts](agent/schema.ts#L21-L24) - Component name enums
**When:** During Zod schema parsing, cannot be bypassed
**Whitelist:**

UI (8): Button, Card, Input, Table, Modal, Sidebar, Navbar, Chart
Layout (3): ColumnLayout, RowLayout, GridLayout

**Implementation:** TypeScript enums in Zod (type-safe):

```typescript
const UI_COMPONENT_NAMES = [
  'Button', 'Card', 'Input', 'Table', 
  'Modal', 'Sidebar', 'Navbar', 'Chart'
] as const;

const LAYOUT_COMPONENT_NAMES = [
  'ColumnLayout', 'RowLayout', 'GridLayout'
] as const;

// In schema:
component: z.enum(UI_COMPONENT_NAMES)
```

**Enforcement:** Zod rejects any string not in enum

### 4. Schema Validation (Zod)

**What:** Type-safe validation at every stage
**Where:** [agent/schema.ts](agent/schema.ts)
**Schemas:**
- `UIPlanSchema` - Top-level plan structure
- `LayoutNodeSchema` - Layout container (recursive)
- `ComponentNodeSchema` - UI component
- `VersionRecordSchema` - Version history record

**Validation Granularity:**
- Type checking (component: enum, not string)
- Structure checking (required fields, nesting rules)
- Prop checking (forbidden props via `.refine()`)
- Error messages (specific, actionable)

**Error Format:**
```json
{ "valid": false, "error": "root.props.style: Component props cannot include \"style\"" }
```

### 5. No External Libraries Restriction

**What:** Generator explicitly rejects external styling libraries
**Where:** [agent/generator.ts](agent/generator.ts#L7-L23) - GENERATOR_SYSTEM_PROMPT
**Rejects:**
- ❌ Tailwind CSS
- ❌ styled-components
- ❌ emotion/CSS-in-JS
- ❌ sass/scss
- ❌ postCSS
- ❌ Any external styling

**Uses Only:**
- ✅ Internal `React.CSSProperties` in component implementations
- ✅ Component `props` for data/behavior only

---

## API Reference

### POST /api/plan

Convert natural language intent to structured UIPlan.

**Request:**
```json
{
  "intent": "Create a login form with email and password fields",
  "previousPlan": null
}
```

**Response (Success):**
```json
{
  "plan": {
    "modificationType": "create",
    "root": {
      "id": "root_ColumnLayout_0",
      "component": "ColumnLayout",
      "props": { "gap": 16, "padding": 32 },
      "children": [ ... ]
    }
  }
}
```

**Response (Error):**
```json
{
  "error": "Request violates safety constraints"
}
```

**Errors:**
- 400: Invalid intent, prompt injection detected, or validation failed
- 500: Internal server error

**Route File:** [app/api/plan/route.ts](app/api/plan/route.ts)

### POST /api/generate

Generate production React JSX code from a UIPlan.

**Request:**
```json
{
  "plan": { ... },
  "previousPlan": null
}
```

**Response (Success):**
```json
{
  "code": "'use client';\n\nimport React, { useState } from 'react';\nimport { ColumnLayout, Input, Button } from '@/components/system';\n\nexport default function GeneratedUI() {\n  const [modalOpen, setModalOpen] = useState(false);\n  return (\n    <ColumnLayout gap={16} padding={32}>\n      ...\n    </ColumnLayout>\n  );\n}"
}
```

**Response (Error):**
```json
{
  "error": "Invalid plan: root.component must be ColumnLayout | RowLayout | GridLayout"
}
```

**Validation:**
- Plan structure (Zod validation)
- Component names (whitelist check)
- Forbidden props (explicit check)
- Generated code length (must be > 50 chars)

**Route File:** [app/api/generate/route.ts](app/api/generate/route.ts)

### POST /api/explain

Generate human-readable markdown explanation of a UIPlan.

**Request:**
```json
{
  "plan": { ... },
  "previousPlan": null
}
```

**Response:**
```json
{
  "explanation": "**Layout Structure:**\nThe layout uses a vertical column structure, stacking components from top to bottom. The layout contains 3 components arranged hierarchically.\n\n**Components Used:**\n- **root_ColumnLayout_0_Input_0** (Input): Text input for \"email\"\n- **root_ColumnLayout_0_Input_1** (Input): Text input for \"password\"\n- **root_ColumnLayout_0_Button_0** (Button): Interactive button labeled \"Login\"\n\n**Changes:**\nAdded: root_ColumnLayout_0_Input_0, root_ColumnLayout_0_Input_1\n\n**Tradeoffs:**\nThis layout provides a good balance between functionality and simplicity."
}
```

**Features:**
- Describes layout structure (ColumnLayout vs RowLayout vs GridLayout)
- Lists all components with purposes
- Shows changes if `previousPlan` provided (edit mode)
- Explains design tradeoffs

**Route File:** [app/api/explain/route.ts](app/api/explain/route.ts)

### GET /api/versions

Retrieve all stored versions.

**Response:**
```json
{
  "versions": [
    {
      "id": "v1699564800000",
      "plan": { ... },
      "code": "...",
      "explanation": "...",
      "timestamp": 1699564800000
    }
  ],
  "current": "v1699564800000"
}
```

**Route File:** [app/api/versions/route.ts](app/api/versions/route.ts)

### POST /api/versions

Manage versions (add, set current, delete).

**Request - Add Version:**
```json
{
  "action": "add",
  "plan": { ... },
  "code": "...",
  "explanation": "..."
}
```

**Request - Set Current:**
```json
{
  "action": "setCurrent",
  "versionId": "v1699564800000"
}
```

**Request - Delete:**
```json
{
  "action": "delete",
  "versionId": "v1699564800000"
}
```

**Route File:** [app/api/versions/route.ts](app/api/versions/route.ts)

---

## Usage Examples

### Example 1: Simple Login Form

**User Intent:**
```
"Create a login form with email and password fields, and a submit button"
```

**Generated Plan (abbreviated):**
```typescript
{
  "modificationType": "create",
  "root": {
    "id": "root_ColumnLayout_0",
    "component": "ColumnLayout",
    "props": { "gap": 16, "padding": 32 },
    "children": [
      {
        "id": "root_ColumnLayout_0_Input_0",
        "component": "Input",
        "props": { "placeholder": "Email address", "type": "email" }
      },
      {
        "id": "root_ColumnLayout_0_Input_1",
        "component": "Input",
        "props": { "placeholder": "Password", "type": "password" }
      },
      {
        "id": "root_ColumnLayout_0_Button_0",
        "component": "Button",
        "props": { "label": "Submit", "variant": "primary" }
      }
    ]
  }
}
```

**Generated React Code:**
```typescript
'use client';

import React, { useState } from 'react';
import { ColumnLayout, Input, Button } from '@/components/system';

export default function GeneratedUI() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <ColumnLayout gap={16} padding={32}>
      <Input placeholder="Email address" type="email" />
      <Input placeholder="Password" type="password" />
      <Button label="Submit" variant="primary" />
    </ColumnLayout>
  );
}
```

**Explanation Output:**
```markdown
**Layout Structure:**
The layout uses a vertical column structure, stacking components from top to bottom. 
The layout contains 3 components arranged hierarchically.

**Components Used:**
- **root_ColumnLayout_0_Input_0** (Input): Text input for email
- **root_ColumnLayout_0_Input_1** (Input): Text input for password  
- **root_ColumnLayout_0_Button_0** (Button): Submit button

**Tradeoffs:**
This layout provides a good balance between functionality and simplicity.
```

### Example 2: Dashboard with Sidebar and Table

**User Intent:**
```
"Create a dashboard with a left sidebar navigation and main area showing a data table"
```

**Generated Structure:**
```
root_RowLayout_0
├─ Sidebar (left)
└─ ColumnLayout (right)
   ├─ Navbar
   └─ Table
```

### Example 3: Edit Mode

**Current State:** Login form with email + password + submit button

**User Intent:**
```
"Edit the form - add a name field at the top"
```

**Modification Type:** `edit`

**Changes Made:**
- Added: New Input for name at position 0
- Updated: Shifted existing inputs and button down in index order

---

## Development

### Project Structure

```
Ryze-AI/
├── agent/                      # Core agent pipeline
│   ├── schema.ts               # Zod validation, ID generation, safety
│   ├── planner.ts              # Intent → UIPlan
│   ├── generator.ts            # UIPlan → JSX
│   ├── explainer.ts            # UIPlan → Markdown
│   └── diff.ts                 # Plan comparison
│
├── components/
│   ├── system/                 # Whitelist system components
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Input.tsx
│   │   ├── Table.tsx
│   │   ├── Modal.tsx
│   │   ├── Sidebar.tsx
│   │   ├── Navbar.tsx
│   │   ├── Chart.tsx
│   │   ├── ColumnLayout.tsx    (New: layout component)
│   │   ├── RowLayout.tsx       (New: layout component)
│   │   ├── GridLayout.tsx      (New: layout component)
│   │   └── index.ts            # Whitelist export
│   │
│   ├── ChatPanel.tsx           # Left panel: input & history
│   ├── CodePanel.tsx           # Middle panel: code & versions
│   └── PreviewPanel.tsx        # Right panel: live preview
│
├── app/
│   ├── page.tsx                # Main three-panel UI
│   ├── layout.tsx              # Root layout
│   ├── globals.css             # Global minimal styles
│   └── api/
│       ├── plan/route.ts
│       ├── generate/route.ts
│       ├── explain/route.ts
│       └── versions/route.ts
│
├── lib/
│   └── versionStore.ts         # In-memory version history
│
├── package.json
├── tsconfig.json
├── next.config.js
└── README.md
```

### Installation & Running

```bash
# Install dependencies
npm install

# Development server (http://localhost:3000)
npm run dev

# Production build
npm run build

# Start production server
npm run start

# Type checking
npx tsc --noEmit
```

### Tech Stack

- **Frontend:** Next.js 15.5+, React 19, TypeScript 5+
- **Backend:** Next.js API routes
- **Validation:** Zod
- **Styling:** Internal React.CSSProperties only
- **Build:** Next.js built-in (Webpack + SWC)

---

## Limitations

### Current Implementation

- **In-Memory Storage**: Versions lost on server restart
- **Single User**: No authentication
- **Synchronous Only**: No streaming for large generations
- **Local Only**: No distributed system
- **No Database**: External persistence required

### Component System

- **Fixed Whitelist**: Cannot add components at runtime
- **No Pseudo-Classes**: No hover, focus, active states
- **No Animations**: No CSS transitions/keyframes
- **Limited Props**: Props must be JSON serializable
- **Max Nesting**: ~10 levels practical limit

---

## Future Improvements (With More Time)

✅ **Persistence (Days 1-2)**
- PostgreSQL integration for plan history
- User authentication system
- Multi-tenant support

✅ **Advanced Generation (Days 3-4)**
- Streaming code generation
- Custom hook generation
- Component composition patterns
- TypeScript prop types

✅ **Real-Time (Days 5-6)**
- WebSocket support for collaboration
- Live multiplayer editing
- Conflict resolution
- Change notifications

✅ **Extensibility (Days 7-8)**
- Component registration system
- Theme/style customization
- Plugin architecture
- Icon library integration

✅ **Testing (Days 9-10)**
- Automated test generation
- E2E test creation
- Performance monitoring
- Error tracking (Sentry)

✅ **Product (Days 11-14)**
- Template library
- Component design system
- Export to Figma/Storybook
- Analytics and usage tracking

---

## Constraint Summary (Non-Negotiable)

| Constraint | Enforcement | Violation Result |
|-----------|------------|------------------|
| No style props | Zod + Generator check | Validation error |
| No className | Zod + Generator check | Validation error |
| Fixed 11 components | Zod enum validation | Validation error |
| Deterministic IDs | Function-based generation | Always consistent |
| Forbidden props check | Schema `.refine()` | Validation error |
| Prompt injection check | Pattern matching | 400 error response |
| LayoutNode at root | UIPlanSchema validation | Validation error |
| Lazy evaluation | Zod `.lazy()` | Prevents stack overflow |

---

## Support

- **Schema**: See [agent/schema.ts](agent/schema.ts)
- **Planner**: See [agent/planner.ts](agent/planner.ts)
- **Generator**: See [agent/generator.ts](agent/generator.ts)
- **Explainer**: See [agent/explainer.ts](agent/explainer.ts)
- **Components**: See [components/system/index.ts](components/system/index.ts)

## Version

**Current:** 1.0.0  
**Last Updated:** 2024  
**Status:** Production Ready
