import { useState, useEffect, useRef, useCallback } from 'react'
import { useAgent } from '../store/AgentContext'

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

export function TestRunnerPanel() {
  const { runner, killCommand, clearRunner, showRunner, setShowRunner } = useAgent()
  const [collapsed, setCollapsed] = useState(false)
  const [height, setHeight] = useState(300)
  const [elapsed, setElapsed] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ startY: number; startH: number } | null>(null)

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current && !collapsed) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [runner.lines, collapsed])

  // Elapsed timer
  useEffect(() => {
    if (!runner.isRunning || !runner.startTime) { setElapsed(0); return undefined }
    const interval = setInterval(() => {
      setElapsed(Date.now() - runner.startTime!)
    }, 100)
    return () => clearInterval(interval)
  }, [runner.isRunning, runner.startTime])

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
        <span className="text-xs font-semibold text-vsc-muted">Test Runner</span>
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

      {/* Body — scrollable output */}
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
    </div>
  )
}
