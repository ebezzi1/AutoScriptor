# AutoScriptor

A client-side SPA for visually building and exporting Playwright test projects — no backend, no signup, everything runs in the browser.

## What it does

AutoScriptor lets you define projects, features, and test cases through a UI, then generates a ready-to-run Playwright project as a ZIP download. It handles TypeScript/JavaScript output, config generation, Page Object Models, reusable utilities, fixtures, environment profiles, and authentication state — so you can go from zero to a structured test suite without writing boilerplate.

## Features

### Test authoring
- Organize tests into **Projects → Features → Test Cases**
- Step-by-step editor with selector strategies (CSS, XPath, data-testid, role, text, label), actions, assertions, and wait behaviors
- Drag-and-drop step reordering
- **UI test mode** — browser interactions via Playwright locators
- **API test mode** — Postman-style HTTP request editor with params, headers, body (JSON/form-data/raw), response assertions, and variable capture

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
- Multiple named environments (dev, staging, production, etc.) with base URL overrides and per-variable overrides
- Active environment reflected in the code preview and ZIP output

### Reusable utilities & fixtures
- Define parameterized utility functions (shared login flows, navigation helpers, etc.) usable across test cases
- Attach JSON fixtures for data-driven test loops

### Step templates
- Save frequently used step sequences as templates
- Insert them into any test case with one click

## Tech stack

- **React 18** + **TypeScript 5**
- **Vite 5** — build tooling
- **Tailwind CSS 3** — custom VS Code-inspired dark theme (`vsc-*` color tokens)
- **@dnd-kit** — drag-and-drop step reordering
- **jszip** — in-browser ZIP generation
- **highlight.js** — syntax-highlighted code preview
- No backend, no API calls — state lives in `localStorage`

## Getting started

```bash
npm install
npm run dev       # dev server at localhost:5173
npm run build     # type-check + production build
npm run preview   # preview production build
```

## Project structure

```
src/
├── components/
│   ├── api/          # API step editor (ApiStepCard, ApiStepEditor, KVTable)
│   ├── common/       # UI primitives (Btn, Field, Modal, Toast, ChipInput, Toggle)
│   ├── layout/       # TopBar, Sidebar
│   └── steps/        # StepTable
├── lib/
│   ├── codeGenerator.ts     # Core codegen engine
│   ├── apiCodeGenerator.ts  # API test codegen
│   ├── zipBuilder.ts        # Packages files into ZIP
│   └── stepTemplates.ts     # Template persistence
├── store/
│   ├── AppContext.tsx        # Global state (useReducer)
│   └── storage.ts           # localStorage persistence
├── types/
│   ├── index.ts             # All core types
│   └── api.ts               # API step types
└── views/
    ├── ProjectsList.tsx
    ├── ProjectDashboard.tsx
    ├── ProjectSettings.tsx   # Config, environments, auth roles
    ├── FeatureView.tsx
    ├── TestCaseEditor.tsx
    └── UtilsView.tsx
```

## License

MIT
