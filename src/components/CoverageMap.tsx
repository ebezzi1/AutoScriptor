import { useState, useCallback } from 'react'
import type { Feature, TestCase, Priority } from '../types'

const PRIORITIES: Priority[] = ['P0', 'P1', 'P2', 'P3']

// ── Cell color scheme ────────────────────────────────────────────────────────

type Tier = 'zero' | 'low' | 'good' | 'excellent'

function tier(count: number): Tier {
  if (count === 0) return 'zero'
  if (count <= 2) return 'low'
  if (count <= 5) return 'good'
  return 'excellent'
}

const TIER_STYLES: Record<Tier, { bg: string; text: string; border: string }> = {
  zero:      { bg: 'rgba(248,113,113,0.13)', text: '#f87171',  border: 'rgba(248,113,113,0.30)' },
  low:       { bg: 'rgba(251,191,36,0.13)',  text: '#fbbf24',  border: 'rgba(251,191,36,0.30)'  },
  good:      { bg: 'rgba(52,211,153,0.13)',  text: '#34d399',  border: 'rgba(52,211,153,0.30)'  },
  excellent: { bg: 'rgba(16,185,129,0.22)',  text: '#10b981',  border: 'rgba(16,185,129,0.45)'  },
}

const TIER_LABELS: Record<Tier, string> = {
  zero:      'No coverage',
  low:       'Low coverage',
  good:      'Good coverage',
  excellent: 'Excellent coverage',
}

// ── Tooltip ──────────────────────────────────────────────────────────────────

interface TooltipData {
  x: number
  y: number
  featureName: string
  priority: string
  count: number
  t: Tier
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function assertionsForTC(tc: TestCase): number {
  if ((tc.type ?? 'ui') === 'api') {
    return (tc.apiSteps ?? []).reduce(
      (n, s) => n + (s.statusAssertion !== null ? 1 : 0) + s.responseAssertions.length,
      0
    )
  }
  return tc.steps.filter((s) => s.assertion && s.assertion !== 'none').length
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  features: Feature[]
  testCases: TestCase[]
  projectId: string
  onNavigateFeature: (featureId: string) => void
}

export function CoverageMap({ features, testCases, projectId: _projectId, onNavigateFeature }: Props) {
  const [tooltip, setTooltip] = useState<TooltipData | null>(null)

  const showTooltip = useCallback((
    e: React.MouseEvent,
    featureName: string,
    priority: string,
    count: number,
    t: Tier,
  ) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setTooltip({ x: rect.left + rect.width / 2, y: rect.top - 8, featureName, priority, count, t })
  }, [])

  const hideTooltip = useCallback(() => setTooltip(null), [])

  if (features.length === 0) {
    return (
      <div className="border border-dashed border-vsc-border/60 rounded-xl p-16 text-center mt-6">
        <p className="text-vsc-dim text-sm font-medium">No features to visualize.</p>
        <p className="text-vsc-dim/60 text-xs mt-1">Add features and test cases to see coverage.</p>
      </div>
    )
  }

  // ── Build matrix data ───────────────────────────────────────────────────

  // [featureId][priority] → TestCase[]
  const matrix = new Map<string, Map<Priority, TestCase[]>>()
  for (const f of features) {
    const byPrio = new Map<Priority, TestCase[]>()
    for (const p of PRIORITIES) byPrio.set(p, [])
    matrix.set(f.id, byPrio)
  }
  for (const tc of testCases) {
    if (tc.disabled) continue
    const byPrio = matrix.get(tc.featureId)
    if (!byPrio) continue
    const list = byPrio.get(tc.priority)
    if (list) list.push(tc)
  }

  // column totals
  const colTotals: Record<Priority, number> = { P0: 0, P1: 0, P2: 0, P3: 0 }
  for (const f of features) {
    const byPrio = matrix.get(f.id)!
    for (const p of PRIORITIES) colTotals[p] += byPrio.get(p)!.length
  }

  // row totals
  const rowTotals = new Map<string, number>()
  for (const f of features) {
    const byPrio = matrix.get(f.id)!
    rowTotals.set(f.id, PRIORITIES.reduce((n, p) => n + byPrio.get(p)!.length, 0))
  }

  const grandTotal = PRIORITIES.reduce((n, p) => n + colTotals[p], 0)

  // ── Coverage score ──────────────────────────────────────────────────────

  const totalCells = features.length * 4
  let nonZeroCells = 0
  for (const f of features) {
    const byPrio = matrix.get(f.id)!
    for (const p of PRIORITIES) if (byPrio.get(p)!.length > 0) nonZeroCells++
  }
  const coverageScore = totalCells === 0 ? 0 : Math.round((nonZeroCells / totalCells) * 100)

  // ── Warning lists ───────────────────────────────────────────────────────

  const zeroP0Features = features.filter((f) => (matrix.get(f.id)?.get('P0')?.length ?? 0) === 0)
  const zeroTestFeatures = features.filter((f) => (rowTotals.get(f.id) ?? 0) === 0)

  // ── Per-feature UI vs API + avg assertions ──────────────────────────────

  interface FeatureStat {
    feature: Feature
    uiCount: number
    apiCount: number
    total: number
    avgAssertions: number
  }

  const featureStats: FeatureStat[] = features.map((f) => {
    const fTCs = testCases.filter((tc) => tc.featureId === f.id)
    const uiCount = fTCs.filter((tc) => (tc.type ?? 'ui') === 'ui').length
    const apiCount = fTCs.filter((tc) => tc.type === 'api').length
    const totalAssertions = fTCs.reduce((n, tc) => n + assertionsForTC(tc), 0)
    const avgAssertions = fTCs.length > 0 ? totalAssertions / fTCs.length : 0
    return { feature: f, uiCount, apiCount, total: fTCs.length, avgAssertions }
  })

  const maxTotal = Math.max(...featureStats.map((s) => s.total), 1)

  return (
    <div className="flex flex-col gap-6 mt-6">

      {/* ── Heatmap ─────────────────────────────────────────────────────── */}
      <div className="bg-vsc-panel border border-vsc-border rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-vsc-border flex items-center justify-between">
          <h3 className="text-xs font-semibold text-vsc-dim uppercase tracking-widest">Priority Coverage Heatmap</h3>
          <div className="flex items-center gap-4">
            {(['zero', 'low', 'good', 'excellent'] as Tier[]).map((t) => (
              <div key={t} className="flex items-center gap-1.5">
                <span
                  className="w-3 h-3 rounded-sm shrink-0"
                  style={{ background: TIER_STYLES[t].bg, border: `1px solid ${TIER_STYLES[t].border}` }}
                />
                <span className="text-[10px] text-vsc-dim">{TIER_LABELS[t]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Scrollable grid */}
        <div className="overflow-y-auto max-h-[420px]">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-10 bg-vsc-sidebar">
              <tr>
                <th className="text-left text-[10px] font-semibold text-vsc-dim uppercase tracking-widest px-5 py-3 w-[220px] border-b border-vsc-border">
                  Feature
                </th>
                {PRIORITIES.map((p) => (
                  <th
                    key={p}
                    className="text-center text-[10px] font-bold uppercase tracking-widest px-4 py-3 border-b border-vsc-border border-l border-l-vsc-border/40 min-w-[80px]"
                    style={{ color: TIER_STYLES['good'].text }}
                  >
                    {p}
                  </th>
                ))}
                <th className="text-center text-[10px] font-semibold text-vsc-dim uppercase tracking-widest px-4 py-3 border-b border-vsc-border border-l border-l-vsc-border w-[72px]">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {features.map((f, fi) => {
                const byPrio = matrix.get(f.id)!
                const rowTotal = rowTotals.get(f.id) ?? 0
                return (
                  <tr
                    key={f.id}
                    className={`border-b border-vsc-border/40 ${fi % 2 === 0 ? '' : 'bg-vsc-bg/30'}`}
                  >
                    {/* Feature name */}
                    <td className="px-5 py-0">
                      <button
                        className="text-sm font-medium text-vsc-muted hover:text-vsc-accent transition-colors text-left py-3 w-full truncate block"
                        onClick={() => onNavigateFeature(f.id)}
                        title={f.name}
                      >
                        {f.name}
                      </button>
                    </td>

                    {/* Priority cells */}
                    {PRIORITIES.map((p) => {
                      const count = byPrio.get(p)!.length
                      const t = tier(count)
                      const style = TIER_STYLES[t]
                      return (
                        <td
                          key={p}
                          className="px-2 py-1.5 border-l border-l-vsc-border/40 text-center"
                        >
                          <button
                            className="w-full h-10 rounded-lg flex items-center justify-center text-sm font-bold tabular-nums cursor-pointer transition-all duration-150 hover:scale-105 hover:brightness-110 active:scale-95"
                            style={{
                              background: style.bg,
                              color: style.text,
                              border: `1px solid ${style.border}`,
                            }}
                            onClick={() => onNavigateFeature(f.id)}
                            onMouseEnter={(e) => showTooltip(e, f.name, p, count, t)}
                            onMouseLeave={hideTooltip}
                          >
                            {count}
                          </button>
                        </td>
                      )
                    })}

                    {/* Row total */}
                    <td className="px-4 py-1.5 border-l border-l-vsc-border text-center">
                      <span className="text-sm font-semibold text-vsc-muted tabular-nums">
                        {rowTotal}
                      </span>
                    </td>
                  </tr>
                )
              })}

              {/* Summary row */}
              <tr className="bg-vsc-hover/60 border-t-2 border-vsc-border">
                <td className="px-5 py-3">
                  <span className="text-[10px] font-bold text-vsc-dim uppercase tracking-widest">Totals</span>
                </td>
                {PRIORITIES.map((p) => (
                  <td key={p} className="px-2 py-3 border-l border-l-vsc-border/40 text-center">
                    <span className="text-sm font-bold text-vsc-accent tabular-nums">{colTotals[p]}</span>
                  </td>
                ))}
                <td className="px-4 py-3 border-l border-l-vsc-border text-center">
                  <span className="text-sm font-bold text-vsc-text tabular-nums">{grandTotal}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Coverage score + warnings ────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">

        {/* Score */}
        <div className="bg-vsc-panel border border-vsc-border rounded-xl p-5 flex flex-col gap-3">
          <p className="text-[10px] font-bold text-vsc-dim uppercase tracking-widest">Coverage Score</p>
          <div className="flex items-end gap-2">
            <span
              className="text-4xl font-bold tabular-nums leading-none"
              style={{
                color: coverageScore >= 75 ? '#10b981'
                  : coverageScore >= 40 ? '#fbbf24'
                  : '#f87171',
              }}
            >
              {coverageScore}%
            </span>
            <span className="text-xs text-vsc-dim mb-0.5">{nonZeroCells}/{totalCells} cells</span>
          </div>
          {/* Segmented bar */}
          <div className="h-2 rounded-full bg-vsc-active overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${coverageScore}%`,
                background: coverageScore >= 75 ? '#10b981'
                  : coverageScore >= 40 ? '#fbbf24'
                  : '#f87171',
              }}
            />
          </div>
          <p className="text-xs text-vsc-dim">
            {coverageScore === 100 ? 'All priority/feature pairs covered' :
              coverageScore === 0 ? 'No priority/feature pairs covered' :
              `${totalCells - nonZeroCells} gap${totalCells - nonZeroCells !== 1 ? 's' : ''} need attention`}
          </p>
        </div>

        {/* Critical: zero-test features */}
        <div className="bg-vsc-panel border border-vsc-border rounded-xl p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold text-vsc-dim uppercase tracking-widest">No Tests At All</p>
            {zeroTestFeatures.length > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/30">
                Critical
              </span>
            )}
          </div>
          {zeroTestFeatures.length === 0 ? (
            <div className="flex items-center gap-2 py-2">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-vsc-success shrink-0">
                <path d="M2 7l4 4 6-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span className="text-xs text-vsc-success font-medium">All features have tests</span>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5 overflow-y-auto max-h-28">
              {zeroTestFeatures.map((f) => (
                <button
                  key={f.id}
                  onClick={() => onNavigateFeature(f.id)}
                  className="flex items-center gap-2 text-left hover:bg-vsc-hover rounded-md px-2 py-1 transition-colors group"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0 group-hover:scale-125 transition-transform" />
                  <span className="text-xs text-vsc-muted group-hover:text-vsc-text truncate transition-colors">{f.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Warning: zero P0 */}
        <div className="bg-vsc-panel border border-vsc-border rounded-xl p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold text-vsc-dim uppercase tracking-widest">Missing P0 Tests</p>
            {zeroP0Features.length > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
                Warning
              </span>
            )}
          </div>
          {zeroP0Features.length === 0 ? (
            <div className="flex items-center gap-2 py-2">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-vsc-success shrink-0">
                <path d="M2 7l4 4 6-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span className="text-xs text-vsc-success font-medium">All features have P0 tests</span>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5 overflow-y-auto max-h-28">
              {zeroP0Features.map((f) => (
                <button
                  key={f.id}
                  onClick={() => onNavigateFeature(f.id)}
                  className="flex items-center gap-2 text-left hover:bg-vsc-hover rounded-md px-2 py-1 transition-colors group"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 group-hover:scale-125 transition-transform" />
                  <span className="text-xs text-vsc-muted group-hover:text-vsc-text truncate transition-colors">{f.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Per-feature stats ────────────────────────────────────────────── */}
      <div className="bg-vsc-panel border border-vsc-border rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-vsc-border">
          <h3 className="text-xs font-semibold text-vsc-dim uppercase tracking-widest">Per-Feature Breakdown</h3>
        </div>
        <div className="overflow-y-auto max-h-[320px]">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-10 bg-vsc-sidebar">
              <tr>
                {['Feature', 'UI / API split', 'Total tests', 'Avg assertions / TC'].map((col) => (
                  <th
                    key={col}
                    className="text-left text-[10px] font-semibold text-vsc-dim uppercase tracking-widest px-5 py-3 border-b border-vsc-border whitespace-nowrap"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {featureStats.map((s, i) => {
                const uiPct = s.total > 0 ? (s.uiCount / s.total) * 100 : 0
                const apiPct = s.total > 0 ? (s.apiCount / s.total) * 100 : 0
                const barWidth = s.total > 0 ? (s.total / maxTotal) * 100 : 0
                return (
                  <tr
                    key={s.feature.id}
                    className={`border-b border-vsc-border/40 hover:bg-vsc-hover/40 transition-colors ${i % 2 === 0 ? '' : 'bg-vsc-bg/30'}`}
                  >
                    <td className="px-5 py-3">
                      <button
                        className="text-sm font-medium text-vsc-muted hover:text-vsc-accent transition-colors text-left truncate block max-w-[180px]"
                        onClick={() => onNavigateFeature(s.feature.id)}
                        title={s.feature.name}
                      >
                        {s.feature.name}
                      </button>
                    </td>

                    {/* Stacked bar */}
                    <td className="px-5 py-3">
                      {s.total === 0 ? (
                        <span className="text-xs text-vsc-border italic">no tests</span>
                      ) : (
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            {/* Bar container with proportional outer width */}
                            <div
                              className="h-4 rounded overflow-hidden flex min-w-[40px] transition-all duration-300"
                              style={{ width: `${Math.max(barWidth, 8)}%`, maxWidth: '140px' }}
                            >
                              {uiPct > 0 && (
                                <div
                                  className="h-full bg-vsc-accent/70"
                                  style={{ width: `${uiPct}%` }}
                                  title={`UI: ${s.uiCount}`}
                                />
                              )}
                              {apiPct > 0 && (
                                <div
                                  className="h-full bg-vsc-blue/70"
                                  style={{ width: `${apiPct}%` }}
                                  title={`API: ${s.apiCount}`}
                                />
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {s.uiCount > 0 && (
                                <span className="flex items-center gap-1 text-[10px] text-vsc-dim">
                                  <span className="w-2 h-2 rounded-sm bg-vsc-accent/70 shrink-0" />
                                  UI {s.uiCount}
                                </span>
                              )}
                              {s.apiCount > 0 && (
                                <span className="flex items-center gap-1 text-[10px] text-vsc-dim">
                                  <span className="w-2 h-2 rounded-sm bg-vsc-blue/70 shrink-0" />
                                  API {s.apiCount}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </td>

                    <td className="px-5 py-3">
                      <span className="text-sm font-semibold text-vsc-text tabular-nums">{s.total}</span>
                    </td>

                    <td className="px-5 py-3">
                      {s.total === 0 ? (
                        <span className="text-xs text-vsc-border">—</span>
                      ) : (
                        <span
                          className="text-sm font-semibold tabular-nums"
                          style={{
                            color: s.avgAssertions >= 3 ? '#10b981'
                              : s.avgAssertions >= 1 ? '#fbbf24'
                              : '#f87171',
                          }}
                        >
                          {s.avgAssertions.toFixed(1)}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Tooltip (fixed portal-like overlay) ─────────────────────────── */}
      {tooltip && (
        <div
          className="fixed z-[9999] pointer-events-none"
          style={{ left: tooltip.x, top: tooltip.y, transform: 'translate(-50%, -100%)' }}
        >
          <div
            className="mb-2 px-3 py-2 rounded-lg shadow-xl text-xs font-medium leading-snug whitespace-nowrap"
            style={{
              background: '#1A1A22',
              border: `1px solid ${TIER_STYLES[tooltip.t].border}`,
              color: TIER_STYLES[tooltip.t].text,
            }}
          >
            <div className="font-bold">{tooltip.featureName} · {tooltip.priority}</div>
            <div className="text-vsc-dim font-normal mt-0.5">
              {tooltip.count} test case{tooltip.count !== 1 ? 's' : ''} — {TIER_LABELS[tooltip.t]}
            </div>
            {/* Arrow */}
            <div
              className="absolute left-1/2 -translate-x-1/2 -bottom-1.5 w-3 h-3 rotate-45"
              style={{ background: '#1A1A22', borderRight: `1px solid ${TIER_STYLES[tooltip.t].border}`, borderBottom: `1px solid ${TIER_STYLES[tooltip.t].border}` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
