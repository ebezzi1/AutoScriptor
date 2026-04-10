# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start Vite dev server (localhost:5173)
npm run build      # Type-check (tsc) then bundle with Vite
npm run preview    # Preview the production build
```

No test runner or linter is configured.

## Architecture

This is a **client-side React/TypeScript SPA** that generates Playwright test projects. No backend, no API calls — everything runs in the browser.

### Data Flow

```
User Actions → AppContext (useReducer) → localStorage → UI re-render
                                      ↓
                             codeGenerator.ts + zipBuilder.ts → ZIP download
```

### State Management (`src/store/`)

- **`AppContext.tsx`** — Single global state tree (Projects → Features → TestCases → Steps → Variables/Utils/Fixtures) managed with `useReducer`. All CRUD actions are dispatched here.
- **`storage.ts`** — Serializes/deserializes the full state tree to/from `localStorage` under the key `pw-test-gen-v2`.

### Code Generation (`src/lib/`)

- **`codeGenerator.ts`** — The core engine. Converts the visual test definitions (steps, actions, selectors, assertions) into Playwright TypeScript/JavaScript test code. Supports POM (Page Object Model) generation.
- **`zipBuilder.ts`** — Packages all generated files (playwright.config, spec files, POM classes, .env.test, fixtures) into a downloadable ZIP using `jszip`.

### View Hierarchy

Views in `src/views/` map to navigation states managed in AppContext:

| View | Purpose |
|------|---------|
| `ProjectsList` | Landing — lists all projects |
| `ProjectDashboard` | Lists features/test cases for a project |
| `ProjectSettings` | Configure browser, timeout, language (TS/JS), selector strategy |
| `FeatureView` | Manages test cases within a feature |
| `TestCaseEditor` | Step-by-step editor for building a single test case |
| `UtilsView` | Manage reusable utility functions and data fixtures |

### Component Organization (`src/components/`)

- `common/` — Generic UI primitives: `Btn`, `Modal`, `Field`, `Toast`, `ChipInput`
- `layout/` — `TopBar` and `Sidebar` structural components
- `steps/` — Step-specific editor components
- `StepRow.tsx`, `ActionParamField.tsx`, `OutputPanel.tsx` — Test step building blocks

### Key Type Definitions (`src/types/index.ts`)

Central types: `Project`, `Feature`, `TestCase`, `Step`, `Variable`, `Util`, `Fixture`. Understanding these shapes is essential before modifying the state or code generator.

### Styling

Tailwind CSS with a custom VS Code-inspired dark theme. Custom color tokens use the `vsc-*` prefix (e.g., `vsc-bg`, `vsc-sidebar`). Dark mode is class-based. Monospace fonts: Cascadia Code, Fira Code, JetBrains Mono.

## Context Navigation

When you need to understand the codebase, docs, or any files in this project:
ALWAYS query the knowledge graph first: /graphify query "your question"
Only read raw files if I explicitly say "read the file" or "look at the raw file"
Use graphify-out/wiki/index.md as your navigation entrypoint for browsing structure

