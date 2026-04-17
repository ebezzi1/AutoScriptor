export interface ParsedTest {
  name: string
  file: string
  status: 'passed' | 'failed' | 'skipped' | 'timedOut'
  duration: number
  error?: string
  steps?: string[]
}

export interface ParsedResults {
  total: number
  passed: number
  failed: number
  skipped: number
  duration: number
  tests: ParsedTest[]
}

interface RawSuite {
  file?: string
  specs?: RawSpec[]
  suites?: RawSuite[]
}

interface RawSpec {
  title?: string
  tests?: RawTestEntry[]
}

interface RawTestEntry {
  title?: string
  results?: RawResult[]
}

interface RawResult {
  status?: string
  duration?: number
  error?: { message?: string }
  steps?: { title?: string }[]
}

function walkSuites(suites: RawSuite[], file = ''): ParsedTest[] {
  const tests: ParsedTest[] = []
  for (const suite of suites) {
    const suiteFile = suite.file ?? file
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        const result = (test.results ?? [])[0] ?? {}
        const rawStatus = result.status ?? 'skipped'
        const status: ParsedTest['status'] =
          rawStatus === 'passed' ? 'passed'
          : rawStatus === 'failed' ? 'failed'
          : rawStatus === 'timedOut' ? 'timedOut'
          : 'skipped'
        tests.push({
          name: spec.title ?? test.title ?? 'Unknown',
          file: suiteFile,
          status,
          duration: result.duration ?? 0,
          error: result.error?.message,
          steps: result.steps?.map((s) => s.title ?? '') ?? undefined,
        })
      }
    }
    if (suite.suites?.length) {
      tests.push(...walkSuites(suite.suites, suiteFile))
    }
  }
  return tests
}

export function parsePlaywrightJSON(jsonOutput: string): ParsedResults | null {
  try {
    const raw = JSON.parse(jsonOutput)
    const tests = walkSuites(raw.suites ?? [])
    const stats = raw.stats ?? {}

    return {
      total: stats.expected ?? tests.length,
      passed: tests.filter((t) => t.status === 'passed').length,
      failed: (stats.unexpected ?? 0) + (stats.flaky ?? 0),
      skipped: stats.skipped ?? tests.filter((t) => t.status === 'skipped').length,
      duration: stats.duration ?? 0,
      tests,
    }
  } catch {
    return null
  }
}

/** Extract the last JSON object from mixed stdout (Playwright JSON reporter appends it at end). */
export function extractJSONFromStdout(stdout: string): ParsedResults | null {
  const match = stdout.match(/(\{[\s\S]*\})\s*$/)
  if (!match) return null
  return parsePlaywrightJSON(match[1])
}
