import { useState } from 'react'
import { Btn } from './common/Btn'
import { buildMatrixRows, exportCsv, exportXlsx } from '../lib/matrixExporter'
import type { Project, Feature, TestCase, Fixture } from '../types'

interface Props {
  project: Project
  features: Feature[]
  testCases: TestCase[]
  fixtures: Fixture[]
  onClose: () => void
}

type Format = 'csv' | 'xlsx'

const PRIORITY_BADGE: Record<string, string> = {
  P0: 'bg-red-500/15 text-red-400 border-red-500/30',
  P1: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  P2: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  P3: 'bg-green-500/15 text-green-400 border-green-500/30',
}

export function MatrixPreviewModal({ project, features, testCases, fixtures, onClose }: Props) {
  const [format, setFormat] = useState<Format>('csv')
  const rows = buildMatrixRows(project, features, testCases, fixtures)

  // Summary stats
  const totalTCs = rows.length
  const byPriority: Record<string, number> = { P0: 0, P1: 0, P2: 0, P3: 0 }
  const byType: Record<string, number> = { UI: 0, API: 0 }
  for (const row of rows) {
    byPriority[row.priority] = (byPriority[row.priority] ?? 0) + 1
    byType[row.type] = (byType[row.type] ?? 0) + 1
  }

  const handleExport = () => {
    if (format === 'csv') exportCsv(rows, project.name)
    else exportXlsx(rows, project.name)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-6xl max-h-[90vh] bg-vsc-panel border border-vsc-border rounded-2xl shadow-2xl shadow-black/60 flex flex-col overflow-hidden animate-slide-down"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-7 py-5 border-b border-vsc-border shrink-0">
          <div>
            <h2 className="text-base font-bold text-vsc-text">Test Matrix Export</h2>
            <p className="text-xs text-vsc-dim mt-0.5">{project.name}</p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-vsc-dim hover:text-vsc-text hover:bg-vsc-hover transition-all text-lg leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Stats bar */}
        <div className="flex items-center gap-6 px-7 py-4 border-b border-vsc-border bg-vsc-bg/40 shrink-0 flex-wrap">
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-vsc-accent tabular-nums">{totalTCs}</span>
            <span className="text-xs text-vsc-dim font-semibold uppercase tracking-widest">test cases</span>
          </div>

          <div className="w-px h-6 bg-vsc-border shrink-0" />

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-vsc-dim font-semibold uppercase tracking-widest shrink-0">Priority</span>
            {(['P0', 'P1', 'P2', 'P3'] as const).map((p) => (
              byPriority[p] > 0 && (
                <span
                  key={p}
                  className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${PRIORITY_BADGE[p]}`}
                >
                  {p}: {byPriority[p]}
                </span>
              )
            ))}
          </div>

          <div className="w-px h-6 bg-vsc-border shrink-0" />

          <div className="flex items-center gap-2">
            <span className="text-xs text-vsc-dim font-semibold uppercase tracking-widest">Type</span>
            {byType['UI'] > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full font-semibold border border-vsc-accent/30 text-vsc-accent bg-vsc-accent/10">
                UI: {byType['UI']}
              </span>
            )}
            {byType['API'] > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full font-semibold border border-vsc-blue/30 text-vsc-blue bg-vsc-blue/10">
                API: {byType['API']}
              </span>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {rows.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-vsc-dim text-sm">
              No test cases to export.
            </div>
          ) : (
            <table className="w-full text-xs border-collapse">
              <thead className="sticky top-0 z-10 bg-vsc-sidebar">
                <tr>
                  {[
                    'Feature', 'Test Case', 'Type', 'Priority', 'Tags',
                    'Auth Role', 'Steps', 'Assertions', 'Fixture', 'Annotations',
                    'Status', 'Notes',
                  ].map((col) => (
                    <th
                      key={col}
                      className="text-left text-[10px] font-semibold text-vsc-dim uppercase tracking-widest px-4 py-3 border-b border-vsc-border whitespace-nowrap"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const prevFeature = i > 0 ? rows[i - 1].featureName : null
                  const isNewFeature = row.featureName !== prevFeature
                  return (
                    <tr
                      key={i}
                      className={`border-b border-vsc-border/50 hover:bg-vsc-hover/50 transition-colors ${
                        i % 2 === 0 ? 'bg-transparent' : 'bg-vsc-bg/30'
                      }`}
                    >
                      <td className="px-4 py-2.5 whitespace-nowrap font-medium text-vsc-muted">
                        {isNewFeature ? (
                          <span className="text-vsc-text font-semibold">{row.featureName}</span>
                        ) : (
                          <span className="text-vsc-border pl-2">↳</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 max-w-[220px]">
                        <span className="text-vsc-text font-medium block truncate" title={row.testCaseName}>
                          {row.testCaseName}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span className={`inline-block px-2 py-0.5 rounded-full font-semibold border text-[10px] ${
                          row.type === 'API'
                            ? 'border-vsc-blue/40 text-vsc-blue bg-vsc-blue/10'
                            : 'border-vsc-border text-vsc-muted bg-vsc-active'
                        }`}>
                          {row.type}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span className={`inline-block px-2 py-0.5 rounded-full font-semibold border text-[10px] ${PRIORITY_BADGE[row.priority] ?? ''}`}>
                          {row.priority}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-vsc-muted max-w-[140px] truncate" title={row.tags}>
                        {row.tags || <span className="text-vsc-border">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-vsc-muted whitespace-nowrap">
                        {row.authRole || <span className="text-vsc-border">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-vsc-text font-mono tabular-nums text-center">
                        {row.stepCount}
                      </td>
                      <td className="px-4 py-2.5 text-vsc-muted font-mono tabular-nums text-center">
                        {row.assertionsCount > 0 ? (
                          <span className="text-vsc-success">{row.assertionsCount}</span>
                        ) : (
                          <span className="text-vsc-border">0</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-vsc-muted whitespace-nowrap">
                        {row.linkedFixture || <span className="text-vsc-border">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-vsc-muted max-w-[120px] truncate" title={row.annotations}>
                        {row.annotations ? (
                          <span className="text-yellow-400">{row.annotations}</span>
                        ) : (
                          <span className="text-vsc-border">—</span>
                        )}
                      </td>
                      {/* Status and Notes — empty, for QA manual fill */}
                      <td className="px-4 py-2.5">
                        <span className="block w-20 h-4 border-b border-dashed border-vsc-border/50" />
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="block w-32 h-4 border-b border-dashed border-vsc-border/50" />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-7 py-4 border-t border-vsc-border bg-vsc-panel shrink-0">
          <span className="text-xs text-vsc-dim">
            {rows.length} row{rows.length !== 1 ? 's' : ''} · sorted by feature, priority, name
          </span>
          <div className="flex items-center gap-3">
            {/* Format picker */}
            <div className="flex rounded-lg border border-vsc-border overflow-hidden">
              {(['csv', 'xlsx'] as Format[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  className={`px-3 py-1.5 text-xs font-semibold transition-all ${
                    format === f
                      ? 'bg-vsc-accent text-white'
                      : 'bg-vsc-hover text-vsc-muted hover:text-vsc-text'
                  }`}
                >
                  {f === 'csv' ? 'CSV' : 'Excel (.xlsx)'}
                </button>
              ))}
            </div>
            <Btn variant="ghost" size="sm" onClick={onClose}>Cancel</Btn>
            <Btn variant="primary" size="sm" onClick={handleExport} disabled={rows.length === 0}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="shrink-0">
                <path d="M6 1v7.5M2.5 6L6 9.5 9.5 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M1 11h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              Export {format.toUpperCase()}
            </Btn>
          </div>
        </div>
      </div>
    </div>
  )
}
