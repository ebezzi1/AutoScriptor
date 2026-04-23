import { supabase } from '../supabase'
import type { AppState, AppAction } from '../../types'
import { toTestStep, toApiStep } from './mapper'
import { toProject, toEnvProfile, toAuthRole, createProject, updateProject, deleteProject } from './projects'
import { toFeature, createFeature, updateFeature, deleteFeature } from './features'
import { toTestCase, createTestCase, updateTestCase, deleteTestCase, bulkDeleteTestCases, bulkMoveTestCases } from './testCases'
import { toVariable, createVariable, updateVariable, deleteVariable } from './variables'
import { toUtil, createUtil, updateUtil, deleteUtil } from './utils'
import { toFixture, createFixture, updateFixture, deleteFixture } from './fixtures'
import { getTemplates } from './templates'
import { initCustomTemplates } from '../stepTemplates'

export * from './projects'
export * from './features'
export * from './testCases'
export * from './variables'
export * from './utils'
export * from './fixtures'
export * from './environments'
export * from './authRoles'
export * from './templates'
export * from './snapshots'
export * from './dependencies'
export * from './preferences'
export * from './versionHistory'
export * from './testRuns'

// ── Full state loader ─────────────────────────────────────────────────────────

export async function loadFullState(
  teamId: string
): Promise<Omit<AppState, 'currentView'>> {
  console.log('[loadFullState] Fetching all tables for team:', teamId)

  const queries = await Promise.all([
    supabase.from('projects').select('*').eq('team_id', teamId),
    supabase.from('environments').select('*'),
    supabase.from('auth_roles').select('*'),
    supabase.from('auth_role_steps').select('*').order('sort_order'),
    supabase.from('features').select('*'),
    supabase.from('feature_setup_steps').select('*').order('sort_order'),
    supabase.from('test_cases').select('*'),
    supabase.from('test_steps').select('*').order('sort_order'),
    supabase.from('api_steps').select('*').order('sort_order'),
    supabase.from('test_dependencies').select('*'),
    supabase.from('variables').select('*'),
    supabase.from('utils').select('*'),
    supabase.from('util_steps').select('*').order('sort_order'),
    supabase.from('fixtures').select('*'),
  ])

  const tableNames = [
    'projects', 'environments', 'auth_roles', 'auth_role_steps',
    'features', 'feature_setup_steps', 'test_cases', 'test_steps',
    'api_steps', 'test_dependencies', 'variables', 'utils',
    'util_steps', 'fixtures',
  ]

  for (let i = 0; i < queries.length; i++) {
    const { error } = queries[i]
    if (error) {
      console.error(`[loadFullState] ❌ Query failed on table '${tableNames[i]}':`, error.message, error)
      throw new Error(`${tableNames[i]}: ${error.message}`)
    }
    console.log(`[loadFullState] ✅ ${tableNames[i]}: ${queries[i].data?.length ?? 0} rows`)
  }

  const [
    { data: projectRows },
    { data: envRows },
    { data: roleRows },
    { data: roleStepRows },
    { data: featureRows },
    { data: setupStepRows },
    { data: tcRows },
    { data: stepRows },
    { data: apiStepRows },
    { data: depRows },
    { data: varRows },
    { data: utilRows },
    { data: utilStepRows },
    { data: fixtureRows },
  ] = queries

  type Row = Record<string, unknown>

  console.log('[loadFullState] Assembling data...')

  // Assemble projects
  const projects = (projectRows as Row[] ?? []).map((p) => {
    try {
      const envs = (envRows as Row[] ?? [])
        .filter((e) => e.project_id === p.id)
        .map(toEnvProfile)
      const roles = (roleRows as Row[] ?? [])
        .filter((r) => r.project_id === p.id)
        .map((r) => {
          const loginSteps = (roleStepRows as Row[] ?? [])
            .filter((s) => s.auth_role_id === r.id)
            .map(toTestStep)
          return toAuthRole(r, loginSteps)
        })
      return toProject(p, envs, roles)
    } catch (err) {
      console.error('[loadFullState] ❌ Failed mapping project row:', p, err)
      throw err
    }
  })

  // Assemble features
  const features = (featureRows as Row[] ?? []).map((f) => {
    try {
      const before = (setupStepRows as Row[] ?? [])
        .filter((s) => s.feature_id === f.id && s.hook === 'before_each')
        .map(toTestStep)
      const after = (setupStepRows as Row[] ?? [])
        .filter((s) => s.feature_id === f.id && s.hook === 'after_each')
        .map(toTestStep)
      return toFeature(f, before, after)
    } catch (err) {
      console.error('[loadFullState] ❌ Failed mapping feature row:', f, err)
      throw err
    }
  })

  // Assemble test cases
  const testCases = (tcRows as Row[] ?? []).map((tc) => {
    try {
      const steps = (stepRows as Row[] ?? [])
        .filter((s) => s.test_case_id === tc.id)
        .map(toTestStep)
      const apiSteps = (apiStepRows as Row[] ?? [])
        .filter((s) => s.test_case_id === tc.id)
        .map(toApiStep)
      const deps = (depRows as Row[] ?? [])
        .filter((d) => d.test_case_id === tc.id)
        .map((d) => d.depends_on_id as string)
      return toTestCase(tc, steps, apiSteps, deps)
    } catch (err) {
      console.error('[loadFullState] ❌ Failed mapping test_case row:', tc, err)
      throw err
    }
  })

  // Assemble utils
  const utils = (utilRows as Row[] ?? []).map((u) => {
    try {
      const steps = (utilStepRows as Row[] ?? [])
        .filter((s) => s.util_id === u.id)
        .map(toTestStep)
      return toUtil(u, steps)
    } catch (err) {
      console.error('[loadFullState] ❌ Failed mapping util row:', u, err)
      throw err
    }
  })

  const variables = (varRows as Row[] ?? []).map((v) => {
    try { return toVariable(v) }
    catch (err) { console.error('[loadFullState] ❌ Failed mapping variable row:', v, err); throw err }
  })

  const fixtures = (fixtureRows as Row[] ?? []).map((fx) => {
    try { return toFixture(fx) }
    catch (err) { console.error('[loadFullState] ❌ Failed mapping fixture row:', fx, err); throw err }
  })

  console.log('[loadFullState] ✅ Assembly complete:', {
    projects: projects.length, features: features.length,
    testCases: testCases.length, variables: variables.length,
    utils: utils.length, fixtures: fixtures.length,
  })

  // Seed step-template cache from DB (per project, non-blocking)
  const projectIds = projects.map((p) => p.id)
  Promise.all(
    projectIds.map((pid) =>
      getTemplates(pid)
        .then((templates) => initCustomTemplates(pid, templates))
        .catch(() => {/* non-fatal */})
    )
  )

  return { projects, features, testCases, variables, utils, fixtures }
}

// ── Action → DB sync ──────────────────────────────────────────────────────────

/**
 * Syncs a dispatched action to Supabase. Called after the optimistic state
 * update so that `nextState` contains the result of the action.
 */
export async function syncAction(
  action: AppAction,
  teamId: string,
  prevState: AppState,
  nextState: AppState
): Promise<void> {
  switch (action.type) {
    // No-op for navigation
    case 'SET_VIEW':
      return

    // ── Projects ────────────────────────────────────────────────────────────
    case 'CREATE_PROJECT':
      await createProject(action.project, teamId)
      return

    case 'UPDATE_PROJECT':
      await updateProject(action.project)
      return

    case 'DELETE_PROJECT':
      await deleteProject(action.projectId)
      return

    case 'SET_ACTIVE_ENV':
      await supabase
        .from('projects')
        .update({ active_environment_id: action.envId })
        .eq('id', action.projectId)
      return

    // ── Features ─────────────────────────────────────────────────────────────
    case 'CREATE_FEATURE':
      await createFeature(action.feature)
      return

    case 'UPDATE_FEATURE':
      await updateFeature(action.feature)
      return

    case 'DELETE_FEATURE':
      await deleteFeature(action.featureId)
      return

    // ── Test Cases ───────────────────────────────────────────────────────────
    case 'CREATE_TC':
      await createTestCase(action.tc)
      return

    case 'UPDATE_TC':
      await updateTestCase(action.tc)
      return

    case 'DELETE_TC':
      await deleteTestCase(action.tcId)
      return

    case 'BULK_DELETE_TC':
      await bulkDeleteTestCases(action.tcIds)
      return

    case 'BULK_MOVE_TC':
      await bulkMoveTestCases(action.tcIds, action.targetFeatureId)
      return

    // For duplicate/copy actions, diff old vs new testCases to find new TCs
    case 'DUPLICATE_TC':
    case 'DUPLICATE_TC_TO': {
      const prevIds = new Set(prevState.testCases.map((tc) => tc.id))
      const newTcs = nextState.testCases.filter((tc) => !prevIds.has(tc.id))
      await Promise.all(newTcs.map(createTestCase))
      return
    }

    case 'BULK_COPY_TC':
    case 'BULK_DUPLICATE_TC': {
      await Promise.all(action.copies.map(createTestCase))
      return
    }

    // ── Variables ────────────────────────────────────────────────────────────
    case 'CREATE_VAR':
      await createVariable(action.variable)
      return

    case 'UPDATE_VAR':
      await updateVariable(action.variable)
      return

    case 'DELETE_VAR':
      await deleteVariable(action.varId)
      return

    // ── Utils ────────────────────────────────────────────────────────────────
    case 'CREATE_UTIL':
      await createUtil(action.util)
      return

    case 'UPDATE_UTIL':
      await updateUtil(action.util)
      return

    case 'DELETE_UTIL':
      await deleteUtil(action.utilId)
      return

    // ── Fixtures ─────────────────────────────────────────────────────────────
    case 'CREATE_FIXTURE':
      await createFixture(action.fixture)
      return

    case 'UPDATE_FIXTURE':
      await updateFixture(action.fixture)
      return

    case 'DELETE_FIXTURE':
      await deleteFixture(action.fixtureId)
      return

    default:
      return
  }
}
