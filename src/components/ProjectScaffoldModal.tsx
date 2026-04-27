import { useState, useEffect, useCallback } from 'react'
import { useAgent } from '../store/AgentContext'
import { Btn } from './common/Btn'

type StepStatus = 'pending' | 'running' | 'done' | 'error'

interface ScaffoldStep {
  label: string
  status: StepStatus
  error?: string
}

const INITIAL_STEPS: ScaffoldStep[] = [
  { label: 'Creating project folder...', status: 'pending' },
  { label: 'Initializing npm project...', status: 'pending' },
  { label: 'Installing Playwright...', status: 'pending' },
  { label: 'Installing browsers (this may take a minute)...', status: 'pending' },
  { label: 'Creating folder structure...', status: 'pending' },
  { label: 'Done!', status: 'pending' },
]

interface Props {
  directory: string
  projectName: string
  onClose: () => void
  onComplete: () => void
}

export function ProjectScaffoldModal({ directory, projectName, onClose, onComplete }: Props) {
  const { client } = useAgent()
  const [steps, setSteps] = useState<ScaffoldStep[]>(INITIAL_STEPS.map((s) => ({ ...s })))
  const [currentStep, setCurrentStep] = useState(0)
  const [failed, setFailed] = useState(false)

  const progressPercent = Math.round(
    (steps.filter((s) => s.status === 'done').length / steps.length) * 100
  )

  const runScaffold = useCallback(async () => {
    if (!client) return

    setFailed(false)
    setSteps(INITIAL_STEPS.map((s) => ({ ...s })))
    setCurrentStep(0)

    const updateStep = (idx: number, status: StepStatus, error?: string) => {
      setSteps((prev) => prev.map((s, i) => (i === idx ? { ...s, status, error } : s)))
    }

    try {
      // Step 0: Create project folder (via set dir)
      updateStep(0, 'running')
      setCurrentStep(0)
      await client.setProjectDir(directory)
      updateStep(0, 'done')

      // Step 1-4: Scaffold (npm init, install playwright, browsers, folder structure)
      updateStep(1, 'running')
      setCurrentStep(1)

      // The scaffold endpoint handles npm init + playwright install + browsers + folder structure
      const result = await client.scaffoldProject(directory, projectName)

      if (!result.success) {
        const errorMsg = result.errors?.join('; ') || 'Scaffold failed'
        updateStep(1, 'error', errorMsg)
        setFailed(true)
        return
      }

      // Mark steps 1-4 as done (scaffold handles all of them)
      updateStep(1, 'done')
      updateStep(2, 'running')
      setCurrentStep(2)
      // Small delay to show progress visually
      await new Promise((r) => setTimeout(r, 300))
      updateStep(2, 'done')

      updateStep(3, 'running')
      setCurrentStep(3)
      await new Promise((r) => setTimeout(r, 300))
      updateStep(3, 'done')

      updateStep(4, 'running')
      setCurrentStep(4)
      await new Promise((r) => setTimeout(r, 300))
      updateStep(4, 'done')

      // Step 5: Done
      updateStep(5, 'done')
      setCurrentStep(5)
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error'
      updateStep(currentStep, 'error', errMsg)
      setFailed(true)
    }
  }, [client, directory, projectName, currentStep])

  useEffect(() => {
    runScaffold()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const allDone = steps.every((s) => s.status === 'done')

  return (
    <div
      className="fixed inset-0 bg-black/30 backdrop-blur-[2px] flex items-center justify-center z-50 p-4 animate-fade-in"
      onClick={(e) => e.target === e.currentTarget && !failed && onClose()}
    >
      <div className="bg-vsc-panel border border-vsc-border rounded-xl shadow-2xl w-[480px] flex flex-col animate-slide-down">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-vsc-border">
          <h2 className="text-sm font-semibold text-vsc-text">Setting Up Project</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-md text-vsc-dim hover:text-vsc-text hover:bg-vsc-hover transition-colors text-lg leading-none"
          >
            x
          </button>
        </div>

        {/* Progress bar */}
        <div className="px-6 pt-4">
          <div className="w-full h-1.5 bg-vsc-border rounded-full overflow-hidden">
            <div
              className="h-full bg-vsc-accent rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="text-[9px] text-vsc-dim text-right mt-1">{progressPercent}%</p>
        </div>

        {/* Steps */}
        <div className="px-6 py-4 flex flex-col gap-2.5">
          {steps.map((step, i) => (
            <div key={i} className="flex items-center gap-3">
              {/* Status icon */}
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

              {/* Label */}
              <div className="flex-1 min-w-0">
                <p className={`text-xs ${
                  step.status === 'done' ? 'text-green-400' :
                  step.status === 'running' ? 'text-vsc-text' :
                  step.status === 'error' ? 'text-red-400' :
                  'text-vsc-dim'
                }`}>
                  {step.label}
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

        {/* Footer */}
        <div className="px-6 py-4 border-t border-vsc-border flex items-center justify-end gap-3">
          {failed && (
            <Btn variant="primary" onClick={runScaffold}>
              Retry
            </Btn>
          )}
          {allDone && (
            <Btn variant="primary" onClick={() => { onComplete(); onClose() }}>
              Done
            </Btn>
          )}
          {!allDone && !failed && (
            <Btn variant="ghost" onClick={onClose}>
              Cancel
            </Btn>
          )}
        </div>
      </div>
    </div>
  )
}
