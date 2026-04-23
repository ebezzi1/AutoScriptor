import { useState, useEffect, useRef, useCallback } from 'react'
import { useAgent } from '../../store/AgentContext'
import { Btn } from '../common/Btn'
import { ScaffoldService } from '../../services/scaffoldService'
import { AgentClientService } from '../../services/agentClient'
import type { ScaffoldEvent, ScaffoldStep } from '../../services/scaffoldService'

interface Props {
  directory: string
  projectId: string
  projectName: string
  onClose: () => void
  onComplete: () => void
}

export function ScaffoldProgressModal({
  directory,
  projectId,
  projectName,
  onClose,
  onComplete,
}: Props) {
  const { client, agentUrl, agentToken } = useAgent()

  const [steps, setSteps] = useState<ScaffoldStep[]>([])
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState<'running' | 'done' | 'error'>('running')
  const [errorMessage, setErrorMessage] = useState('')
  const [terminalLines, setTerminalLines] = useState<string[]>([])
  const [showTerminal, setShowTerminal] = useState(false)
  const terminalRef = useRef<HTMLDivElement>(null)
  const scaffoldRef = useRef<ScaffoldService | null>(null)

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalRef.current && showTerminal) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, [terminalLines, showTerminal])

  // Auto-expand terminal on error
  useEffect(() => {
    if (status === 'error') setShowTerminal(true)
  }, [status])

  const handleEvent = useCallback((event: ScaffoldEvent) => {
    setSteps([...event.steps])
    setProgress(event.progress)

    if (event.message) {
      setTerminalLines((prev) => [...prev, `[${event.type}] ${event.message}`])
    }

    if (event.type === 'complete') {
      setStatus('done')
    } else if (event.type === 'failed') {
      setStatus('error')
      setErrorMessage(event.message)
    }
  }, [])

  const runScaffold = useCallback(async () => {
    if (!client) return

    setStatus('running')
    setProgress(0)
    setTerminalLines([])
    setErrorMessage('')

    const agentSvc = new AgentClientService({ baseUrl: agentUrl, token: agentToken })
    const scaffold = new ScaffoldService(agentSvc, projectId)
    scaffoldRef.current = scaffold

    const unsub = scaffold.on(handleEvent)
    setSteps([...scaffold.currentSteps])

    await scaffold.run(directory, projectName)
    unsub()
  }, [client, agentUrl, agentToken, projectId, directory, projectName, handleEvent])

  useEffect(() => {
    runScaffold()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleOpenIDE = async (ide: 'vscode' | 'cursor' | 'terminal') => {
    try {
      await client?.openInIDE(ide)
    } catch {
      // ignore
    }
  }

  const isRunning = status === 'running'

  return (
    <div
      className="fixed inset-0 bg-black/30 backdrop-blur-[2px] flex items-center justify-center z-50 p-4 animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isRunning) onClose()
      }}
    >
      <div className="bg-vsc-panel border border-vsc-border rounded-xl shadow-2xl w-[520px] max-h-[90vh] flex flex-col animate-slide-down">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-vsc-border shrink-0">
          <h2 className="text-sm font-semibold text-vsc-text">
            {status === 'done' ? 'Project Ready' : status === 'error' ? 'Scaffold Failed' : 'Setting Up Project'}
          </h2>
          <button
            onClick={onClose}
            disabled={isRunning}
            className="w-7 h-7 flex items-center justify-center rounded-md text-vsc-dim hover:text-vsc-text hover:bg-vsc-hover transition-colors text-lg leading-none disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Close"
          >
            x
          </button>
        </div>

        {/* Progress bar */}
        <div className="px-6 pt-4">
          <div className="w-full h-1.5 bg-vsc-border rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ease-out ${
                status === 'error' ? 'bg-red-400' : 'bg-vsc-accent'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-1">
            <p className="text-[9px] text-vsc-dim">
              {status === 'done'
                ? 'Complete'
                : status === 'error'
                  ? 'Failed'
                  : steps.find((s) => s.status === 'running')?.displayName ?? 'Preparing...'}
            </p>
            <p className="text-[9px] text-vsc-dim">{progress}%</p>
          </div>
        </div>

        {/* Steps */}
        <div className="px-6 py-4 flex flex-col gap-2.5">
          {steps.map((step) => (
            <div key={step.label} className="flex items-center gap-3">
              <div className="w-5 h-5 flex items-center justify-center shrink-0">
                {step.status === 'done' && (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-green-400">
                    <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M4.5 8l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
                {step.status === 'running' && (
                  <svg className="animate-spin h-4 w-4 text-vsc-accent" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                  </svg>
                )}
                {step.status === 'error' && (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-red-400">
                    <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M5 5l6 6M11 5l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                )}
                {step.status === 'pending' && (
                  <div className="w-3 h-3 rounded-full border border-vsc-border" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-xs ${
                  step.status === 'done' ? 'text-green-400' :
                  step.status === 'running' ? 'text-vsc-text' :
                  step.status === 'error' ? 'text-red-400' :
                  'text-vsc-dim'
                }`}>
                  {step.displayName}
                </p>
                {step.error && (
                  <p className="text-[10px] text-red-400/80 mt-0.5 truncate" title={step.error}>
                    {step.error}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Terminal output toggle + content */}
        <div className="px-6 pb-2">
          <button
            onClick={() => setShowTerminal((v) => !v)}
            className="flex items-center gap-2 text-[9px] text-vsc-dim hover:text-vsc-muted uppercase tracking-wider transition-colors"
          >
            <span className={`transition-transform inline-block ${showTerminal ? 'rotate-90' : ''}`}>
              ▸
            </span>
            {showTerminal ? 'Hide' : 'Show'} terminal output
          </button>

          {showTerminal && (
            <div
              ref={terminalRef}
              className="mt-2 bg-[#0d0d0d] border border-vsc-border rounded-md p-3 max-h-[160px] overflow-y-auto font-mono text-[10px] leading-relaxed"
            >
              {terminalLines.length === 0 ? (
                <p className="text-vsc-dim">Waiting for output...</p>
              ) : (
                terminalLines.map((line, i) => (
                  <p
                    key={i}
                    className={
                      line.includes('[step_error]') || line.includes('[failed]')
                        ? 'text-red-400'
                        : line.includes('[complete]') || line.includes('[step_done]')
                          ? 'text-green-400'
                          : 'text-vsc-muted'
                    }
                  >
                    {line}
                  </p>
                ))
              )}
            </div>
          )}
        </div>

        {/* Error message */}
        {status === 'error' && errorMessage && (
          <div className="mx-6 mb-2 px-4 py-3 rounded-lg border border-red-500/30 bg-red-500/5">
            <p className="text-xs text-red-400">{errorMessage}</p>
          </div>
        )}

        {/* Success: IDE open buttons */}
        {status === 'done' && (
          <div className="px-6 pb-2">
            <p className="text-[10px] text-vsc-dim mb-2">Open project in:</p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleOpenIDE('vscode')}
                className="text-[9px] uppercase tracking-wider border border-vsc-border text-vsc-muted px-3 py-1.5 rounded-sm hover:border-vsc-accent/60 hover:text-vsc-accent transition-all flex items-center gap-1.5"
              >
                <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                  <path d="M11.5 1L5 7l6.5 6 2.5-1.5v-9L11.5 1z" fill="currentColor" fillOpacity="0.6"/>
                  <path d="M5 7L1.5 4 3 2.5 11.5 7 3 11.5 1.5 10 5 7z" fill="currentColor" fillOpacity="0.4"/>
                </svg>
                VS Code
              </button>
              <button
                onClick={() => handleOpenIDE('cursor')}
                className="text-[9px] uppercase tracking-wider border border-vsc-border text-vsc-muted px-3 py-1.5 rounded-sm hover:border-vsc-accent/60 hover:text-vsc-accent transition-all flex items-center gap-1.5"
              >
                <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                  <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.4"/>
                  <path d="M5 8h6M8 5v6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
                Cursor
              </button>
              <button
                onClick={() => handleOpenIDE('terminal')}
                className="text-[9px] uppercase tracking-wider border border-vsc-border text-vsc-muted px-3 py-1.5 rounded-sm hover:border-vsc-accent/60 hover:text-vsc-accent transition-all flex items-center gap-1.5"
              >
                <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                  <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
                  <path d="M4 7l2.5 2L4 11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M8.5 11H12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                </svg>
                Terminal
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t border-vsc-border shrink-0 flex items-center justify-end gap-3">
          {status === 'error' && (
            <Btn variant="primary" onClick={runScaffold}>
              Retry
            </Btn>
          )}
          {status === 'done' && (
            <Btn
              variant="primary"
              onClick={() => {
                onComplete()
                onClose()
              }}
            >
              Done
            </Btn>
          )}
          {isRunning && (
            <span className="text-[10px] text-vsc-dim animate-pulse">
              Setting up project...
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
