# AutoScriptor

A full-stack SPA for visually building and exporting Playwright test projects. Define projects, features, and test cases through a clean UI — AutoScriptor generates a ready-to-run Playwright project as a ZIP download.

## What it does

AutoScriptor lets you build structured test suites without writing boilerplate. It handles TypeScript/JavaScript output, config generation, Page Object Models, reusable utilities, fixtures, environment profiles, CI/CD pipelines, and authentication state — all through a visual editor backed by Supabase.

## Features

### Test authoring
- Organize tests into **Projects → Features → Test Cases**
- Step-by-step editor with selector strategies (CSS, XPath, data-testid, role, text, label), actions, assertions, and wait behaviors
- Drag-and-drop step reordering, bulk operations (move, copy, duplicate, delete)
- **UI test mode** — browser interactions via Playwright locators
- **API test mode** — Postman-style HTTP request editor with params, headers, body (JSON/form-data/raw), response assertions, and variable capture
- Project cards show colored browser/language badges (Chromium=green, Firefox=orange, WebKit=blue, All=purple; TS=blue, JS=yellow) with feature/test counts

### Code generation
- Outputs TypeScript or JavaScript
- Generates `playwright.config`, spec files, `.env.test`, constants, util helpers, fixture JSON files
- Optional **Page Object Model** generation
- Live **code preview** panel per test case
- One-click **ZIP download** of the full project

### Authentication state
- Define named auth roles (admin, viewer, editor, etc.) each with their own login steps and `storageState` path
- Generates a `global-setup` file that logs in once per role and saves browser state
- Single role: injects `storageState` globally in the config
- Multiple roles: generates a per-role `projects` array; spec files group tests under `test.describe` with `test.use({ storageState })`

### Environment profiles
- Multiple named environments (dev, staging, production) with base URL and per-variable overrides
- Active environment reflected in the code preview and ZIP output

### CI/CD generation
- Generates pipeline configs for GitHub Actions, GitLab CI, Azure DevOps, and Jenkins
- Configurable Node version, package manager, branch triggers, scheduled cron, and test sharding

### Reusable utilities & fixtures
- Parameterized utility functions (shared login flows, navigation helpers) usable across test cases
- JSON fixtures for data-driven test loops

### Step templates
- Save frequently used step sequences as named templates
- Insert them into any test case with one click

## Tech stack

- **React 18** + **TypeScript 5**
- **Vite 5** — build tooling
- **Tailwind CSS 3** — Notion/Monday.com-inspired adaptive theme (`vsc-*` design tokens, light + dark mode)
- **Supabase** — auth (email/password) and Postgres database for persistent team workspaces
- **@dnd-kit** — drag-and-drop step reordering
- **jszip** — in-browser ZIP generation
- **highlight.js** — syntax-highlighted code preview
- **lucide-react** — icon set
- **Plus Jakarta Sans** — UI typography; **JetBrains Mono** — code

## Getting started

```bash
npm install
npm run dev       # dev server at localhost:5173
npm run build     # type-check + production build
npm run preview   # preview production build
```

### Environment variables

Create a `.env` file at the project root:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Architecture

```
src/
├── components/
│   ├── api/          # API step editor (ApiStepCard, ApiStepEditor, KVTable)
│   ├── auth/         # AuthProvider, LoginPage
│   ├── common/       # UI primitives (Btn, Field, Modal, Toast, ChipInput, Toggle)
│   ├── layout/       # TopBar (with theme toggle), Sidebar
│   └── steps/        # StepTable
├── lib/
│   ├── database/     # Supabase data access layer (per-entity CRUD + loadFullState)
│   ├── codeGenerator.ts     # Core codegen engine
│   ├── apiCodeGenerator.ts  # API test codegen
│   ├── zipBuilder.ts        # Packages files into ZIP
│   └── stepTemplates.ts     # Template cache (sync API, async Supabase sync)
├── store/
│   ├── AppContext.tsx        # Global state (useReducer + optimistic Supabase sync)
│   └── ThemeContext.tsx      # Light / Dark / System theme with localStorage persistence
├── types/
│   ├── index.ts             # All core types
│   └── api.ts               # API step types
└── views/
    ├── ProjectsList.tsx
    ├── ProjectDashboard.tsx
    ├── ProjectSettings.tsx   # Config, environments, auth roles, CI/CD
    ├── FeatureView.tsx
    ├── TestCaseEditor.tsx
    └── UtilsView.tsx
```

### Data flow

```
User action → dispatch (optimistic update) → UI re-render
                                           ↓
                               syncAction → Supabase DB
                               (on error: revert via loadFullState)
```

### State persistence

All state lives in Supabase under a team-scoped workspace. The app loads the full state on login via a single parallel `Promise.all` across 14 tables, assembles the in-memory tree, then syncs individual actions to the DB optimistically.

## License

MIT
