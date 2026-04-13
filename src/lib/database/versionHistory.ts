import { supabase } from '../supabase'
import type { TestCase, AppAction, AppState, Feature, GlobalVariable, ReusableUtil, Fixture } from '../../types'
import { createFeature } from './features'
import { createTestCase } from './testCases'
import { createVariable } from './variables'
import { createUtil } from './utils'
import { createFixture } from './fixtures'
import { updateProject } from './projects'

export interface VersionSnapshot {
  id: string
  projectId: string
  testCaseId: string | null
  createdBy: string | null
  snapshotType: 'auto' | 'manual' | 'generation'
  label: string
  changeDescription: string | null
  data: Record<string, unknown>
  isPinned: boolean
  createdAt: string
}

function toVersionSnapshot(row: Record<string, unknown>): VersionSnapshot {
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    testCaseId: row.test_case_id as string | null,
    createdBy: row.created_by as string | null,
    snapshotType: row.snapshot_type as 'auto' | 'manual' | 'generation',
    label: row.label as string,
    changeDescription: row.change_description as string | null,
    data: (row.data ?? {}) as Record<string, unknown>,
    isPinned: row.is_pinned as boolean,
    createdAt: row.created_at as string,
  }
}

export async function createVersionSnapshot(
  projectId: string,
  testCaseId: string | null,
  snapshotType: 'auto' | 'manual' | 'generation',
  label: string,
  data: Record<string, unknown>,
  createdBy: string | null = null,
  changeDescription: string | null = null,
  isPinned = false
): Promise<VersionSnapshot | null> {
  const { data: row, error } = await supabase
    .from('version_history')
    .insert({
      project_id: projectId,
      test_case_id: testCaseId,
      created_by: createdBy,
      snapshot_type: snapshotType,
      label,
      change_description: changeDescription,
      data,
      is_pinned: isPinned,
    })
    .select()
    .single()
  if (error) {
    console.error('[versionHistory] createVersionSnapshot error:', error)
    return null
  }
  return toVersionSnapshot(row)
}

export async function getVersionSnapshots(
  projectId: string,
  testCaseId?: string | null,
  limit = 50
): Promise<VersionSnapshot[]> {
  let query = supabase
    .from('version_history')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (testCaseId !== undefined) {
    if (testCaseId === null) {
      query = query.is('test_case_id', null)
    } else {
      query = query.eq('test_case_id', testCaseId)
    }
  }

  const { data, error } = await query
  if (error) return []
  return (data ?? []).map(toVersionSnapshot)
}

export async function deleteVersionSnapshot(id: string): Promise<void> {
  await supabase.from('version_history').delete().eq('id', id)
}

export async function pinVersionSnapshot(id: string, isPinned: boolean): Promise<void> {
  await supabase.from('version_history').update({ is_pinned: isPinned }).eq('id', id)
}

export async function pruneOldVersionSnapshots(
  projectId: string,
  testCaseId: string | null,
  limit: number
): Promise<void> {
  let query = supabase
    .from('version_history')
    .select('id')
    .eq('project_id', projectId)
    .eq('is_pinned', false)
    .order('created_at', { ascending: false })
    .range(limit, 9999)

  if (testCaseId === null) {
    query = query.is('test_case_id', null)
  } else {
    query = query.eq('test_case_id', testCaseId)
  }

  const { data } = await query
  if (!data || data.length === 0) return
  const ids = data.map((r: Record<string, unknown>) => r.id as string)
  await supabase.from('version_history').delete().in('id', ids)
}

// ── Change label detection ────────────────────────────────────────────────────

export function detectTcChangeLabel(prevTc: TestCase, nextTc: TestCase): string {
  const prevSteps = (prevTc.steps?.length ?? 0) + (prevTc.apiSteps?.length ?? 0)
  const nextSteps = (nextTc.steps?.length ?? 0) + (nextTc.apiSteps?.length ?? 0)
  const stepDiff = nextSteps - prevSteps

  if (prevTc.name !== nextTc.name) return `Renamed to "${nextTc.name}"`
  if (prevTc.priority !== nextTc.priority) return `Changed priority to ${nextTc.priority}`
  if (prevTc.type !== nextTc.type) return `Switched to ${(nextTc.type ?? 'ui').toUpperCase()} mode`
  if (prevTc.disabled !== nextTc.disabled) return nextTc.disabled ? 'Disabled test case' : 'Enabled test case'
  if (JSON.stringify(prevTc.tags) !== JSON.stringify(nextTc.tags)) return 'Updated tags'
  if (JSON.stringify(prevTc.annotations) !== JSON.stringify(nextTc.annotations)) return 'Updated annotations'
  if (prevTc.pageUrl !== nextTc.pageUrl) return 'Changed page URL'
  if (prevTc.authRoleId !== nextTc.authRoleId) return 'Changed auth role'
  if (JSON.stringify(prevTc.viewport) !== JSON.stringify(nextTc.viewport)) return 'Changed viewport'
  if (prevTc.description !== nextTc.description) return 'Updated description'
  if (prevTc.linkedFixture !== nextTc.linkedFixture) return 'Changed linked fixture'

  if (stepDiff > 0) return `Added ${stepDiff} step${stepDiff !== 1 ? 's' : ''}`
  if (stepDiff < 0) return `Removed ${Math.abs(stepDiff)} step${Math.abs(stepDiff) !== 1 ? 's' : ''}`
  if (
    JSON.stringify(prevTc.steps) !== JSON.stringify(nextTc.steps) ||
    JSON.stringify(prevTc.apiSteps) !== JSON.stringify(nextTc.apiSteps)
  ) return 'Edited steps'

  return 'Updated test case'
}

export function detectProjectChangeLabel(action: AppAction): string {
  switch (action.type) {
    case 'UPDATE_PROJECT': return 'Updated project settings'
    case 'CREATE_FEATURE': return `Added feature "${action.feature.name}"`
    case 'UPDATE_FEATURE': return `Updated feature "${action.feature.name}"`
    case 'DELETE_FEATURE': return 'Deleted a feature'
    case 'CREATE_VAR': return `Added variable "${action.variable.key}"`
    case 'UPDATE_VAR': return `Updated variable "${action.variable.key}"`
    case 'DELETE_VAR': return 'Deleted a variable'
    case 'CREATE_UTIL': return `Added util "${action.util.name}"`
    case 'UPDATE_UTIL': return `Updated util "${action.util.name}"`
    case 'DELETE_UTIL': return 'Deleted a util'
    case 'CREATE_FIXTURE': return `Added fixture "${action.fixture.name}"`
    case 'UPDATE_FIXTURE': return `Updated fixture "${action.fixture.name}"`
    case 'DELETE_FIXTURE': return 'Deleted a fixture'
    case 'BULK_DELETE_TC': return `Bulk deleted ${action.tcIds.length} test case${action.tcIds.length !== 1 ? 's' : ''}`
    case 'BULK_MOVE_TC': return `Moved ${action.tcIds.length} test case${action.tcIds.length !== 1 ? 's' : ''}`
    case 'BULK_COPY_TC':
    case 'BULK_DUPLICATE_TC': return `Duplicated ${action.copies.length} test case${action.copies.length !== 1 ? 's' : ''}`
    default: return 'Project updated'
  }
}

export function getProjectIdFromAction(action: AppAction, prevState: AppState): string | null {
  switch (action.type) {
    case 'UPDATE_PROJECT': return action.project.id
    case 'CREATE_FEATURE': return action.feature.projectId
    case 'UPDATE_FEATURE': return action.feature.projectId
    case 'DELETE_FEATURE': return prevState.features.find(f => f.id === action.featureId)?.projectId ?? null
    case 'CREATE_VAR': return action.variable.projectId
    case 'UPDATE_VAR': return action.variable.projectId
    case 'DELETE_VAR': return prevState.variables.find(v => v.id === action.varId)?.projectId ?? null
    case 'CREATE_UTIL': return action.util.projectId
    case 'UPDATE_UTIL': return action.util.projectId
    case 'DELETE_UTIL': return prevState.utils.find(u => u.id === action.utilId)?.projectId ?? null
    case 'CREATE_FIXTURE': return action.fixture.projectId
    case 'UPDATE_FIXTURE': return action.fixture.projectId
    case 'DELETE_FIXTURE': return prevState.fixtures.find(fx => fx.id === action.fixtureId)?.projectId ?? null
    case 'BULK_DELETE_TC': return prevState.testCases.find(tc => action.tcIds.includes(tc.id))?.projectId ?? null
    case 'BULK_MOVE_TC': return prevState.testCases.find(tc => action.tcIds.includes(tc.id))?.projectId ?? null
    case 'BULK_COPY_TC':
    case 'BULK_DUPLICATE_TC': return action.copies[0]?.projectId ?? null
    default: return null
  }
}

export function getProjectSnapshot(projectId: string, state: AppState): Record<string, unknown> {
  return {
    project: state.projects.find(p => p.id === projectId),
    features: state.features.filter(f => f.projectId === projectId),
    testCases: state.testCases.filter(tc => tc.projectId === projectId),
    variables: state.variables.filter(v => v.projectId === projectId),
    utils: state.utils.filter(u => u.projectId === projectId),
    fixtures: state.fixtures.filter(fx => fx.projectId === projectId),
  } as Record<string, unknown>
}

// ── Project restore ───────────────────────────────────────────────────────────

export async function restoreProjectSnapshot(
  projectId: string,
  snapshotData: Record<string, unknown>
): Promise<void> {
  const data = snapshotData as {
    project: import('../../types').Project
    features: Feature[]
    testCases: TestCase[]
    variables: GlobalVariable[]
    utils: ReusableUtil[]
    fixtures: Fixture[]
  }

  // Delete existing data (FK cascades to child tables)
  await supabase.from('features').delete().eq('project_id', projectId)
  await supabase.from('variables').delete().eq('project_id', projectId)
  await supabase.from('utils').delete().eq('project_id', projectId)
  await supabase.from('fixtures').delete().eq('project_id', projectId)

  // Re-create features first (test_cases depend on them)
  for (const f of (data.features ?? [])) {
    await createFeature(f)
  }

  // Re-create everything else
  await Promise.all([
    ...(data.testCases ?? []).map(tc => createTestCase(tc)),
    ...(data.variables ?? []).map(v => createVariable(v)),
    ...(data.utils ?? []).map(u => createUtil(u)),
    ...(data.fixtures ?? []).map(fx => createFixture(fx)),
  ])

  // Update project settings
  if (data.project) {
    await updateProject(data.project)
  }
}
