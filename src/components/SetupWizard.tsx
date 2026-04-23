import { useState, useEffect, useRef, useCallback } from 'react'
import { useAgent } from '../store/AgentContext'
import { Btn } from './common/Btn'

type Step = 1 | 2 | 3 | 4 | 5
const TOTAL_STEPS = 5

function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2 justify-center py-3">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`rounded-full transition-all duration-300 ${
            i + 1 === current
              ? 'w-6 h-2 bg-vsc-accent'
              : i + 1 < current
                ? 'w-2 h-2 bg-vsc-accent/50'
                : 'w-2 h-2 bg-vsc-border'
          }`}
        />
      ))}
    </div>
  )
}

function CopyBlock({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }
  return (
    <div className="flex items-center bg-vsc-bg border border-vsc-border rounded-lg overflow-hidden">
      <code className="flex-1 px-4 py-3 text-sm font-mono text-vsc-accent break-all">{text}</code>
      <button
        onClick={handleCopy}
        className="px-4 py-3 text-xs text-vsc-muted hover:text-vsc-accent hover:bg-vsc-hover border-l border-vsc-border transition-colors shrink-0"
      >
        {copied ? (
          <span className="text-green-400 flex items-center gap-1">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Copied
          </span>
        ) : 'Copy'}
      </button>
    </div>
  )
}

function GreenCheck() {
  return (
    <div className="flex items-center gap-2 text-green-400 animate-fade-in">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M4.5 8l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  )
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4 text-vsc-accent" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
    </svg>
  )
}

export function SetupWizard({ onClose }: { onClose: () => void }) {
  const {
    isConnected, agentUrl, agentToken, setAgentToken, connect, saveSettings,
    detectedProtocol, setShowSetupWizard,
  } = useAgent()

  const [step, setStep] = useState<Step>(1)
  const [tokenInput, setTokenInput] = useState(agentToken)
  const [showToken, setShowToken] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [verifyResult, setVerifyResult] = useState<{ ok: boolean; error?: string } | null>(null)
  const [polling, setPolling] = useState(false)
  const [detected, setDetected] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const autoAdvanceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // If already connected on open, jump to step 5
  useEffect(() => {
    if (isConnected && agentToken) setStep(5)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
      if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current)
    }
  }, [])

  // Step 2: Poll for agent connection
  const startPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current)
    setPolling(true)
    setDetected(false)

    pollRef.current = setInterval(async () => {
      const token = tokenInput || agentToken
      if (!token) return
      const result = await connect(token)
      if (result.ok) {
        setDetected(true)
        setPolling(false)
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
        autoAdvanceRef.current = setTimeout(() => {
          const needsCert = window.location.protocol === 'https:' && detectedProtocol === 'http'
          setStep(needsCert ? 3 : 4)
        }, 1500)
      }
    }, 3000)
  }, [tokenInput, agentToken, connect, detectedProtocol])

  useEffect(() => {
    if (step === 2 && (tokenInput || agentToken)) startPolling()
    return () => {
      if (step !== 2 && pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
    }
  }, [step]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleVerifyToken = async () => {
    setVerifying(true)
    setVerifyResult(null)
    const result = await connect(tokenInput)
    setVerifyResult({ ok: result.ok, error: result.error })
    if (result.ok) {
      setAgentToken(tokenInput)
      await saveSettings()
      autoAdvanceRef.current = setTimeout(() => setStep(5), 1000)
    }
    setVerifying(false)
  }

  const handleDone = async () => {
    // Save agent settings to project (marks setup complete)
    await saveSettings()
    setShowSetupWizard(false)
    onClose()
  }

  const handleSkip = async () => {
    // Mark setup complete on project so wizard doesn't re-appear
    await saveSettings()
    setShowSetupWizard(false)
    onClose()
  }

  const canGoNext = () => {
    switch (step) {
      case 1: return true
      case 2: return detected || isConnected
      case 3: return isConnected
      case 4: return verifyResult?.ok === true || isConnected
      case 5: return true
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/30 backdrop-blur-[2px] flex items-center justify-center z-50 p-4 animate-fade-in"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-vsc-panel border border-vsc-border rounded-xl shadow-2xl w-[520px] max-h-[90vh] flex flex-col animate-slide-down">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-vsc-border shrink-0">
          <h2 className="text-sm font-semibold text-vsc-text">Set Up Your Agent</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-md text-vsc-dim hover:text-vsc-text hover:bg-vsc-hover transition-colors text-lg leading-none"
          >
            x
          </button>
        </div>

        {/* Step indicator */}
        <StepDots current={step} total={TOTAL_STEPS} />

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {/* Step 1: Install */}
          {step === 1 && (
            <div className="flex flex-col gap-5">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-vsc-accent/10 text-vsc-accent mx-auto">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2v12m0 0l-4-4m4 4l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              <div className="text-center">
                <h3 className="text-base font-semibold text-vsc-text mb-2">Install the Agent</h3>
                <p className="text-xs text-vsc-muted leading-relaxed">
                  The Autoscriptor agent runs on your computer and executes your tests locally.
                  It connects to this app so you can run Playwright tests with one click.
                </p>
              </div>
              <CopyBlock text="npm install -g autoscriptor-agent" />
              <button
                onClick={() => setStep(2)}
                className="text-xs text-vsc-accent hover:underline self-center"
              >
                Already installed? Skip to next step
              </button>
            </div>
          )}

          {/* Step 2: Start */}
          {step === 2 && (
            <div className="flex flex-col gap-5">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-vsc-accent/10 text-vsc-accent mx-auto">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M5 3l14 9-14 9V3z" fill="currentColor" fillOpacity="0.7"/>
                </svg>
              </div>
              <div className="text-center">
                <h3 className="text-base font-semibold text-vsc-text mb-2">Start the Agent</h3>
                <p className="text-xs text-vsc-muted leading-relaxed">
                  Run this in any terminal window. Keep it running while you use Autoscriptor.
                </p>
              </div>
              <CopyBlock text="autoscriptor-agent start" />

              {!agentToken && (
                <div className="flex flex-col gap-2">
                  <label className="text-xs text-vsc-muted">
                    Paste the token shown in your terminal to connect:
                  </label>
                  <input
                    type="text"
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    className="w-full bg-vsc-bg border border-vsc-border rounded-lg px-3 py-2 text-xs font-mono text-vsc-text placeholder-vsc-dim focus:border-vsc-accent outline-none transition-all"
                  />
                </div>
              )}

              <div className="flex items-center justify-center gap-2 py-2">
                {detected ? (
                  <>
                    <GreenCheck />
                    <span className="text-sm text-green-400 font-medium">Agent connected!</span>
                  </>
                ) : polling ? (
                  <>
                    <Spinner />
                    <span className="text-xs text-vsc-muted">Waiting for agent...</span>
                  </>
                ) : (
                  <span className="text-xs text-vsc-dim">Enter your token and start polling</span>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Certificate trust */}
          {step === 3 && (
            <div className="flex flex-col gap-5">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-amber-500/10 text-amber-400 mx-auto">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2L3 7v5c0 5.5 3.8 10.7 9 12 5.2-1.3 9-6.5 9-12V7l-9-5z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
                  <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              <div className="text-center">
                <h3 className="text-base font-semibold text-vsc-text mb-2">Trust the Certificate</h3>
                <p className="text-xs text-vsc-muted leading-relaxed">
                  Your browser may show a security warning because the agent uses a local certificate.
                  This is normal and safe — the agent only runs on your machine.
                </p>
              </div>
              <div className="bg-vsc-bg border border-vsc-border rounded-lg p-4 flex flex-col gap-3">
                <p className="text-xs text-vsc-text font-medium">Follow these steps:</p>
                <ol className="text-xs text-vsc-muted space-y-2 list-decimal list-inside">
                  <li>
                    <a
                      href="https://localhost:4568/health"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-vsc-accent hover:underline"
                    >
                      Open https://localhost:4568/health in a new tab
                    </a>
                  </li>
                  <li>Click <strong className="text-vsc-text">Advanced</strong> (or Show Details)</li>
                  <li>Click <strong className="text-vsc-text">Proceed to localhost</strong></li>
                </ol>
              </div>
              {isConnected && (
                <div className="flex items-center justify-center gap-2">
                  <GreenCheck />
                  <span className="text-sm text-green-400 font-medium">Certificate accepted!</span>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Token */}
          {step === 4 && (
            <div className="flex flex-col gap-5">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-vsc-accent/10 text-vsc-accent mx-auto">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="2"/>
                  <path d="M7 11V7a5 5 0 0110 0v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <circle cx="12" cy="16" r="1.5" fill="currentColor"/>
                </svg>
              </div>
              <div className="text-center">
                <h3 className="text-base font-semibold text-vsc-text mb-2">Enter Agent Token</h3>
                <p className="text-xs text-vsc-muted leading-relaxed">
                  Copy the token shown in your terminal when the agent started.
                </p>
              </div>
              <div className="relative">
                <input
                  type={showToken ? 'text' : 'password'}
                  value={tokenInput}
                  onChange={(e) => { setTokenInput(e.target.value); setVerifyResult(null) }}
                  placeholder="Paste your agent token here"
                  className="w-full bg-vsc-bg border border-vsc-border rounded-lg px-4 py-3 text-sm font-mono text-vsc-text placeholder-vsc-dim focus:border-vsc-accent outline-none transition-all pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowToken((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-vsc-dim hover:text-vsc-muted transition-colors"
                >
                  {showToken ? (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M1 7s2.5-4 6-4 6 4 6 4-2.5 4-6 4S1 7 1 7z" stroke="currentColor" strokeWidth="1.3"/>
                      <circle cx="7" cy="7" r="1.5" stroke="currentColor" strokeWidth="1.3"/>
                      <path d="M2 2l10 10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M1 7s2.5-4 6-4 6 4 6 4-2.5 4-6 4S1 7 1 7z" stroke="currentColor" strokeWidth="1.3"/>
                      <circle cx="7" cy="7" r="1.5" stroke="currentColor" strokeWidth="1.3"/>
                    </svg>
                  )}
                </button>
              </div>

              <div className="flex items-center gap-3">
                <Btn
                  variant="primary"
                  onClick={handleVerifyToken}
                  disabled={!tokenInput.trim() || verifying}
                >
                  {verifying ? 'Verifying...' : 'Verify'}
                </Btn>

                {verifyResult && (
                  <div className={`flex items-center gap-1.5 text-xs ${verifyResult.ok ? 'text-green-400' : 'text-red-400'}`}>
                    {verifyResult.ok ? (
                      <>
                        <GreenCheck />
                        <span>Token verified!</span>
                      </>
                    ) : (
                      <>
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                        </svg>
                        <span>Invalid token — check your terminal</span>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 5: Done */}
          {step === 5 && (
            <div className="flex flex-col gap-5 items-center text-center">
              <div className="flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 text-green-400">
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                  <circle cx="16" cy="16" r="12" stroke="currentColor" strokeWidth="2"/>
                  <path d="M10 16l4 4 8-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-vsc-text mb-2">All Set!</h3>
                <p className="text-sm text-vsc-muted">
                  Agent connected at <span className="text-vsc-accent font-mono text-xs">{
                    (() => { try { return new URL(agentUrl).host } catch { return 'localhost' } })()
                  }</span>
                </p>
                <p className="text-xs text-vsc-dim mt-2">
                  You can now run tests directly from the app.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-vsc-border shrink-0 flex items-center justify-between">
          <button
            onClick={handleSkip}
            className="text-xs text-vsc-dim hover:text-vsc-muted transition-colors"
          >
            Skip Setup
          </button>
          <div className="flex items-center gap-3">
            {step > 1 && step < 5 && (
              <Btn variant="ghost" onClick={() => setStep((step - 1) as Step)}>
                Back
              </Btn>
            )}
            {step < 5 ? (
              <Btn
                variant="primary"
                onClick={() => setStep((step + 1) as Step)}
                disabled={!canGoNext()}
              >
                Next
              </Btn>
            ) : (
              <Btn variant="primary" onClick={handleDone}>
                Done
              </Btn>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
