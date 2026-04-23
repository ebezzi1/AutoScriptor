import { supabase } from '../supabase'
import type { TestRun, TestRunResult, TestResultStatus } from '../../types'
import type { ParsedResults } from '../agent'

// ── DB → App mappers ────────────────────────────────────────────────────────

function toTestRun(row: Record<string, unknown>): TestRun {
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    command: (row.command as string) ?? '',
    environment: (row.environment as string) ?? undefined,
    status: (row.status as TestRun['status']) ?? 'running',
    total: (row.total as number) ?? 0,
    passed: (row.passed as number) ?? 0,
    failed: (row.failed as number) ?? 0,
    skipped: (row.skipped as number) ?? 0,
    duration: (row.duration as number) ?? 0,
    createdAt: row.created_at as string,
    finishedAt: (row.finished_at as string) ?? undefined,
    userId: (row.user_id as string) ?? undefined,
    userName: (row.user_name as string) ?? undefined,
  }
}

function toTestRunResult(row: Record<string, unknown>): TestRunResult {
  return {
    id: row.id as string,
    testRunId: row.test_run_id as string,
    testName: (row.test_name as string) ?? '',
    filePath: (row.file_path as string) ?? '',
    featureName: (row.feature_name as string) ?? '',
    status: (row.status as TestResultStatus) ?? 'skipped',
    duration: (row.duration as number) ?? 0,
    error: (row.error as string) ?? undefined,
    errorStack: (row.error_stack as string) ?? undefined,
    screenshotPath: (row.screenshot_path as string) ?? undefined,
    testCaseId: (row.test_case_id as string) ?? undefined,
  }
}

// ── CRUD ─────────────────────────────────────────────────────────────────────

export async function createTestRun(
  projectId: string,
  command: string,
  environment?: string,
  userId?: string,
  userName?: string
): Promise<TestRun> {
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const row = {
    id,
    project_id: projectId,
    command,
    environment: environment ?? null,
    status: 'running',
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    duration: 0,
    created_at: now,
    finished_at: null,
    user_id: userId ?? null,
    user_name: userName ?? null,
  }
  const { error } = await supabase.from('test_runs').insert(row)
  if (error) console.error('[testRuns] createTestRun error:', error.message)
  return toTestRun(row)
}

export async function finishTestRun(
  runId: string,
  results: ParsedResults,
  projectId: string,
  features: { id: string; name: string }[],
  testCases: { id: string; name: string; featureId: string }[]
): Promise<{ run: TestRun; results: TestRunResult[] }> {
  const status = results.failed > 0 ? 'failed' : 'passed'
  const now = new Date().toISOString()

  // Update the run record
  const { error: updateErr } = await supabase
    .from('test_runs')
    .update({
      status,
      total: results.total,
      passed: results.passed,
      failed: results.failed,
      skipped: results.skipped,
      duration: results.duration,
      finished_at: now,
    })
    .eq('id', runId)
  if (updateErr) console.error('[testRuns] finishTestRun update error:', updateErr.message)

  // Insert individual test results
  const resultRows = results.tests.map((t) => {
    const featureName = extractFeatureName(t.file)
    const matchedTcId = matchTestCaseId(t.name, featureName, features, testCases)
    return {
      id: crypto.randomUUID(),
      test_run_id: runId,
      test_name: t.name,
      file_path: t.file,
      feature_name: featureName,
      status: t.status,
      duration: t.duration,
      error: t.error ?? null,
      error_stack: null,
      screenshot_path: null,
      test_case_id: matchedTcId,
    }
  })

  if (resultRows.length > 0) {
    const { error: insertErr } = await supabase.from('test_run_results').insert(resultRows)
    if (insertErr) console.error('[testRuns] finishTestRun insert results error:', insertErr.message)
  }

  const run: TestRun = {
    id: runId,
    projectId,
    command: '',
    status: status as TestRun['status'],
    total: results.total,
    passed: results.passed,
    failed: results.failed,
    skipped: results.skipped,
    duration: results.duration,
    createdAt: '',
    finishedAt: now,
  }

  return { run, results: resultRows.map(toTestRunResult) }
}

export async function getTestRuns(projectId: string, limit = 10): Promise<TestRun[]> {
  const { data, error } = await supabase
    .from('test_runs')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) {
    console.error('[testRuns] getTestRuns error:', error.message)
    return []
  }
  return (data ?? []).map((r: Record<string, unknown>) => toTestRun(r))
}

export async function getTestRunResults(runId: string): Promise<TestRunResult[]> {
  const { data, error } = await supabase
    .from('test_run_results')
    .select('*')
    .eq('test_run_id', runId)
  if (error) {
    console.error('[testRuns] getTestRunResults error:', error.message)
    return []
  }
  return (data ?? []).map((r: Record<string, unknown>) => toTestRunResult(r))
}

export async function getLatestRunResults(projectId: string): Promise<{
  run: TestRun | null
  results: TestRunResult[]
}> {
  const runs = await getTestRuns(projectId, 1)
  if (runs.length === 0) return { run: null, results: [] }
  const run = runs[0]
  if (run.status === 'running') return { run, results: [] }
  const results = await getTestRunResults(run.id)
  return { run, results }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Extract feature name from spec file path: tests/{feature-name}/{tc-name}.spec.ts */
function extractFeatureName(filePath: string): string {
  const match = filePath.match(/tests\/([^/]+)\//)
  return match ? match[1] : ''
}

/** Try to match a test name from Playwright output to a test case in the database */
function matchTestCaseId(
  testName: string,
  featureName: string,
  features: { id: string; name: string }[],
  testCases: { id: string; name: string; featureId: string }[]
): string | null {
  // Find feature by slug matching
  const slugify = (s: string) => s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  const feature = features.find((f) => slugify(f.name) === featureName)
  if (!feature) return null

  // Find TC by name match within that feature
  const featureTCs = testCases.filter((tc) => tc.featureId === feature.id)
  const tc = featureTCs.find((tc) =>
    testName.toLowerCase().includes(tc.name.toLowerCase()) ||
    tc.name.toLowerCase().includes(testName.toLowerCase())
  )
  return tc?.id ?? null
}
