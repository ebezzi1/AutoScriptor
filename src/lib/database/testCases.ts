import { supabase } from '../supabase'
import type { TestCase, Priority, Annotation, SelectorStrategy } from '../../types'
import { toTestStep, fromTestStep, toApiStep, fromApiStep, checkError } from './mapper'

// ── DB → App ─────────────────────────────────────────────────────────────────

export function toTestCase(
  row: Record<string, unknown>,
  steps: ReturnType<typeof toTestStep>[],
  apiSteps: ReturnType<typeof toApiStep>[],
  dependencies: string[]
): TestCase {
  return {
    id: row.id as string,
    featureId: row.feature_id as string,
    projectId: row.project_id as string,
    name: row.name as string,
    description: (row.description as string) ?? '',
    priority: (row.priority as Priority) ?? 'P2',
    tags: (row.tags as string[]) ?? [],
    annotations: (row.annotations as Annotation[]) ?? [],
    viewport: (row.viewport_width != null && row.viewport_height != null)
      ? { width: row.viewport_width as number, height: row.viewport_height as number }
      : null,
    screenshotOnFailure: (row.screenshot_on_failure as boolean) ?? false,
    traceRecording: (row.trace_recording as boolean) ?? false,
    linkedFixture: (row.linked_fixture_id as string | null) ?? undefined,
    pageUrl: (row.page_url as string | null) ?? undefined,
    steps,
    type: (row.test_type as 'ui' | 'api') ?? 'ui',
    apiSteps,
    authRoleId: (row.auth_role_id as string | null) ?? undefined,
    dependencies,
    disabled: (row.is_enabled as boolean) === false ? true : false,
  }
}

function fromTestCase(tc: TestCase): Record<string, unknown> {
  return {
    id: tc.id,
    feature_id: tc.featureId,
    project_id: tc.projectId,
    name: tc.name,
    description: tc.description,
    priority: tc.priority,
    tags: tc.tags,
    annotations: tc.annotations,
    viewport_width: tc.viewport?.width ?? null,
    viewport_height: tc.viewport?.height ?? null,
    screenshot_on_failure: tc.screenshotOnFailure,
    trace_recording: tc.traceRecording,
    linked_fixture_id: tc.linkedFixture ?? null,
    page_url: tc.pageUrl ?? null,
    test_type: tc.type ?? 'ui',
    auth_role_id: tc.authRoleId ?? null,
    is_enabled: !(tc.disabled ?? false),
  }
}

// ── CRUD ─────────────────────────────────────────────────────────────────────

export async function createTestCase(tc: TestCase): Promise<void> {
  checkError(await supabase.from('test_cases').insert(fromTestCase(tc)))
  await upsertChildren(tc)
}

export async function updateTestCase(tc: TestCase): Promise<void> {
  const { error } = await supabase
    .from('test_cases')
    .update(fromTestCase(tc))
    .eq('id', tc.id)
  checkError({ error })
  await upsertChildren(tc)
}

export async function deleteTestCase(tcId: string): Promise<void> {
  // test_steps, api_steps, test_dependencies cascade via FK in DB,
  // but we also clean up reverse dependencies explicitly.
  checkError(await supabase.from('test_cases').delete().eq('id', tcId))
  await supabase.from('test_dependencies').delete().eq('depends_on_id', tcId)
}

export async function bulkDeleteTestCases(tcIds: string[]): Promise<void> {
  if (tcIds.length === 0) return
  checkError(await supabase.from('test_cases').delete().in('id', tcIds))
  await supabase.from('test_dependencies').delete().in('depends_on_id', tcIds)
}

export async function bulkMoveTestCases(
  tcIds: string[],
  targetFeatureId: string
): Promise<void> {
  if (tcIds.length === 0) return
  checkError(
    await supabase
      .from('test_cases')
      .update({ feature_id: targetFeatureId })
      .in('id', tcIds)
  )
}

async function upsertChildren(tc: TestCase): Promise<void> {
  // Replace steps
  await supabase.from('test_steps').delete().eq('test_case_id', tc.id)
  if (tc.steps.length > 0) {
    checkError(
      await supabase
        .from('test_steps')
        .insert(tc.steps.map((s) => fromTestStep(s, 'test_case_id', tc.id)))
    )
  }

  // Replace api_steps
  await supabase.from('api_steps').delete().eq('test_case_id', tc.id)
  if (tc.apiSteps && tc.apiSteps.length > 0) {
    checkError(
      await supabase
        .from('api_steps')
        .insert(tc.apiSteps.map((s) => fromApiStep(s, tc.id)))
    )
  }

  // Replace dependencies
  await supabase.from('test_dependencies').delete().eq('test_case_id', tc.id)
  if (tc.dependencies && tc.dependencies.length > 0) {
    checkError(
      await supabase.from('test_dependencies').insert(
        tc.dependencies.map((depId) => ({
          test_case_id: tc.id,
          depends_on_id: depId,
        }))
      )
    )
  }
}
