import type { ApiStep } from './api'
export type { ApiStep }

export interface EnvProfile {
  id: string
  name: string
  baseUrl: string
  variableOverrides: Record<string, string>
  color?: string // custom hex color for non-standard env names
}

/** Returns the hex accent color for an environment based on its name or custom color. */
export function getEnvColor(env: EnvProfile): string {
  const n = env.name.toLowerCase().trim()
  if (['dev', 'development', 'local'].includes(n)) return '#22c55e'
  if (['staging', 'stage', 'qa', 'uat'].includes(n)) return '#f59e0b'
  if (['production', 'prod'].includes(n)) return '#ef4444'
  return env.color ?? '#a855f7'
}

export function toKebab(name: string): string {
  return name.trim().toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'role'
}

export const AUTH_ROLE_COLORS = [
  '#6898cc', '#c89820', '#5db87c', '#e05252', '#a855f7', '#f97316', '#06b6d4', '#ec4899',
]

export interface AuthRole {
  id: string
  name: string
  storageStatePath: string
  color: string
  loginSteps: TestStep[]
}

export interface AuthConfig {
  enabled: boolean
  roles: AuthRole[]
}

export interface Project {
  id: string
  name: string
  description: string
  language: 'javascript' | 'typescript'
  baseUrl: string
  browser: 'chromium' | 'firefox' | 'webkit' | 'all'
  defaultTimeout: number
  selectorStrategy: SelectorStrategy
  retries: number
  reporter: 'html' | 'json' | 'junit' | 'list'
  generatePOM: boolean
  createdAt: string
  updatedAt: string
  environments?: EnvProfile[]
  activeEnvironmentId?: string | null
  auth?: AuthConfig
}

export type SelectorStrategy = 'css' | 'xpath' | 'data-testid' | 'role' | 'text' | 'label'

export interface GlobalVariable {
  id: string
  projectId: string
  key: string
  value: string
  scope: 'project' | 'feature'
  featureId?: string
  sensitive: boolean
  environmentId?: string | null // null/undefined = Base (shared); env id = env-specific
}

export interface UtilParameter {
  name: string
  defaultValue?: string
}

export interface ReusableUtil {
  id: string
  projectId: string
  name: string
  description: string
  parameters: UtilParameter[]
  steps: TestStep[]
  environmentId?: string | null // null/undefined = Base (shared); env id = env-specific
}

export interface Fixture {
  id: string
  projectId: string
  name: string
  data: Record<string, unknown>[]
  environmentId?: string | null // null/undefined = Base (shared); env id = env-specific
}

export interface Feature {
  id: string
  projectId: string
  name: string
  description: string
  tags: string[]
  beforeEachSteps: TestStep[]
  afterEachSteps: TestStep[]
}

export type Priority = 'P0' | 'P1' | 'P2' | 'P3'
export type Annotation = 'slow' | 'skip' | 'fixme'
export type ActionType =
  | 'click' | 'fill' | 'check' | 'uncheck' | 'select'
  | 'hover' | 'dblclick' | 'wait' | 'navigate' | 'screenshot'
  | 'press' | 'scrollTo'
export type AssertionType =
  | 'none' | 'toBeVisible' | 'toBeHidden' | 'toHaveText'
  | 'toHaveValue' | 'toContainText' | 'toBeChecked'
  | 'toBeDisabled' | 'toBeEnabled' | 'toHaveURL' | 'toHaveTitle'

export interface TestStep {
  id: string
  order: number
  selector: string
  selectorStrategy: SelectorStrategy
  action: ActionType
  value: string
  assertion: AssertionType
  assertionValue: string
  waitBehavior: 'auto' | 'networkidle' | 'domcontentloaded' | 'custom'
  waitMs?: number
  utilRef?: string
}

export interface TestCase {
  id: string
  featureId: string
  projectId: string
  name: string
  description: string
  priority: Priority
  tags: string[]
  annotations: Annotation[]
  viewport: { width: number; height: number } | null
  screenshotOnFailure: boolean
  traceRecording: boolean
  linkedFixture?: string
  pageUrl?: string
  steps: TestStep[]
  /** 'ui' (default) or 'api' — optional for backwards compatibility */
  type?: 'ui' | 'api'
  /** Steps for API test mode */
  apiSteps?: ApiStep[]
  /** Auth role assigned to this test case */
  authRoleId?: string
}

// Navigation state
export type AppView =
  | { type: 'projects' }
  | { type: 'project-dashboard'; projectId: string }
  | { type: 'project-settings'; projectId: string }
  | { type: 'feature'; projectId: string; featureId: string }
  | { type: 'test-case'; projectId: string; featureId: string; testCaseId: string }
  | { type: 'utils'; projectId: string }

export interface AppState {
  projects: Project[]
  features: Feature[]
  testCases: TestCase[]
  variables: GlobalVariable[]
  utils: ReusableUtil[]
  fixtures: Fixture[]
  currentView: AppView
}

export type AppAction =
  | { type: 'SET_VIEW'; view: AppView }
  // Projects
  | { type: 'CREATE_PROJECT'; project: Project }
  | { type: 'SET_ACTIVE_ENV'; projectId: string; envId: string | null }
  | { type: 'UPDATE_PROJECT'; project: Project }
  | { type: 'DELETE_PROJECT'; projectId: string }
  // Features
  | { type: 'CREATE_FEATURE'; feature: Feature }
  | { type: 'UPDATE_FEATURE'; feature: Feature }
  | { type: 'DELETE_FEATURE'; featureId: string }
  // Test Cases
  | { type: 'CREATE_TC'; tc: TestCase }
  | { type: 'UPDATE_TC'; tc: TestCase }
  | { type: 'DELETE_TC'; tcId: string }
  | { type: 'DUPLICATE_TC'; tcId: string; newTcId?: string }
  | { type: 'DUPLICATE_TC_TO'; tcId: string; targetFeatureId: string; newTcId: string }
  // Variables
  | { type: 'CREATE_VAR'; variable: GlobalVariable }
  | { type: 'UPDATE_VAR'; variable: GlobalVariable }
  | { type: 'DELETE_VAR'; varId: string }
  // Utils
  | { type: 'CREATE_UTIL'; util: ReusableUtil }
  | { type: 'UPDATE_UTIL'; util: ReusableUtil }
  | { type: 'DELETE_UTIL'; utilId: string }
  // Fixtures
  | { type: 'CREATE_FIXTURE'; fixture: Fixture }
  | { type: 'UPDATE_FIXTURE'; fixture: Fixture }
  | { type: 'DELETE_FIXTURE'; fixtureId: string }

export const ACTION_LABELS: Record<ActionType, string> = {
  click: 'Click',
  fill: 'Fill',
  check: 'Check',
  uncheck: 'Uncheck',
  select: 'Select option',
  hover: 'Hover',
  dblclick: 'Double click',
  wait: 'Wait (ms)',
  navigate: 'Navigate',
  screenshot: 'Screenshot',
  press: 'Press key',
  scrollTo: 'Scroll to',
}

export const ASSERTION_LABELS: Record<AssertionType, string> = {
  none: '— none —',
  toBeVisible: 'Is visible',
  toBeHidden: 'Is hidden',
  toHaveText: 'Has text',
  toHaveValue: 'Has value',
  toContainText: 'Contains text',
  toBeChecked: 'Is checked',
  toBeDisabled: 'Is disabled',
  toBeEnabled: 'Is enabled',
  toHaveURL: 'URL equals',
  toHaveTitle: 'Title equals',
}

export const STRATEGY_LABELS: Record<SelectorStrategy, string> = {
  css: 'CSS',
  xpath: 'XPath',
  'data-testid': 'data-testid',
  role: 'Role',
  text: 'Text',
  label: 'Label',
}

export const PRIORITY_COLORS: Record<Priority, string> = {
  P0: 'bg-red-500/20 text-red-400 border border-red-500/30',
  P1: 'bg-orange-500/20 text-orange-400 border border-orange-500/30',
  P2: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
  P3: 'bg-green-500/20 text-green-400 border border-green-500/30',
}
