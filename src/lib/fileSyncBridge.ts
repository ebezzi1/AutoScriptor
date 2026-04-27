/**
 * File Sync Bridge
 *
 * Fire-and-forget sync after DB saves. Generates code for changed
 * entities and pushes them to disk via the SyncEngine. Silently
 * skips if agent is disconnected or project has no directory.
 */

import type { AppState, AppAction } from '../types'
import { AgentClientService } from '../services/agentClient'
import { SyncEngine } from '../services/syncEngine'
import {
  generateSpecFile,
  generateConfig,
  generateConstants,
  generateEnvFile,
  generateUtilHelper,
  generateFixtureFile,
} from './codeGenerator'

// ── Helpers ───────────────────────────────────────────────────────────────────

function slug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

function getExtension(language: 'typescript' | 'javascript'): string {
  return language === 'typescript' ? 'ts' : 'js'
}

/**
 * Resolves project, agentUrl, agentToken from state + localStorage.
 * Returns null if sync should be skipped.
 */
function resolveProject(projectId: string, state: AppState) {
  const project = state.projects.find((p) => p.id === projectId)
  if (!project) return null
  if (!project.localDirectory) return null
  if (!project.agentUrl || !project.agentToken) return null
  return project
}

function makeEngine(project: { agentUrl?: string; agentToken?: string }, projectId: string): SyncEngine | null {
  if (!project.agentUrl || !project.agentToken) return null
  const agentSvc = new AgentClientService({
    baseUrl: project.agentUrl,
    token: project.agentToken,
  })
  return new SyncEngine(agentSvc, projectId)
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Called after a successful DB sync. Determines what files changed
 * and syncs them to disk. Completely fire-and-forget — errors are
 * logged but never thrown.
 */
export async function syncAfterAction(
  action: AppAction,
  state: AppState
): Promise<void> {
  try {
    switch (action.type) {
      case 'CREATE_TC':
      case 'UPDATE_TC':
        await syncTestCase(action.tc.projectId, action.tc.id, state)
        break

      case 'CREATE_UTIL':
      case 'UPDATE_UTIL':
        await syncUtil(action.util.projectId, action.util.id, state)
        break

      case 'CREATE_FIXTURE':
      case 'UPDATE_FIXTURE':
        await syncFixture(action.fixture.projectId, action.fixture.id, state)
        break

      case 'UPDATE_PROJECT':
        await syncProjectConfig(action.project.id, state)
        break

      case 'CREATE_VAR':
      case 'UPDATE_VAR':
        await syncVariables(action.variable.projectId, state)
        break

      case 'DELETE_VAR':
        // Find project from remaining vars — can't determine from deleted id alone
        // Skip sync on delete; next TC/config save will update
        break

      default:
        // No file sync needed for other actions
        break
    }
  } catch (err) {
    console.warn('[fileSyncBridge] sync skipped:', (err as Error).message)
  }
}

// ── Entity-specific sync ──────────────────────────────────────────────────────

async function syncTestCase(
  projectId: string,
  tcId: string,
  state: AppState
): Promise<void> {
  const project = resolveProject(projectId, state)
  if (!project) return
  const engine = makeEngine(project, projectId)
  if (!engine) return

  const tc = state.testCases.find((t) => t.id === tcId)
  if (!tc || tc.disabled) return

  const feature = state.features.find((f) => f.id === tc.featureId)
  if (!feature) return

  const vars = state.variables.filter((v) => v.projectId === projectId && !v.environmentId)
  const utils = state.utils.filter((u) => u.projectId === projectId && !u.environmentId)
  const fixtures = state.fixtures.filter((fx) => fx.projectId === projectId && !fx.environmentId)
  const featureTCs = state.testCases.filter(
    (t) => t.featureId === feature.id && !t.disabled
  )

  const ext = getExtension(project.language)
  const content = generateSpecFile(feature, featureTCs, vars, utils, fixtures, project)
  const filePath = `tests/${slug(feature.name)}/${slug(feature.name)}.spec.${ext}`

  await engine.syncFile(filePath, content)
}

async function syncUtil(
  projectId: string,
  utilId: string,
  state: AppState
): Promise<void> {
  const project = resolveProject(projectId, state)
  if (!project) return
  const engine = makeEngine(project, projectId)
  if (!engine) return

  const util = state.utils.find((u) => u.id === utilId)
  if (!util) return

  const vars = state.variables.filter((v) => v.projectId === projectId && !v.environmentId)
  const ext = getExtension(project.language)
  const content = generateUtilHelper(util, vars, project.language)
  const filePath = `utils/${util.name}.helper.${ext}`

  await engine.syncFile(filePath, content)
}

async function syncFixture(
  projectId: string,
  fixtureId: string,
  state: AppState
): Promise<void> {
  const project = resolveProject(projectId, state)
  if (!project) return
  const engine = makeEngine(project, projectId)
  if (!engine) return

  const fixture = state.fixtures.find((fx) => fx.id === fixtureId)
  if (!fixture) return

  const content = generateFixtureFile(fixture)
  const filePath = `fixtures/${slug(fixture.name)}.json`

  await engine.syncFile(filePath, content)
}

async function syncProjectConfig(
  projectId: string,
  state: AppState
): Promise<void> {
  const project = resolveProject(projectId, state)
  if (!project) return
  const engine = makeEngine(project, projectId)
  if (!engine) return

  const content = generateConfig(project)
  await engine.syncFile('playwright.config.ts', content)
}

async function syncVariables(
  projectId: string,
  state: AppState
): Promise<void> {
  const project = resolveProject(projectId, state)
  if (!project) return
  const engine = makeEngine(project, projectId)
  if (!engine) return

  const vars = state.variables.filter((v) => v.projectId === projectId && !v.environmentId)

  // Sync .env.test
  const envContent = generateEnvFile(vars)
  await engine.syncFile('.env.test', envContent)

  // Sync constants file
  const ext = getExtension(project.language)
  const constContent = generateConstants(vars, project.language)
  await engine.syncFile(`utils/constants.${ext}`, constContent)
}
