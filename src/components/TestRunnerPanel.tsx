import { useState, useEffect, useRef, useCallback } from 'react'
import { useAgent } from '../store/AgentContext'
import { useApp } from '../store/AppContext'
import type { ParsedTest } from '../lib/agent'

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

type PanelTab = 'output' | 'results'

// ── Status icon component ───────────────────────────────────────────────────

function StatusIcon({ status, size = 12 }: { status: string; size?: number }) {
  if (status === 'passed') {
    return (
      <svg width={size} height={size} viewBox="0 0 12 12" fill="none" className="text-green-400 shrink-0">
        <path d="M2.5 6.5l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    )
  }
  if (status === 'failed' || status === 'timedOut') {
    return (
      <svg width={size} height={size} viewBox="0 0 12 12" fill="none" className="text-red-400 shrink-0">
        <path d="M3 3l6 6M9 3L3 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    )
  }
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" className="text-gray-500 shrink-0">
      <path d="M2 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

// ── Results Tab Content ─────────────────────────────────────────────────────

function ResultsTab({ onViewFull }: { onViewFull: () => void }) {
  const { latestResults, client } = useAgent()
  const { parsedResults } = latestResults
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)

  if (!parsedResults) {
    return (
      <div className="flex-1 flex items-center justify-center text-xs text-vsc-dim">
        No test results yet. Run a test to see results.
      </div>
    )
  }

  const { total, passed, failed, skipped, duration, tests } = parsedResults

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Summary bar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-white/5 shrink-0">
        <span className="text-[11px] font-semibold text-green-400 tabular-nums">{passed} passed</span>
        {failed > 0 && (
          <span className="text-[11px] font-semibold text-red-400 tabular-nums">{failed} failed</span>
        )}
        {skipped > 0 && (
          <span className="text-[11px] font-semibold text-gray-500 tabular-nums">{skipped} skipped</span>
        )}
        <span className="text-[10px] text-vsc-dim">
          {total} total &middot; {formatDuration(duration)}
        </span>
      </div>

      {/* Test list */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {tests.map((test: ParsedTest, i: number) => (
          <div key={i}>
            <button
              className={`w-full flex items-center gap-2.5 px-4 py-1.5 text-left hover:bg-vsc-hover/50 transition-colors ${
                test.status === 'failed' || test.status === 'timedOut' ? 'cursor-pointer' : ''
              }`}
              onClick={() => {
                if (test.status === 'failed' || test.status === 'timedOut') {
                  setExpandedIdx(expandedIdx === i ? null : i)
                }
              }}
            >
              <StatusIcon status={test.status} />
              <span className="flex-1 text-[12px] text-vsc-text truncate font-mono">{test.name}</span>
              <span className="text-[10px] text-vsc-dim tabular-nums shrink-0">{formatDuration(test.duration)}</span>
            </button>
            {expandedIdx === i && test.error && (
              <div className="mx-4 mb-2 px-3 py-2 rounded bg-red-500/10 border border-red-500/20">
                <pre className="text-[11px] text-red-300 font-mono whitespace-pre-wrap break-all leading-relaxed">
                  {test.error}
                </pre>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Bottom action buttons */}
      <div className="flex items-center gap-2 px-4 py-2 border-t border-white/5 shrink-0">
        <button
          onClick={onViewFull}
          className="text-[10px] font-medium text-vsc-accent hover:text-white border border-vsc-accent/30 hover:border-vsc-accent/60 rounded px-2.5 py-1 transition-colors"
        >
          View Full Results
        </button>
        <button
          onClick={() => client?.openReport().catch(console.error)}
          className="text-[10px] font-medium text-vsc-muted hover:text-vsc-text border border-vsc-border hover:border-vsc-accent/40 rounded px-2.5 py-1 transition-colors"
        >
          Open HTML Report
        </button>
      </div>
    </div>
  )
}

// ── Main Panel ──────────────────────────────────────────────────────────────

export function TestRunnerPanel() {
  const { runner, killCommand, clearRunner, showRunner, setShowRunner, latestResults } = useAgent()
  const { state, navigate } = useApp()
  const [collapsed, setCollapsed] = useState(false)
  const [height, setHeight] = useState(300)
  const [elapsed, setElapsed] = useState(0)
  const [activeTab, setActiveTab] = useState<PanelTab>('output')
  const scrollRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ startY: number; startH: number } | null>(null)
  const prevIsRunning = useRef(runner.isRunning)

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current && !collapsed && activeTab === 'output') {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [runner.lines, collapsed, activeTab])

  // Elapsed timer
  useEffect(() => {
    if (!runner.isRunning || !runner.startTime) { setElapsed(0); return undefined }
    const interval = setInterval(() => {
      setElapsed(Date.now() - runner.startTime!)
    }, 100)
    return () => clearInterval(interval)
  }, [runner.isRunning, runner.startTime])

  // Auto-switch to Results tab when run completes with results
  useEffect(() => {
    if (prevIsRunning.current && !runner.isRunning && latestResults.parsedResults) {
      setActiveTab('results')
    }
    prevIsRunning.current = runner.isRunning
  }, [runner.isRunning, latestResults.parsedResults])

  // Resize drag
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragRef.current = { startY: e.clientY, startH: height }

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragRef.current) return
      const delta = dragRef.current.startY - e.clientY
      const newHeight = Math.max(100, Math.min(600, dragRef.current.startH + delta))
      setHeight(newHeight)
    }

    const handleMouseUp = () => {
      dragRef.current = null
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [height])

  if (!showRunner) return null

  // Get active project for navigation
  const activeProjectId =
    state.currentView.type !== 'projects' && state.currentView.type !== 'team-settings'
      ? (state.currentView as { projectId: string }).projectId
      : null

  const handleViewFull = () => {
    if (activeProjectId) {
      navigate({ type: 'test-results', projectId: activeProjectId })
    }
  }

  // Last run summary for collapsed state
  const lastRunSummary = runner.exitCode !== null
    ? `Exited with code ${runner.exitCode}${runner.duration ? ` in ${formatDuration(runner.duration)}` : ''}`
    : runner.isRunning
      ? 'Running...'
      : 'No runs yet'

  if (collapsed) {
    return (
      <div
        className="fixed bottom-0 left-0 right-0 h-[30px] bg-[#0A0A0D] border-t border-vsc-border flex items-center px-4 gap-3 z-30 cursor-pointer select-none"
        onClick={() => setCollapsed(false)}
      >
        {runner.exitCode !== null && (
          <span className={`w-2 h-2 rounded-full shrink-0 ${runner.exitCode === 0 ? 'bg-green-400' : 'bg-red-400'}`} />
        )}
        {runner.isRunning && (
          <svg className="animate-spin h-3 w-3 text-vsc-accent shrink-0" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
          </svg>
        )}
        <span className="text-[11px] text-vsc-muted font-mono">{lastRunSummary}</span>
        {latestResults.parsedResults && !runner.isRunning && (
          <span className="text-[10px] tabular-nums ml-1">
            <span className="text-green-400">{latestResults.parsedResults.passed}P</span>
            {latestResults.parsedResults.failed > 0 && (
              <span className="text-red-400 ml-1">{latestResults.parsedResults.failed}F</span>
            )}
          </span>
        )}
        <div className="flex-1" />
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-vsc-dim">
          <path d="M2 8l4-4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    )
  }

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-30 flex flex-col bg-[#0A0A0D] border-t border-vsc-border"
      style={{ height }}
    >
      {/* Resize handle */}
      <div
        className="h-1.5 cursor-ns-resize hover:bg-vsc-accent/30 transition-colors shrink-0"
        onMouseDown={handleMouseDown}
      />

      {/* Header */}
      <div className="flex items-center px-4 py-1.5 gap-3 border-b border-white/5 shrink-0">
        {/* Tabs */}
        <div className="flex items-center gap-0">
          <button
            onClick={() => setActiveTab('output')}
            className={`text-xs font-semibold px-2.5 py-1 rounded-t transition-colors ${
              activeTab === 'output'
                ? 'text-vsc-accent bg-vsc-accent/10'
                : 'text-vsc-dim hover:text-vsc-muted'
            }`}
          >
            Output
          </button>
          <button
            onClick={() => setActiveTab('results')}
            className={`text-xs font-semibold px-2.5 py-1 rounded-t transition-colors flex items-center gap-1.5 ${
              activeTab === 'results'
                ? 'text-vsc-accent bg-vsc-accent/10'
                : 'text-vsc-dim hover:text-vsc-muted'
            }`}
          >
            Results
            {latestResults.parsedResults && !runner.isRunning && (
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                latestResults.parsedResults.failed > 0 ? 'bg-red-400' : 'bg-green-400'
              }`} />
            )}
          </button>
        </div>

        {runner.isRunning && runner.startTime && (
          <span className="text-[10px] text-vsc-dim font-mono tabular-nums">
            {formatDuration(elapsed)}
          </span>
        )}
        {!runner.isRunning && runner.duration !== null && (
          <span className={`text-[10px] font-mono tabular-nums ${runner.exitCode === 0 ? 'text-green-400' : 'text-red-400'}`}>
            {formatDuration(runner.duration)}
          </span>
        )}
        <div className="flex-1" />

        {/* Stop */}
        {runner.isRunning && (
          <button
            onClick={killCommand}
            className="text-[10px] font-medium text-red-400 hover:text-red-300 border border-red-400/30 hover:border-red-400/50 rounded px-2 py-0.5 transition-colors"
          >
            Stop
          </button>
        )}

        {/* Clear */}
        <button
          onClick={clearRunner}
          className="text-[10px] text-vsc-dim hover:text-vsc-muted transition-colors"
          title="Clear output"
        >
          Clear
        </button>

        {/* Minimize */}
        <button
          onClick={() => setCollapsed(true)}
          className="text-vsc-dim hover:text-vsc-muted transition-colors"
          title="Minimize"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 8l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {/* Close */}
        <button
          onClick={() => setShowRunner(false)}
          className="text-vsc-dim hover:text-vsc-muted transition-colors"
          title="Close"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* Tab content */}
      {activeTab === 'output' ? (
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-2 font-mono text-[13px] leading-relaxed select-text"
          style={{ fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace" }}
        >
          {runner.lines.length === 0 && !runner.isRunning && (
            <span className="text-vsc-dim text-xs">No output yet. Run a test to see results here.</span>
          )}
          {runner.lines.map((line, i) => {
            if (line.type === 'info') {
              return (
                <div key={i} className="text-vsc-accent/70 whitespace-pre-wrap break-all">
                  {line.text}
                </div>
              )
            }
            if (line.type === 'stderr') {
              return (
                <div key={i} className="text-orange-400/90 whitespace-pre-wrap break-all">
                  {line.text}
                </div>
              )
            }
            return (
              <div key={i} className="text-[#d4d4d4] whitespace-pre-wrap break-all">
                {line.text}
              </div>
            )
          })}

          {/* Exit summary */}
          {!runner.isRunning && runner.exitCode !== null && (
            <div className={`mt-2 pt-2 border-t border-white/5 text-xs font-medium ${
              runner.exitCode === 0 ? 'text-green-400' : 'text-red-400'
            }`}>
              Exited with code {runner.exitCode}{runner.duration ? ` in ${formatDuration(runner.duration)}` : ''}
            </div>
          )}
        </div>
      ) : (
        <ResultsTab onViewFull={handleViewFull} />
      )}
    </div>
  )
}
