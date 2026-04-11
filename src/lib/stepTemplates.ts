import type { TestStep, ActionType, AssertionType, SelectorStrategy } from '../types'

export type StepBlueprint = Omit<TestStep, 'id' | 'order'>

export interface StepTemplate {
  id: string
  name: string
  description: string
  steps: StepBlueprint[]
  builtin: boolean
  createdAt: string
}

function bp(
  action: ActionType,
  selector: string,
  value: string,
  assertion: AssertionType = 'none',
  assertionValue = '',
  selectorStrategy: SelectorStrategy = 'css',
  waitBehavior: TestStep['waitBehavior'] = 'auto'
): StepBlueprint {
  return { selector, selectorStrategy, action, value, assertion, assertionValue, waitBehavior }
}

export const BUILTIN_TEMPLATES: StepTemplate[] = [
  {
    id: 'builtin-login',
    name: 'Login Flow',
    description: 'Fill email, fill password, click submit button',
    builtin: true,
    createdAt: '',
    steps: [
      bp('fill', '#email', 'user@example.com'),
      bp('fill', '#password', 'password123'),
      bp('click', '[type="submit"]', ''),
    ],
  },
  {
    id: 'builtin-form',
    name: 'Form Submission',
    description: 'Fill input, click submit, assert success message visible',
    builtin: true,
    createdAt: '',
    steps: [
      bp('fill', '#input', 'value'),
      bp('click', '[type="submit"]', ''),
      bp('click', '.success-message', '', 'toBeVisible'),
    ],
  },
  {
    id: 'builtin-navigation',
    name: 'Navigation',
    description: 'Navigate to URL, wait, assert page heading text',
    builtin: true,
    createdAt: '',
    steps: [
      bp('navigate', '', 'https://example.com'),
      bp('wait', '', '1000'),
      bp('click', 'h1', '', 'toHaveText', 'Page Title'),
    ],
  },
  {
    id: 'builtin-search',
    name: 'Search',
    description: 'Fill search input, press Enter, assert results visible',
    builtin: true,
    createdAt: '',
    steps: [
      bp('fill', '#search-input', 'search term'),
      bp('press', '#search-input', 'Enter'),
      bp('click', '.search-results', '', 'toBeVisible'),
    ],
  },
  {
    id: 'builtin-dropdown',
    name: 'Dropdown Select',
    description: 'Click dropdown trigger, select option, assert value',
    builtin: true,
    createdAt: '',
    steps: [
      bp('click', '.dropdown-trigger', ''),
      bp('select', 'select#dropdown', 'option-value'),
      bp('click', 'select#dropdown', '', 'toHaveValue', 'option-value'),
    ],
  },
  {
    id: 'builtin-upload',
    name: 'File Upload',
    description: 'Click file input, click upload button, assert confirmation',
    builtin: true,
    createdAt: '',
    steps: [
      bp('click', 'input[type="file"]', ''),
      bp('click', '#upload-btn', ''),
      bp('click', '.upload-success', '', 'toBeVisible'),
    ],
  },
  {
    id: 'builtin-modal',
    name: 'Modal Interaction',
    description: 'Click modal trigger, wait, assert modal is visible',
    builtin: true,
    createdAt: '',
    steps: [
      bp('click', '#modal-trigger', ''),
      bp('wait', '', '500'),
      bp('click', '.modal', '', 'toBeVisible'),
    ],
  },
]

// ── In-memory cache (populated from Supabase on app load) ────────────────────
const cache = new Map<string, StepTemplate[]>()

/** Called by the DB loader after fetching templates from Supabase. */
export function initCustomTemplates(projectId: string, templates: StepTemplate[]): void {
  cache.set(projectId, templates.filter((t) => !t.builtin))
}

export function getCustomTemplates(projectId: string): StepTemplate[] {
  return cache.get(projectId) ?? []
}

export function saveCustomTemplate(projectId: string, template: StepTemplate): void {
  const existing = cache.get(projectId) ?? []
  const idx = existing.findIndex((t) => t.id === template.id)
  if (idx >= 0) existing[idx] = template
  else existing.push(template)
  cache.set(projectId, existing)
  // Async sync to Supabase (non-blocking)
  import('./database/templates').then(({ upsertTemplate }) =>
    upsertTemplate(projectId, template).catch(console.error)
  )
}

export function deleteCustomTemplate(projectId: string, templateId: string): void {
  cache.set(
    projectId,
    (cache.get(projectId) ?? []).filter((t) => t.id !== templateId)
  )
  // Async delete from Supabase (non-blocking)
  import('./database/templates').then(({ removeTemplate }) =>
    removeTemplate(templateId).catch(console.error)
  )
}

/** Materialise blueprint steps into real TestStep objects starting at `startOrder` */
export function instantiateTemplate(blueprints: StepBlueprint[], startOrder: number): TestStep[] {
  return blueprints.map((bp, i) => ({
    ...bp,
    id: crypto.randomUUID(),
    order: startOrder + i,
  }))
}
