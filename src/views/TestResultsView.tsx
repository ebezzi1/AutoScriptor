import { useState, useEffect, useMemo, useCallback } from 'react'
import { useApp } from '../store/AppContext'
import { useAgent } from '../store/AgentContext'
import { Btn } from '../components/common/Btn'
import { getTestRuns, getTestRunResults } from '../lib/database/testRuns'
import type { TestRun, TestRunResult, TestResultStatus } from '../types'

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  const m = Math.floor(ms / 60000)
  const s = Math.round((ms % 60000) / 1000)
  return `${m}m ${s}s`
}

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString(undefined, {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    })
  } catch { return iso }
}

// ── Status icon ─────────────────────────────────────────────────────────────

function StatusIcon({ status, size = 14 }: { status: string; size?: number }) {
  if (status === 'passed') {
    return (
      <svg width={size} height={size} viewBox="0 0 14 14" fill="none" className="text-green-400 shrink-0">
        <path d="M3 7.5l3 3 5-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    )
  }
  if (status === 'failed' || status === 'timedOut') {
    return (
      <svg width={size} height={size} viewBox="0 0 14 14" fill="none" className="text-red-400 shrink-0">
        <path d="M3.5 3.5l7 7M10.5 3.5l-7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
    )
  }
  // skipped
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" className="text-gray-500 shrink-0">
      <path d="M3 7h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  )
}

function StatusBadge({ status, count }: { status: string; count: number }) {
  const colors: Record<string, string> = {
    passed: 'bg-green-500/15 text-green-400 border-green-500/30',
    failed: 'bg-red-500/15 text-red-400 border-red-500/30',
    skipped: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
  }
  return (
    <span className={`text-xs font-bold px-2.5 py-1 rounded-md border tabular-nums ${colors[status] ?? colors.skipped}`}>
      {count} {status}
    </span>
  )
}

// ── Sorting ─────────────────────────────────────────────────────────────────

type SortField = 'name' | 'duration' | 'status'
type SortDir = 'asc' | 'desc'

const STATUS_ORDER: Record<string, number> = { failed: 0, timedOut: 1, passed: 2, skipped: 3 }

function sortResults(results: TestRunResult[], field: SortField, dir: SortDir): TestRunResult[] {
  return [...results].sort((a, b) => {
    let cmp = 0
    if (field === 'name') cmp = a.testName.localeCompare(b.testName)
    else if (field === 'duration') cmp = a.duration - b.duration
    else cmp = (STATUS_ORDER[a.status] ?? 4) - (STATUS_ORDER[b.status] ?? 4)
    return dir === 'asc' ? cmp : -cmp
  })
}

// ── Filter types ────────────────────────────────────────────────────────────

type FilterStatus = 'all' | TestResultStatus

// ── Main view ───────────────────────────────────────────────────────────────

interface Props { projectId: string; initialRunId?: string }

export function TestResultsView({ projectId, initialRunId }: Props) {
  const { state, navigate } = useApp()
  const { client } = useAgent()

  const [runs, setRuns] = useState<TestRun[]>([])
  const [selectedRunId, setSelectedRunId] = useState<string | null>(initialRunId ?? null)
  const [results, setResults] = useState<TestRunResult[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterStatus>('all')
  const [search, setSearch] = useState('')
  const [sortField, setSortField] = useState<SortField>('status')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [commandExpanded, setCommandExpanded] = useState(false)

  const project = state.projects.find((p) => p.id === projectId)

  // Load runs list
  useEffect(() => {
    setLoading(true)
    getTestRuns(projectId, 10).then((r) => {
      setRuns(r)
      if (!selectedRunId && r.length > 0) setSelectedRunId(r[0].id)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [projectId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Load results for selected run
  useEffect(() => {
    if (!selectedRunId) { setResults([]); return }
    getTestRunResults(selectedRunId).then(setResults).catch(() => setResults([]))
  }, [selectedRunId])

  const selectedRun = runs.find((r) => r.id === selectedRunId) ?? null

  // Compute filter counts
  const counts = useMemo(() => {
    const c = { all: results.length, passed: 0, failed: 0, skipped: 0, timedOut: 0 }
    results.forEach((r) => { c[r.status] = (c[r.status] ?? 0) + 1 })
    return c
  }, [results])

  // Filter & sort
  const filteredResults = useMemo(() => {
    let list = results
    if (filter !== 'all') list = list.filter((r) => r.status === filter)
    if (search) {
      const q = search.toLowerCase()
      list = list.filter((r) => r.testName.toLowerCase().includes(q) || r.featureName.toLowerCase().includes(q))
    }
    return sortResults(list, sortField, sortDir)
  }, [results, filter, search, sortField, sortDir])

  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortField(field); setSortDir('asc') }
  }, [sortField])

  const SortArrow = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null
    return <span className="ml-0.5 text-[9px]">{sortDir === 'asc' ? '▲' : '▼'}</span>
  }

  if (loading) {
    return (
      <div className="py-20 flex items-center justify-center text-vsc-muted text-sm">
        Loading results...
      </div>
    )
  }

  if (runs.length === 0) {
    return (
      <div className="py-10 px-6 max-w-4xl mx-auto">
        <div className="mb-4">
          <button
            onClick={() => navigate({ type: 'project-dashboard', projectId })}
            className="text-xs text-vsc-dim hover:text-vsc-accent transition-colors flex items-center gap-1"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M6 2L2 5l4 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Back to dashboard
          </button>
        </div>
        <div className="border border-dashed border-vsc-border/60 rounded-xl p-14 text-center">
          <p className="text-vsc-dim text-sm font-medium">No test runs yet</p>
          <p className="text-vsc-dim text-xs mt-2">Run your tests to see results here.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="py-8 px-6 max-w-5xl mx-auto">
      {/* Back nav */}
      <div className="mb-4">
        <button
          onClick={() => navigate({ type: 'project-dashboard', projectId })}
          className="text-xs text-vsc-dim hover:text-vsc-accent transition-colors flex items-center gap-1"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M6 2L2 5l4 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          {project?.name ?? 'Back'}
        </button>
      </div>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-vsc-text tracking-tight mb-3">Test Results</h1>

        {selectedRun && (
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <span className="text-xs text-vsc-muted">{formatTimestamp(selectedRun.createdAt)}</span>
            {selectedRun.duration > 0 && (
              <span className="text-xs text-vsc-dim">{formatDuration(selectedRun.duration)}</span>
            )}
            {selectedRun.userName && (
              <span className="text-xs text-vsc-dim">by {selectedRun.userName}</span>
            )}
            {selectedRun.environment && (
              <span className="text-[10px] text-vsc-accent border border-vsc-accent/30 px-2 py-0.5 rounded-full font-medium">
                {selectedRun.environment}
              </span>
            )}
          </div>
        )}

        {/* Badges */}
        {selectedRun && (
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <StatusBadge status="passed" count={selectedRun.passed} />
            {selectedRun.failed > 0 && <StatusBadge status="failed" count={selectedRun.failed} />}
            {selectedRun.skipped > 0 && <StatusBadge status="skipped" count={selectedRun.skipped} />}
          </div>
        )}

        {/* Command */}
        {selectedRun?.command && (
          <div className="mb-3">
            <button
              onClick={() => setCommandExpanded(!commandExpanded)}
              className="text-[10px] text-vsc-dim hover:text-vsc-muted transition-colors flex items-center gap-1"
            >
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none"
                className={`transition-transform ${commandExpanded ? 'rotate-90' : ''}`}
              >
                <path d="M2 1l4 3-4 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Command
            </button>
            {commandExpanded && (
              <code className="block mt-1 text-[11px] text-vsc-accent font-mono bg-vsc-panel border border-vsc-border rounded px-3 py-2 break-all">
                {selectedRun.command}
              </code>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Btn
            variant="ghost"
            size="sm"
            onClick={() => client?.openReport().catch(console.error)}
          >
            Open HTML Report
          </Btn>
        </div>
      </div>

      {/* Run selector */}
      <div className="mb-6">
        <label className="text-[9px] text-vsc-dim uppercase tracking-widest block mb-1.5">Run history</label>
        <select
          value={selectedRunId ?? ''}
          onChange={(e) => setSelectedRunId(e.target.value)}
          className="bg-vsc-panel border border-vsc-border text-vsc-text text-xs px-3 py-2 rounded-lg outline-none focus:border-vsc-accent/50 w-full max-w-md"
        >
          {runs.map((r) => (
            <option key={r.id} value={r.id}>
              {formatTimestamp(r.createdAt)} — {r.passed} passed{r.failed > 0 ? `, ${r.failed} failed` : ''}{r.skipped > 0 ? `, ${r.skipped} skipped` : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {(['all', 'passed', 'failed', 'skipped'] as const).map((f) => {
          const count = f === 'all' ? counts.all : (counts[f] ?? 0)
          const isActive = filter === f
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-[10px] uppercase tracking-wide px-3 py-1.5 rounded-md border transition-all font-medium ${
                isActive
                  ? f === 'passed' ? 'bg-green-500/15 border-green-500/30 text-green-400'
                  : f === 'failed' ? 'bg-red-500/15 border-red-500/30 text-red-400'
                  : f === 'skipped' ? 'bg-gray-500/15 border-gray-500/30 text-gray-400'
                  : 'bg-vsc-accent/15 border-vsc-accent/30 text-vsc-accent'
                  : 'border-vsc-border text-vsc-dim hover:text-vsc-muted hover:border-vsc-border'
              }`}
            >
              {f} <span className="tabular-nums">({count})</span>
            </button>
          )
        })}

        <div className="flex-1" />

        {/* Search */}
        <input
          type="text"
          placeholder="Search tests..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-vsc-panel border border-vsc-border text-vsc-text text-xs px-3 py-1.5 rounded-lg outline-none focus:border-vsc-accent/50 w-48 placeholder:text-vsc-dim"
        />
      </div>

      {/* Results table */}
      <div className="bg-vsc-panel border border-vsc-border rounded-xl overflow-hidden">
        {/* Table header */}
        <div className="flex items-center gap-3 px-5 py-2.5 border-b border-vsc-border bg-vsc-sidebar text-[10px] font-semibold text-vsc-dim uppercase tracking-widest">
          <span className="w-5" />
          <button className="flex-1 text-left flex items-center gap-0.5 hover:text-vsc-muted transition-colors" onClick={() => handleSort('name')}>
            Test name <SortArrow field="name" />
          </button>
          <span className="w-32 text-left">Feature</span>
          <button className="w-20 text-right flex items-center justify-end gap-0.5 hover:text-vsc-muted transition-colors" onClick={() => handleSort('duration')}>
            Duration <SortArrow field="duration" />
          </button>
          <button className="w-16 text-center hover:text-vsc-muted transition-colors" onClick={() => handleSort('status')}>
            Status <SortArrow field="status" />
          </button>
        </div>

        {/* Rows */}
        {filteredResults.length === 0 ? (
          <div className="px-5 py-8 text-center text-xs text-vsc-dim">
            {search ? 'No tests match your search.' : 'No results in this category.'}
          </div>
        ) : (
          filteredResults.map((r) => {
            const isExpanded = expandedId === r.id
            return (
              <div key={r.id}>
                <button
                  className="w-full flex items-center gap-3 px-5 py-2.5 text-left hover:bg-vsc-hover/50 transition-colors border-b border-vsc-border/50"
                  onClick={() => setExpandedId(isExpanded ? null : r.id)}
                >
                  <StatusIcon status={r.status} />
                  <span className="flex-1 text-xs text-vsc-text truncate font-mono">{r.testName}</span>
                  <span className="w-32 text-xs text-vsc-muted truncate">{r.featureName || '—'}</span>
                  <span className="w-20 text-right text-[11px] text-vsc-dim tabular-nums">{formatDuration(r.duration)}</span>
                  <span className="w-16 flex justify-center">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      r.status === 'passed' ? 'text-green-400 bg-green-500/10' :
                      r.status === 'failed' || r.status === 'timedOut' ? 'text-red-400 bg-red-500/10' :
                      'text-gray-400 bg-gray-500/10'
                    }`}>
                      {r.status}
                    </span>
                  </span>
                </button>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="px-5 py-3 bg-vsc-bg border-b border-vsc-border/50">
                    {r.error && (
                      <div className="mb-3">
                        <p className="text-[10px] text-vsc-dim uppercase tracking-widest mb-1">Error</p>
                        <pre className="text-[11px] text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 font-mono whitespace-pre-wrap break-all leading-relaxed overflow-auto max-h-48">
                          {r.error}
                        </pre>
                      </div>
                    )}

                    {r.errorStack && (
                      <details className="mb-3">
                        <summary className="text-[10px] text-vsc-dim cursor-pointer hover:text-vsc-muted transition-colors">
                          Stack trace
                        </summary>
                        <pre className="mt-1 text-[10px] text-vsc-dim/70 bg-vsc-panel border border-vsc-border rounded-lg px-4 py-3 font-mono whitespace-pre-wrap break-all leading-relaxed overflow-auto max-h-48">
                          {r.errorStack}
                        </pre>
                      </details>
                    )}

                    {r.screenshotPath && (
                      <button
                        onClick={() => {
                          if (client) {
                            client.readFile(r.screenshotPath!).catch(console.error)
                          }
                        }}
                        className="text-[10px] text-vsc-accent hover:text-white transition-colors flex items-center gap-1 mb-2"
                      >
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                          <rect x="1" y="2" width="8" height="6" rx="1" stroke="currentColor" strokeWidth="1.2"/>
                          <circle cx="3.5" cy="5" r="1" fill="currentColor"/>
                          <path d="M5 7l2-2.5L9 7" stroke="currentColor" strokeWidth="1"/>
                        </svg>
                        View Screenshot
                      </button>
                    )}

                    {r.testCaseId && (
                      <button
                        onClick={() => {
                          // Find the test case to get its featureId
                          const tc = state.testCases.find((t) => t.id === r.testCaseId)
                          if (tc) {
                            navigate({
                              type: 'test-case',
                              projectId,
                              featureId: tc.featureId,
                              testCaseId: tc.id,
                            })
                          }
                        }}
                        className="text-[10px] text-vsc-accent hover:text-white transition-colors flex items-center gap-1"
                      >
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                          <path d="M2 5h5M5 2l3 3-3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        Go to Test Case
                      </button>
                    )}

                    {!r.error && !r.errorStack && !r.screenshotPath && !r.testCaseId && (
                      <p className="text-[10px] text-vsc-dim">No additional details available.</p>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
