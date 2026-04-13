import { useState, useRef } from 'react'
import { useApp } from '../store/AppContext'
import { useToast } from './common/Toast'
import { Btn } from './common/Btn'
import { Field, Select, inputCls } from './common/Field'
import { PRIORITY_COLORS } from '../types'
import type { TestCase, TestStep, Priority, SelectorStrategy, ActionType, AssertionType, Feature } from '../types'
import { supabase } from '../lib/supabase'

// ── Sparkle icon (reusable) ──────────────────────────────────────────────────

export function SparkleIcon({ size = 12, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" className={className}>
      <path
        d="M6 1l.9 3.1L10 5l-3.1.9L6 9l-.9-3.1L2 5l3.1-.9L6 1z"
        stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" fill="currentColor" fillOpacity="0.2"
      />
    </svg>
  )
}

// ── Types ────────────────────────────────────────────────────────────────────

interface RawGeneratedStep {
  selector: string
  selectorStrategy: SelectorStrategy
  action: ActionType
  value: string
  assertion: AssertionType
  assertionValue: string
}

interface RawGeneratedTC {
  name: string
  description: string
  priority: Priority
  tags: string[]
  pageUrl: string
  steps: RawGeneratedStep[]
}

type ReviewStatus = 'pending' | 'added' | 'dismissed'

interface ReviewTC extends RawGeneratedTC {
  uid: string
  status: ReviewStatus
  expanded: boolean
}

type Screen = 'input' | 'loading' | 'review' | 'done'

// ── Helpers ──────────────────────────────────────────────────────────────────

function rawToTestStep(raw: RawGeneratedStep, order: number): TestStep {
  return {
    id: crypto.randomUUID(),
    order,
    selector: raw.selector ?? '',
    selectorStrategy: raw.selectorStrategy ?? 'css',
    action: raw.action ?? 'click',
    value: raw.value ?? '',
    assertion: raw.assertion ?? 'none',
    assertionValue: raw.assertionValue ?? '',
    waitBehavior: 'auto',
  }
}

function reviewTcToTestCase(
  rtc: ReviewTC,
  featureId: string,
  projectId: string,
  sourceText: string
): TestCase {
  const tags = rtc.tags.includes('@ai-generated') ? rtc.tags : ['@ai-generated', ...rtc.tags]
  return {
    id: crypto.randomUUID(),
    featureId,
    projectId,
    name: rtc.name,
    description: rtc.description ?? '',
    priority: rtc.priority ?? 'P2',
    tags,
    annotations: [],
    viewport: null,
    screenshotOnFailure: false,
    traceRecording: false,
    pageUrl: rtc.pageUrl ?? undefined,
    steps: rtc.steps.map((s, i) => rawToTestStep(s, i)),
    type: 'ui',
    apiSteps: [],
    source: 'ai_generated',
    sourceText,
  }
}

// ── Read-only step list ──────────────────────────────────────────────────────

function ReadOnlyStepList({ steps }: { steps: RawGeneratedStep[] }) {
  if (steps.length === 0) {
    return <p className="text-xs text-vsc-dim py-2">No steps</p>
  }
  return (
    <div className="flex flex-col gap-1 mt-2">
      {steps.map((s, i) => (
        <div
          key={i}
          className="flex items-start gap-2 px-3 py-2 bg-vsc-bg/40 border border-vsc-border/40 rounded-lg text-xs"
        >
          <span className="text-vsc-dim tabular-nums shrink-0 w-5 text-right">{i + 1}.</span>
          <span className="text-vsc-accent font-semibold shrink-0 capitalize">{s.action}</span>
          {s.selector && (
            <code className="text-vsc-muted font-mono truncate flex-1 max-w-[200px]">{s.selector}</code>
          )}
          {s.value && (
            <span className="text-vsc-text/70 truncate max-w-[120px]">"{s.value}"</span>
          )}
          {s.assertion && s.assertion !== 'none' && (
            <span className="ml-auto shrink-0 text-green-400/80 font-medium">{s.assertion}</span>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Review card ──────────────────────────────────────────────────────────────

interface ReviewCardProps {
  rtc: ReviewTC
  onAdd: () => void
  onEditAndAdd: () => void
  onDismiss: () => void
  onToggleExpand: () => void
}

function ReviewCard({ rtc, onAdd, onEditAndAdd, onDismiss, onToggleExpand }: ReviewCardProps) {
  const isDone = rtc.status !== 'pending'
  return (
    <div
      className={`border rounded-xl overflow-hidden transition-all duration-200 ${
        rtc.status === 'added'
          ? 'border-green-500/30 bg-green-500/5 opacity-70'
          : rtc.status === 'dismissed'
          ? 'border-vsc-border/30 bg-vsc-bg/30 opacity-40'
          : 'border-vsc-border bg-vsc-panel'
      }`}
    >
      {/* Card header */}
      <div className="px-4 py-3 flex items-start gap-3">
        {/* Status icon / expand toggle */}
        <button
          onClick={onToggleExpand}
          disabled={isDone}
          className="mt-0.5 shrink-0 text-vsc-dim hover:text-vsc-text transition-colors"
          aria-label={rtc.expanded ? 'Collapse' : 'Expand'}
        >
          {rtc.status === 'added' ? (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-green-400">
              <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.4"/>
              <path d="M5 8l2.5 2.5L11 5.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          ) : rtc.status === 'dismissed' ? (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-vsc-dim">
              <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.4"/>
              <path d="M5.5 10.5l5-5M10.5 10.5l-5-5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
          ) : (
            <svg
              width="14" height="14" viewBox="0 0 14 14" fill="none"
              className={`transition-transform duration-150 ${rtc.expanded ? 'rotate-90' : ''}`}
            >
              <path d="M4 3l6 4-6 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </button>

        {/* TC info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-vsc-text leading-snug">{rtc.name}</span>
            <span className={`text-2xs px-2 py-0.5 rounded-full font-semibold border shrink-0 ${PRIORITY_COLORS[rtc.priority] ?? PRIORITY_COLORS.P2}`}>
              {rtc.priority}
            </span>
            {rtc.tags.map((t) => (
              <span key={t} className="text-2xs border border-vsc-accent/30 text-vsc-accent px-2 py-0.5 rounded-full font-medium shrink-0">
                {t}
              </span>
            ))}
          </div>
          {rtc.pageUrl && (
            <p className="text-xs text-vsc-dim mt-0.5 font-mono truncate">{rtc.pageUrl}</p>
          )}
          {rtc.description && (
            <p className="text-xs text-vsc-muted mt-1 line-clamp-2">{rtc.description}</p>
          )}
        </div>

        {/* Action buttons */}
        {!isDone && (
          <div className="flex items-center gap-1.5 shrink-0">
            <Btn variant="primary" size="sm" onClick={onAdd}>Add</Btn>
            <Btn variant="secondary" size="sm" onClick={onEditAndAdd}>Edit & Add</Btn>
            <Btn variant="ghost" size="sm" onClick={onDismiss}>Dismiss</Btn>
          </div>
        )}
      </div>

      {/* Expandable steps */}
      {rtc.expanded && !isDone && (
        <div className="px-4 pb-3 border-t border-vsc-border/40">
          <p className="text-xs text-vsc-dim mt-2 mb-1 font-semibold uppercase tracking-widest">
            Steps ({rtc.steps.length})
          </p>
          <ReadOnlyStepList steps={rtc.steps} />
        </div>
      )}
    </div>
  )
}

// ── Main modal ───────────────────────────────────────────────────────────────

interface Props {
  projectId: string
  /** Pre-selected feature ID; undefined = user must choose */
  initialFeatureId?: string
  onClose: () => void
}

export function AiGenerateModal({ projectId, initialFeatureId, onClose }: Props) {
  const { state, dispatch, navigate } = useApp()
  const { toast } = useToast()

  const project = state.projects.find((p) => p.id === projectId)
  const features = state.features.filter((f) => f.projectId === projectId)

  const [screen, setScreen] = useState<Screen>('input')
  const [requirementText, setRequirementText] = useState('')
  const [contextText, setContextText] = useState('')
  const [selectedFeatureId, setSelectedFeatureId] = useState<string>(
    initialFeatureId ?? features[0]?.id ?? ''
  )
  const [defaultPriority, setDefaultPriority] = useState<Priority>('P2')
  const [loadingMessage, setLoadingMessage] = useState('Analyzing requirements...')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [generateCooldown, setGenerateCooldown] = useState(false)
  const [reviewTCs, setReviewTCs] = useState<ReviewTC[]>([])
  const addedCountRef = useRef(0)
  const dismissedCountRef = useRef(0)

  // ── Animated loading messages ──────────────────────────────────────────────
  const loadingMessages = [
    'Analyzing requirements...',
    'Identifying test scenarios...',
    'Generating test steps...',
    'Building assertions...',
    'Finalizing test cases...',
  ]

  const callEdgeFunction = async (
    requirements: string,
    context: string,
    baseUrl: string,
    selectorStrategy: SelectorStrategy,
    defaultPriority: Priority,
    retryAttempt = 0
  ): Promise<RawGeneratedTC[]> => {
    // Animate loading messages
    let msgIdx = 0
    const msgInterval = setInterval(() => {
      msgIdx = (msgIdx + 1) % loadingMessages.length
      setLoadingMessage(loadingMessages[msgIdx])
    }, 1800)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('You must be signed in to use AI generation')

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
      const response = await fetch(`${supabaseUrl}/functions/v1/generate-tests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ requirements, context, baseUrl, selectorStrategy, defaultPriority }),
      })

      clearInterval(msgInterval)

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({ error: response.statusText }))
        throw new Error(errBody?.error ?? `API error ${response.status}`)
      }

      const parsed = await response.json() as RawGeneratedTC[]
      if (!Array.isArray(parsed)) {
        if (retryAttempt === 0) {
          return callEdgeFunction(requirements, context, baseUrl, selectorStrategy, defaultPriority, 1)
        }
        throw new Error('Generation failed — try simplifying your requirements')
      }
      return parsed
    } catch (err) {
      clearInterval(msgInterval)
      throw err
    }
  }

  const handleGenerate = async () => {
    if (!requirementText.trim()) return
    if (!selectedFeatureId) {
      setErrorMsg('Please select a target feature first')
      return
    }

    setGenerateCooldown(true)
    setTimeout(() => setGenerateCooldown(false), 3000)

    setErrorMsg(null)
    setScreen('loading')
    setLoadingMessage('Analyzing requirements...')

    try {
      const result = await callEdgeFunction(
        requirementText,
        contextText,
        project?.baseUrl ?? '',
        project?.selectorStrategy ?? 'css',
        defaultPriority
      )
      if (result.length === 0) {
        setErrorMsg('No test cases could be generated — try adding more detail to your requirements')
        setScreen('input')
        return
      }
      setReviewTCs(
        result.map((tc) => ({
          ...tc,
          priority: (tc.priority as Priority) ?? defaultPriority,
          uid: crypto.randomUUID(),
          status: 'pending',
          expanded: false,
        }))
      )
      addedCountRef.current = 0
      dismissedCountRef.current = 0
      setScreen('review')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Generation failed'
      setErrorMsg(msg)
      setScreen('input')
    }
  }

  const createTc = (rtc: ReviewTC): TestCase => {
    return reviewTcToTestCase(rtc, selectedFeatureId, projectId, requirementText)
  }

  const handleAdd = (uid: string) => {
    const rtc = reviewTCs.find((r) => r.uid === uid)
    if (!rtc) return
    const tc = createTc(rtc)
    dispatch({ type: 'CREATE_TC', tc })
    toast(`Test case "${tc.name}" added`)
    addedCountRef.current += 1
    setReviewTCs((prev) => prev.map((r) => r.uid === uid ? { ...r, status: 'added', expanded: false } : r))
    checkAllDone()
  }

  const handleEditAndAdd = (uid: string) => {
    const rtc = reviewTCs.find((r) => r.uid === uid)
    if (!rtc) return
    const tc = createTc(rtc)
    const feature = features.find((f) => f.id === selectedFeatureId)
    dispatch({ type: 'CREATE_TC', tc })
    toast(`Test case "${tc.name}" added`)
    addedCountRef.current += 1
    setReviewTCs((prev) => prev.map((r) => r.uid === uid ? { ...r, status: 'added', expanded: false } : r))
    onClose()
    navigate({
      type: 'test-case',
      projectId,
      featureId: feature?.id ?? selectedFeatureId,
      testCaseId: tc.id,
    })
  }

  const handleDismiss = (uid: string) => {
    dismissedCountRef.current += 1
    setReviewTCs((prev) => prev.map((r) => r.uid === uid ? { ...r, status: 'dismissed', expanded: false } : r))
    checkAllDone()
  }

  const checkAllDone = () => {
    // Use a small delay to let state settle before checking
    setTimeout(() => {
      setReviewTCs((prev) => {
        const allHandled = prev.every((r) => r.status !== 'pending')
        if (allHandled) setScreen('done')
        return prev
      })
    }, 50)
  }

  const handleApproveAll = () => {
    const pending = reviewTCs.filter((r) => r.status === 'pending')
    pending.forEach((rtc) => {
      const tc = createTc(rtc)
      dispatch({ type: 'CREATE_TC', tc })
      addedCountRef.current += 1
    })
    if (pending.length > 0) {
      toast(`${pending.length} test case${pending.length !== 1 ? 's' : ''} added`)
    }
    setReviewTCs((prev) => prev.map((r) => r.status === 'pending' ? { ...r, status: 'added', expanded: false } : r))
    setScreen('done')
  }

  const handleRejectAll = () => {
    const pending = reviewTCs.filter((r) => r.status === 'pending')
    pending.forEach(() => { dismissedCountRef.current += 1 })
    setReviewTCs((prev) => prev.map((r) => r.status === 'pending' ? { ...r, status: 'dismissed', expanded: false } : r))
    setScreen('done')
  }

  const toggleExpand = (uid: string) => {
    setReviewTCs((prev) => prev.map((r) => r.uid === uid ? { ...r, expanded: !r.expanded } : r))
  }

  const pendingCount = reviewTCs.filter((r) => r.status === 'pending').length

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 bg-black/30 backdrop-blur-[2px] flex items-center justify-center z-40 p-4 animate-fade-in"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-vsc-panel border border-vsc-border rounded-xl shadow-2xl flex flex-col w-[640px] max-h-[88vh] animate-slide-down">

        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-vsc-border shrink-0">
          <div className="flex items-center gap-2.5">
            <SparkleIcon size={14} className="text-vsc-accent" />
            <h2 className="text-sm font-semibold text-vsc-text">
              {screen === 'review' ? `${reviewTCs.length} test cases generated` : 'Generate from requirements'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-md text-vsc-dim hover:text-vsc-text hover:bg-vsc-hover transition-colors text-lg leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Input screen */}
        {screen === 'input' && (
          <>
            <div className="overflow-y-auto flex-1 p-6 flex flex-col gap-5">
              {/* Requirement text */}
              <Field label="Requirements">
                <textarea
                  autoFocus
                  value={requirementText}
                  onChange={(e) => setRequirementText(e.target.value)}
                  rows={8}
                  placeholder={`Paste your requirements, user stories, or acceptance criteria here...

Examples of supported formats:
• "As a user, I want to login with email and password"
• "Given I am on login page, When I enter valid credentials, Then I see the dashboard"
• Bullet points, plain descriptions, multiple requirements separated by blank lines`}
                  className={`${inputCls} resize-y min-h-[160px] font-mono text-xs leading-relaxed`}
                />
              </Field>

              {/* Context */}
              <Field label="Context (optional)" hint="Extra info like: React SPA, data-testid selectors, login page at /auth/login">
                <input
                  value={contextText}
                  onChange={(e) => setContextText(e.target.value)}
                  placeholder="e.g. React SPA, data-testid selectors, login page at /auth/login"
                  className={inputCls}
                />
              </Field>

              {/* Feature + priority row */}
              <div className="grid grid-cols-2 gap-4">
                <Field label="Target feature">
                  <Select
                    value={selectedFeatureId}
                    onChange={(e) => setSelectedFeatureId(e.target.value)}
                  >
                    {features.length === 0 ? (
                      <option value="">No features — create one first</option>
                    ) : (
                      features.map((f: Feature) => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                      ))
                    )}
                  </Select>
                </Field>
                <Field label="Default priority">
                  <Select
                    value={defaultPriority}
                    onChange={(e) => setDefaultPriority(e.target.value as Priority)}
                  >
                    <option value="P0">P0 — Critical</option>
                    <option value="P1">P1 — High</option>
                    <option value="P2">P2 — Medium</option>
                    <option value="P3">P3 — Low</option>
                  </Select>
                </Field>
              </div>

              {/* Error */}
              {errorMsg && (
                <div className="flex items-start gap-3 bg-vsc-danger-light border border-vsc-danger/30 rounded-xl px-4 py-3">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-vsc-danger shrink-0 mt-0.5">
                    <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.3"/>
                    <path d="M7 4v3.5M7 9.5v.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                  </svg>
                  <p className="text-xs text-vsc-danger/90 flex-1">{errorMsg}</p>
                  <button
                    onClick={handleGenerate}
                    className="text-xs text-vsc-danger/70 hover:text-vsc-danger underline shrink-0"
                  >
                    Retry
                  </button>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-vsc-border shrink-0 flex items-center justify-end gap-3">
              <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
              <Btn
                variant="primary"
                onClick={handleGenerate}
                disabled={!requirementText.trim() || !selectedFeatureId || generateCooldown}
              >
                <SparkleIcon size={13} />
                Generate
              </Btn>
            </div>
          </>
        )}

        {/* Loading screen */}
        {screen === 'loading' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 p-10">
            <div className="relative">
              <svg className="animate-spin h-10 w-10 text-vsc-accent/30" viewBox="0 0 40 40" fill="none">
                <circle cx="20" cy="20" r="17" stroke="currentColor" strokeWidth="3"/>
              </svg>
              <svg className="animate-spin h-10 w-10 text-vsc-accent absolute inset-0" viewBox="0 0 40 40" fill="none" style={{ animationDuration: '0.8s' }}>
                <path d="M20 3a17 17 0 0117 17" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
              </svg>
              <SparkleIcon size={14} className="absolute inset-0 m-auto text-vsc-accent" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-vsc-text transition-all duration-500">{loadingMessage}</p>
              <p className="text-xs text-vsc-dim mt-1.5">Claude is reading your requirements</p>
            </div>
          </div>
        )}

        {/* Review screen */}
        {screen === 'review' && (
          <>
            {/* Review top bar */}
            <div className="px-6 py-3 border-b border-vsc-border shrink-0 flex items-center gap-3">
              <span className="text-xs text-vsc-dim">
                {pendingCount} remaining · {addedCountRef.current} added
              </span>
              <button
                onClick={() => { setScreen('input'); setErrorMsg(null) }}
                className="text-xs text-vsc-muted hover:text-vsc-text underline ml-0"
              >
                ← Back to input
              </button>
              <div className="flex-1" />
              <Btn variant="ghost" size="sm" onClick={handleRejectAll} disabled={pendingCount === 0}>
                Reject all
              </Btn>
              <Btn variant="primary" size="sm" onClick={handleApproveAll} disabled={pendingCount === 0}>
                Approve all ({pendingCount})
              </Btn>
            </div>

            <div className="overflow-y-auto flex-1 p-4 flex flex-col gap-3">
              {reviewTCs.map((rtc) => (
                <ReviewCard
                  key={rtc.uid}
                  rtc={rtc}
                  onAdd={() => handleAdd(rtc.uid)}
                  onEditAndAdd={() => handleEditAndAdd(rtc.uid)}
                  onDismiss={() => handleDismiss(rtc.uid)}
                  onToggleExpand={() => toggleExpand(rtc.uid)}
                />
              ))}
            </div>
          </>
        )}

        {/* Done screen */}
        {screen === 'done' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-5 p-10 text-center">
            <div className="w-14 h-14 rounded-full bg-green-500/10 border border-green-500/25 flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-green-400">
                <path d="M5 12l5 5L20 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-vsc-text">
                {addedCountRef.current} test case{addedCountRef.current !== 1 ? 's' : ''} added
                {dismissedCountRef.current > 0 ? `, ${dismissedCountRef.current} dismissed` : ''}
              </p>
              <p className="text-xs text-vsc-dim mt-1">All generated test cases have been handled</p>
            </div>
            <div className="flex gap-2">
              <Btn variant="ghost" onClick={() => { setScreen('input'); setReviewTCs([]); setRequirementText(''); setContextText(''); setErrorMsg(null) }}>
                Generate more
              </Btn>
              <Btn variant="primary" onClick={onClose}>Done</Btn>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
