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

export type CiPlatform = 'github' | 'gitlab' | 'azure' | 'jenkins'

export interface CiCdConfig {
  platforms: CiPlatform[]
  nodeVersion: '18' | '20' | '22'
  packageManager: 'npm' | 'yarn' | 'pnpm'
  pushBranches: string[]
  pullRequests: boolean
  manualTrigger: boolean
  scheduledCron: string
  shardEnabled: boolean
  shardWorkers: number
}

export const DEFAULT_CICD_CONFIG: CiCdConfig = {
  platforms: ['github'],
  nodeVersion: '20',
  packageManager: 'npm',
  pushBranches: ['main', 'develop'],
  pullRequests: true,
  manualTrigger: true,
  scheduledCron: '',
  shardEnabled: false,
  shardWorkers: 4,
}

export const CI_PLATFORM_META: Record<CiPlatform, { name: string; filename: string; language: 'yaml' | 'groovy' }> = {
  github: { name: 'GitHub Actions', filename: '.github/workflows/playwright.yml', language: 'yaml' },
  gitlab: { name: 'GitLab CI', filename: '.gitlab-ci.yml', language: 'yaml' },
  azure: { name: 'Azure DevOps', filename: 'azure-pipelines.yml', language: 'yaml' },
  jenkins: { name: 'Jenkins', filename: 'Jenkinsfile', language: 'groovy' },
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
  cicd?: CiCdConfig
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
  | 'screenshot.full' | 'screenshot.element' | 'screenshot.clip'
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
  // Visual regression fields (used when action is screenshot.*)
  maxDiffThreshold?: number   // 0–1 ratio, default 0.2
  maskSelectors?: string      // comma-separated CSS selectors for dynamic content
  disableAnimations?: boolean // default true
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
  /** IDs of test cases that must pass before this one runs */
  dependencies?: string[]
  /** When true, excluded from code generation, matrix export, and coverage counts */
  disabled?: boolean
  /** How this test case was created */
  source?: 'manual' | 'ai_generated' | 'imported'
  /** Original requirement text used to generate this TC (AI-generated only) */
  sourceText?: string
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
  | { type: 'HYDRATE'; state: Omit<AppState, 'currentView'> }
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
  | { type: 'BULK_DELETE_TC'; tcIds: string[] }
  | { type: 'BULK_MOVE_TC'; tcIds: string[]; targetFeatureId: string }
  | { type: 'BULK_COPY_TC'; copies: TestCase[] }
  | { type: 'BULK_DUPLICATE_TC'; copies: TestCase[] }
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
  'screenshot.full': 'Full page',
  'screenshot.element': 'Element',
  'screenshot.clip': 'Clip region',
}

export const VISUAL_ACTIONS: ActionType[] = ['screenshot.full', 'screenshot.element', 'screenshot.clip']

// Groups for action dropdown
export const ACTION_GROUPS: { label: string; actions: ActionType[] }[] = [
  { label: 'Interaction', actions: ['click', 'dblclick', 'hover', 'check', 'uncheck'] },
  { label: 'Input', actions: ['fill', 'select', 'press'] },
  { label: 'Navigation', actions: ['navigate', 'scrollTo'] },
  { label: 'Timing', actions: ['wait'] },
  { label: 'Debug', actions: ['screenshot'] },
  { label: 'Visual', actions: ['screenshot.full', 'screenshot.element', 'screenshot.clip'] },
]

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
