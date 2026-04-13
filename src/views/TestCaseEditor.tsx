import { useState, useEffect, useRef } from 'react'
import { useApp } from '../store/AppContext'
import { useToast } from '../components/common/Toast'
import { usePermissions } from '../hooks/usePermissions'
import { Btn } from '../components/common/Btn'
import { Modal } from '../components/common/Modal'
import { CodeBlock } from '../components/CodeBlock'
import { TestRunPanel } from '../components/TestRunPanel'
import { Field, Select, Toggle } from '../components/common/Field'
import { ChipInput } from '../components/common/ChipInput'
import { StepTable } from '../components/steps/StepTable'
import { ApiStepEditor } from '../components/api/ApiStepEditor'
import { DuplicateToModal } from '../components/DuplicateToModal'
import { TcHistoryPanel } from '../components/TcHistoryPanel'
import { generateTCPreview } from '../lib/codeGenerator'
import { generateApiTcPreview } from '../lib/apiCodeGenerator'
import { wouldCreateCycle } from '../lib/depGraph'
import type { TestCase, Priority, Annotation, Feature } from '../types'
import { PRIORITY_COLORS } from '../types'

interface Props { projectId: string; featureId: string; testCaseId: string }

// ── Dependency Picker ─────────────────────────────────────────────────────────

interface DepPickerProps {
  currentTcId: string
  selectedIds: string[]
  allTestCases: TestCase[]
  features: import('../types').Feature[]
  onChange: (ids: string[]) => void
  onCycleWarning: () => void
}

function DepPicker({ currentTcId, selectedIds, allTestCases, features, onChange, onCycleWarning }: DepPickerProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return undefined
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  // Candidates: all TCs except self
  const candidates = allTestCases.filter((tc) => tc.id !== currentTcId)
  const grouped = features
    .map((f) => ({ feature: f, tcs: candidates.filter((tc) => tc.featureId === f.id) }))
    .filter((g) => g.tcs.length > 0)

  const toggle = (tcId: string) => {
    if (selectedIds.includes(tcId)) {
      onChange(selectedIds.filter((id) => id !== tcId))
      return
    }
    if (wouldCreateCycle(currentTcId, tcId, allTestCases)) {
      onCycleWarning()
      return
    }
    onChange([...selectedIds, tcId])
  }

  const selectedTcs = selectedIds
    .map((id) => allTestCases.find((tc) => tc.id === id))
    .filter(Boolean) as TestCase[]

  return (
    <div>
      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={`flex items-center gap-2 bg-vsc-hover border rounded-md px-3 py-2 text-sm text-vsc-muted hover:text-vsc-text hover:border-vsc-accent/40 outline-none transition-all ${
            open ? 'border-vsc-accent text-vsc-text' : 'border-vsc-border'
          }`}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="shrink-0">
            <path d="M3 3h6M3 6h4M3 9h2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            <circle cx="9" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.2"/>
            <path d="M10.5 10.5l1.5 1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          Select dependencies…
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className={`ml-1 transition-transform ${open ? 'rotate-180' : ''}`}>
            <path d="M2 3.5L5 7l3-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {open && (
          <div className="absolute top-full left-0 mt-1.5 z-30 bg-vsc-panel border border-vsc-border rounded-xl shadow-xl shadow-black/40 py-2 min-w-[280px] max-h-64 overflow-y-auto animate-popover-in">
            {grouped.length === 0 ? (
              <p className="px-4 py-2 text-xs text-vsc-dim">No other test cases in this project</p>
            ) : (
              grouped.map(({ feature, tcs }) => (
                <div key={feature.id}>
                  <p className="px-4 py-1.5 text-[10px] font-semibold text-vsc-dim uppercase tracking-widest border-b border-vsc-border/40">
                    {feature.name}
                  </p>
                  {tcs.map((tc) => {
                    const checked = selectedIds.includes(tc.id)
                    const wouldCycle = !checked && wouldCreateCycle(currentTcId, tc.id, allTestCases)
                    return (
                      <label
                        key={tc.id}
                        className={`flex items-center gap-2.5 px-4 py-2 text-sm cursor-pointer transition-colors ${
                          wouldCycle
                            ? 'opacity-40 cursor-not-allowed'
                            : 'hover:bg-vsc-hover'
                        } ${checked ? 'text-vsc-accent' : 'text-vsc-muted hover:text-vsc-text'}`}
                        title={wouldCycle ? 'Would create a circular dependency' : undefined}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={wouldCycle}
                          onChange={() => toggle(tc.id)}
                          className="accent-vsc-accent w-3.5 h-3.5 shrink-0"
                        />
                        <span className="truncate">{tc.name}</span>
                        {wouldCycle && (
                          <span className="ml-auto text-[10px] text-red-400 shrink-0">cycle</span>
                        )}
                      </label>
                    )
                  })}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Selected chips */}
      {selectedTcs.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {selectedTcs.map((dep) => {
            const f = features.find((ft) => ft.id === dep.featureId)
            return (
              <span
                key={dep.id}
                className="inline-flex items-center gap-1.5 text-xs bg-vsc-accent/10 border border-vsc-accent/25 text-vsc-accent px-2 py-0.5 rounded-full font-medium"
              >
                {f && <span className="text-vsc-accent/60">{f.name} /</span>}
                {dep.name}
                <button
                  type="button"
                  onClick={() => onChange(selectedIds.filter((id) => id !== dep.id))}
                  className="hover:text-white transition-colors leading-none"
                  aria-label={`Remove ${dep.name}`}
                >
                  ×
                </button>
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="text-xs font-semibold text-vsc-dim uppercase tracking-widest whitespace-nowrap">
        {children}
      </span>
      <div className="flex-1 h-px bg-vsc-border/60" />
    </div>
  )
}

// ── Main Editor ───────────────────────────────────────────────────────────────

export function TestCaseEditor({ projectId, featureId, testCaseId }: Props) {
  const { state, dispatch, navigate } = useApp()
  const { toast } = useToast()
  const { isReadOnly } = usePermissions()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [showRun, setShowRun] = useState(false)
  const [preview, setPreview] = useState('')
  const [dupMenuOpen, setDupMenuOpen] = useState(false)
  const [showDupTo, setShowDupTo] = useState(false)
  const [pendingType, setPendingType] = useState<'ui' | 'api' | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const dupMenuRef = useRef<HTMLDivElement>(null)

  const tc = state.testCases.find((t) => t.id === testCaseId)
  const feature = state.features.find((f) => f.id === featureId)
  const project = state.projects.find((p) => p.id === projectId)
  const projectUtils = state.utils.filter((u) => u.projectId === projectId)
  const projectVars = state.variables.filter((v) => v.projectId === projectId).map((v) => v.key)
  const projectFixtures = state.fixtures.filter((fx) => fx.projectId === projectId)

  const update = (updates: Partial<TestCase>) => {
    if (!tc) return
    dispatch({ type: 'UPDATE_TC', tc: { ...tc, ...updates } })
  }

  const activeEnv = project
    ? (project.environments ?? []).find((e) => e.id === project.activeEnvironmentId) ?? null
    : null

  useEffect(() => {
    if (!showPreview || !tc || !feature || !project) return
    const rawVars = state.variables.filter((v) => v.projectId === projectId)
    const effectiveVars = rawVars.map((v) =>
      activeEnv?.variableOverrides[v.key] !== undefined
        ? { ...v, value: activeEnv.variableOverrides[v.key] }
        : v
    )
    const effectiveProject = activeEnv?.baseUrl ? { ...project, baseUrl: activeEnv.baseUrl } : project
    if ((tc.type ?? 'ui') === 'api') {
      setPreview(generateApiTcPreview(tc, feature, effectiveProject, effectiveVars))
    } else {
      setPreview(generateTCPreview(tc, feature, effectiveProject, projectUtils, effectiveVars))
    }
  }, [showPreview, tc, feature, project, projectUtils, state.variables, projectId, activeEnv])

  useEffect(() => {
    if (dupMenuOpen) {
      const handle = (e: MouseEvent) => {
        if (dupMenuRef.current && !dupMenuRef.current.contains(e.target as Node)) {
          setDupMenuOpen(false)
        }
      }
      document.addEventListener('mousedown', handle)
      return () => document.removeEventListener('mousedown', handle)
    }
    return undefined
  }, [dupMenuOpen])

  if (!tc || !feature || !project) {
    return <div className="p-10 text-vsc-muted text-sm">Test case not found</div>
  }

  const projectFeatures = state.features.filter((f) => f.projectId === projectId)
  const isUI = (tc.type ?? 'ui') === 'ui'
  const stepCount = isUI ? tc.steps.length : (tc.apiSteps ?? []).length

  const handleDuplicateHere = () => {
    const newTcId = crypto.randomUUID()
    dispatch({ type: 'DUPLICATE_TC', tcId: tc.id, newTcId })
    toast(`"${tc.name}" duplicated`)
    navigate({ type: 'test-case', projectId, featureId: tc.featureId, testCaseId: newTcId })
    setDupMenuOpen(false)
  }

  const handleDuplicateTo = (targetFeatureId: string) => {
    const newTcId = crypto.randomUUID()
    const targetFeature = state.features.find((f) => f.id === targetFeatureId)
    dispatch({ type: 'DUPLICATE_TC_TO', tcId: tc.id, targetFeatureId, newTcId })
    toast(`"${tc.name}" duplicated to "${targetFeature?.name ?? 'feature'}"`)
    navigate({ type: 'test-case', projectId, featureId: targetFeatureId, testCaseId: newTcId })
  }

  const toggleAnnotation = (a: Annotation) => {
    const has = tc.annotations.includes(a)
    update({ annotations: has ? tc.annotations.filter((x) => x !== a) : [...tc.annotations, a] })
  }

  // Settings summary line (shown when collapsed)
  const settingsSummary: string[] = [tc.priority]
  if (tc.authRoleId) {
    const role = project.auth?.roles.find((r) => r.id === tc.authRoleId)
    if (role) settingsSummary.push(role.name)
  }
  tc.tags.forEach((t) => settingsSummary.push(t))
  if (tc.viewport) settingsSummary.push(`${tc.viewport.width}×${tc.viewport.height}`)
  if (tc.annotations.length) settingsSummary.push(...tc.annotations)

  return (
    <div className="p-8 max-w-5xl mx-auto flex flex-col gap-8">

      {/* ── Disabled banner ──────────────────────────────────────────────────── */}
      {tc.disabled && (
        <div className="flex items-center gap-3 bg-yellow-500/8 border border-yellow-500/25 rounded-xl px-5 py-3.5">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-yellow-500 shrink-0">
            <path d="M8 1.5l6.5 12h-13L8 1.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
            <path d="M8 6v4M8 11.5v.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-yellow-400">This test case is disabled</p>
            <p className="text-xs text-yellow-500/70 mt-0.5">It will not be included in code generation, matrix export, or coverage counts.</p>
          </div>
          <button
            onClick={() => update({ disabled: false })}
            className="shrink-0 text-xs text-yellow-500/70 hover:text-yellow-400 border border-yellow-500/25 hover:border-yellow-500/50 px-3 py-1.5 rounded-lg transition-all"
          >
            Re-enable
          </button>
        </div>
      )}

      {/* ── Section A: TC Header ────────────────────────────────────────────── */}
      <div className="flex items-start gap-6">
        <div className="flex-1 min-w-0">
          {/* Type + priority row */}
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs text-vsc-dim font-medium">Test case</span>
            <div className="flex items-center gap-2">
              {(['ui', 'api'] as const).map((t) => {
                const active = (tc.type ?? 'ui') === t
                return (
                  <button
                    key={t}
                    onClick={() => {
                      if (active) return
                      const hasSteps = t === 'api' ? tc.steps.length > 0 : (tc.apiSteps ?? []).length > 0
                      if (hasSteps) setPendingType(t)
                      else update({ type: t })
                    }}
                    className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border transition-all ${
                      active
                        ? t === 'api'
                          ? 'border-vsc-blue/50 bg-vsc-blue/15 text-vsc-blue'
                          : 'border-vsc-accent/50 bg-vsc-accent/15 text-vsc-accent'
                        : 'border-vsc-border text-vsc-dim hover:text-vsc-muted hover:border-vsc-border/80'
                    }`}
                  >
                    {t.toUpperCase()}
                  </button>
                )
              })}
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${PRIORITY_COLORS[tc.priority]}`}>
              {tc.priority}
            </span>
            <span className="text-xs text-vsc-dim tabular-nums">
              {stepCount} {isUI ? 'step' : 'request'}{stepCount !== 1 ? 's' : ''}
            </span>
            {tc.annotations.map((a) => (
              <span key={a} className="text-xs bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 rounded-full px-2 py-0.5 font-medium">
                {a}
              </span>
            ))}
          </div>

          {/* Name */}
          <input
            className="text-2xl font-bold bg-transparent text-vsc-text border-b border-transparent hover:border-vsc-border focus:border-vsc-accent outline-none w-full pb-1 transition-all leading-tight"
            value={tc.name}
            onChange={(e) => update({ name: e.target.value })}
            placeholder="Test case name"
            aria-label="Test case name"
          />

          {/* Description */}
          <input
            className="text-sm text-vsc-muted bg-transparent border-b border-transparent hover:border-vsc-border focus:border-vsc-accent outline-none w-full mt-2 pb-1 transition-all"
            value={tc.description}
            onChange={(e) => update({ description: e.target.value })}
            placeholder="Add a description…"
            aria-label="Description"
          />
        </div>

        {/* Header actions */}
        <div className="flex gap-2.5 pt-7 items-center shrink-0">
          {/* Version history button */}
          <button
            onClick={() => setShowHistory(true)}
            title="Version history"
            className="inline-flex items-center gap-1.5 border border-vsc-border bg-transparent hover:bg-vsc-hover text-vsc-muted hover:text-vsc-text transition-all duration-150 rounded-md px-3 py-1.5 text-sm font-medium"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="shrink-0">
              <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M6 3.5V6l2 1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            History
          </button>

          <div ref={dupMenuRef} className="relative flex">
            <button
              onClick={handleDuplicateHere}
              className="inline-flex items-center gap-1.5 border border-vsc-border bg-transparent hover:bg-vsc-hover text-vsc-muted hover:text-vsc-text transition-all duration-150 rounded-l-md px-3 py-1.5 text-sm font-medium border-r-0"
            >
              Duplicate
            </button>
            <button
              onClick={() => setDupMenuOpen((v) => !v)}
              className="inline-flex items-center border border-vsc-border bg-transparent hover:bg-vsc-hover text-vsc-muted hover:text-vsc-accent transition-all duration-150 rounded-r-md px-2 py-1.5 text-sm"
              title="More duplicate options"
              aria-label="Duplicate options"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M2 3.5L5 7l3-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            {dupMenuOpen && (
              <div className="absolute top-full right-0 mt-1.5 z-30 bg-vsc-panel border border-vsc-border rounded-lg shadow-xl shadow-black/40 py-1 min-w-[176px] animate-popover-in">
                <button
                  className="w-full text-left px-4 py-2 text-sm text-vsc-muted hover:text-vsc-text hover:bg-vsc-hover transition-colors"
                  onClick={handleDuplicateHere}
                >
                  Duplicate here
                </button>
                <button
                  className="w-full text-left px-4 py-2 text-sm text-vsc-muted hover:text-vsc-accent hover:bg-vsc-hover transition-colors"
                  onClick={() => { setShowDupTo(true); setDupMenuOpen(false) }}
                >
                  Duplicate to…
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Section B: TC Settings (collapsible) ───────────────────────────── */}
      <div className="border border-vsc-border rounded-xl overflow-hidden">
        <button
          className="w-full flex items-center justify-between px-6 py-3.5 bg-vsc-panel hover:bg-vsc-hover transition-colors text-left"
          onClick={() => setSettingsOpen((v) => !v)}
          aria-expanded={settingsOpen}
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-xs font-semibold text-vsc-dim uppercase tracking-widest shrink-0">
              Configuration
            </span>
            {!settingsOpen && (
              <div className="flex items-center gap-2 overflow-hidden">
                {settingsSummary.map((s, i) => (
                  <span
                    key={i}
                    className="text-xs text-vsc-muted bg-vsc-active border border-vsc-border px-2 py-0.5 rounded-full font-medium shrink-0"
                  >
                    {s}
                  </span>
                ))}
              </div>
            )}
          </div>
          <svg
            width="14" height="14" viewBox="0 0 14 14" fill="none"
            className={`text-vsc-dim transition-transform duration-200 shrink-0 ${settingsOpen ? 'rotate-180' : ''}`}
          >
            <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {settingsOpen && (
          <div className="px-6 py-6 border-t border-vsc-border bg-vsc-panel/50 animate-slide-down">
            <div className="flex flex-wrap gap-6">
              <Field label="Priority">
                <select
                  value={tc.priority}
                  onChange={(e) => update({ priority: e.target.value as Priority })}
                  className="bg-vsc-hover border border-vsc-border rounded-md px-3 py-2 text-sm cursor-pointer focus:border-vsc-accent outline-none"
                >
                  {(['P0', 'P1', 'P2', 'P3'] as Priority[]).map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </Field>

              <Field label="Tags">
                <div className="min-w-[220px]">
                  <ChipInput
                    tags={tc.tags}
                    onChange={(tags) => update({ tags })}
                    placeholder="@smoke, @regression…"
                  />
                </div>
              </Field>

              <Field label="Annotations">
                <div className="flex gap-4 mt-0.5">
                  {(['slow', 'skip', 'fixme'] as Annotation[]).map((a) => (
                    <label key={a} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={tc.annotations.includes(a)}
                        onChange={() => toggleAnnotation(a)}
                        className="accent-vsc-accent w-3.5 h-3.5"
                      />
                      <span className="text-sm text-vsc-muted capitalize">{a}</span>
                    </label>
                  ))}
                </div>
              </Field>

              <Field label="Dependencies">
                <DepPicker
                  currentTcId={testCaseId}
                  selectedIds={tc.dependencies ?? []}
                  allTestCases={state.testCases.filter((t) => t.projectId === projectId)}
                  features={projectFeatures}
                  onChange={(deps) => update({ dependencies: deps })}
                  onCycleWarning={() => toast('Circular dependency detected — this TC is already in the dependency chain', 'error')}
                />
              </Field>

              {project.auth?.enabled && (project.auth.roles.length ?? 0) > 0 && (
                <Field label="Auth Role">
                  {project.auth.roles.length === 1 ? (
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: project.auth.roles[0].color }} />
                      <span className="text-sm text-vsc-text">{project.auth.roles[0].name}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: (project.auth.roles.find((r) => r.id === (tc.authRoleId ?? project.auth!.roles[0].id))?.color) ?? '#888' }}
                      />
                      <select
                        value={tc.authRoleId ?? project.auth.roles[0].id}
                        onChange={(e) => update({ authRoleId: e.target.value })}
                        className="bg-vsc-hover border border-vsc-border rounded-md px-3 py-2 text-sm cursor-pointer focus:border-vsc-accent outline-none"
                      >
                        {project.auth.roles.map((r) => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </Field>
              )}

              {isUI && (
                <>
                  <Field label="Linked fixture">
                    <Select
                      value={tc.linkedFixture ?? ''}
                      onChange={(e) => update({ linkedFixture: e.target.value || undefined })}
                      className="!w-auto text-sm"
                    >
                      <option value="">— none —</option>
                      {projectFixtures.map((fx) => (
                        <option key={fx.id} value={fx.id}>{fx.name}</option>
                      ))}
                    </Select>
                  </Field>

                  <Field label="Viewport">
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        placeholder="1280"
                        value={tc.viewport?.width ?? ''}
                        onChange={(e) => {
                          const w = Number(e.target.value)
                          update({ viewport: w ? { width: w, height: tc.viewport?.height ?? 720 } : null })
                        }}
                        className="w-20 bg-vsc-hover border border-vsc-border rounded-md px-3 py-2 text-sm focus:border-vsc-accent outline-none tabular-nums"
                        aria-label="Viewport width"
                      />
                      <span className="text-vsc-dim text-sm">×</span>
                      <input
                        type="number"
                        placeholder="720"
                        value={tc.viewport?.height ?? ''}
                        onChange={(e) => {
                          const h = Number(e.target.value)
                          update({ viewport: h ? { width: tc.viewport?.width ?? 1280, height: h } : null })
                        }}
                        className="w-20 bg-vsc-hover border border-vsc-border rounded-md px-3 py-2 text-sm focus:border-vsc-accent outline-none tabular-nums"
                        aria-label="Viewport height"
                      />
                    </div>
                  </Field>

                  <div className="flex items-center gap-8 pt-1 w-full">
                    <Toggle
                      checked={tc.screenshotOnFailure}
                      onChange={(v) => update({ screenshotOnFailure: v })}
                      label="Screenshot on failure"
                    />
                    <Toggle
                      checked={tc.traceRecording}
                      onChange={(v) => update({ traceRecording: v })}
                      label="Trace recording"
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Section C: Page URL ─────────────────────────────────────────────── */}
      {isUI && (
        <div>
          <SectionLabel>Page URL</SectionLabel>
          <div className="relative">
            <input
              value={tc.pageUrl ?? ''}
              onChange={(e) => update({ pageUrl: e.target.value || undefined })}
              placeholder="https://example.com/dashboard  or  {{baseUrl}}/login"
              list="pageurl-vars"
              className="w-full bg-vsc-panel border border-vsc-border rounded-lg px-4 py-2.5 text-sm text-vsc-text placeholder-vsc-dim focus:border-vsc-accent focus:ring-2 focus:ring-vsc-accent/15 outline-none transition-all font-mono"
              aria-label="Page URL"
            />
            <datalist id="pageurl-vars">
              {projectVars.map((v) => <option key={v} value={`{{${v}}}`} />)}
            </datalist>
          </div>
          <p className="text-xs text-vsc-dim mt-2">
            Emitted as{' '}
            <code className="font-mono text-vsc-accent/80 bg-vsc-panel px-1 py-0.5 rounded text-xs">
              await page.goto(…)
            </code>{' '}
            before steps. Supports{' '}
            <code className="font-mono text-vsc-accent/80 bg-vsc-panel px-1 py-0.5 rounded text-xs">
              {'{{variable}}'}
            </code>{' '}
            syntax.
          </p>
        </div>
      )}

      {/* ── Section D: Steps ────────────────────────────────────────────────── */}
      <div>
        <SectionLabel>
          {isUI ? 'Steps' : 'API Requests'}
        </SectionLabel>
        <div className={isReadOnly ? 'pointer-events-none opacity-60' : undefined}>
          {isUI ? (
            <StepTable
              steps={tc.steps}
              onChange={(steps) => update({ steps })}
              variables={projectVars}
              utils={projectUtils}
              availableUtils={projectUtils}
              projectId={projectId}
            />
          ) : (
            <ApiStepEditor
              steps={tc.apiSteps ?? []}
              onChange={(apiSteps) => update({ apiSteps })}
              variables={projectVars}
            />
          )}
        </div>
      </div>

      {/* ── Section E: Code Preview (collapsible) ───────────────────────────── */}
      <div className="border border-vsc-border rounded-xl overflow-hidden">
        <button
          className="w-full flex items-center gap-3 px-6 py-3.5 bg-vsc-panel hover:bg-vsc-hover transition-colors text-left"
          onClick={() => setShowPreview((v) => !v)}
          aria-expanded={showPreview}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-vsc-dim shrink-0">
            <path d="M1 4l4 3-4 3M7 10h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="text-xs font-semibold text-vsc-dim uppercase tracking-widest">Code preview</span>
          {project && (
            <span className="text-xs text-vsc-dim/60 font-mono">.{project.language === 'typescript' ? 'ts' : 'js'}</span>
          )}
          <svg
            width="14" height="14" viewBox="0 0 14 14" fill="none"
            className={`text-vsc-dim ml-auto transition-transform duration-200 ${showPreview ? 'rotate-180' : ''}`}
          >
            <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {showPreview && (
          <div className="border-t border-vsc-border animate-slide-down">
            <CodeBlock code={preview} language={project.language} />
          </div>
        )}
      </div>

      {/* ── Section F: Run Commands (collapsible) ───────────────────────────── */}
      <div className="border border-vsc-border rounded-xl overflow-hidden">
        <button
          className="w-full flex items-center gap-3 px-6 py-3.5 bg-vsc-panel hover:bg-vsc-hover transition-colors text-left"
          onClick={() => setShowRun((v) => !v)}
          aria-expanded={showRun}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-vsc-dim shrink-0">
            <path d="M3 2l9 5-9 5V2z" fill="currentColor" fillOpacity="0.6"/>
          </svg>
          <span className="text-xs font-semibold text-vsc-dim uppercase tracking-widest">Run commands</span>
          <svg
            width="14" height="14" viewBox="0 0 14 14" fill="none"
            className={`text-vsc-dim ml-auto transition-transform duration-200 ${showRun ? 'rotate-180' : ''}`}
          >
            <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {showRun && (
          <div className="border-t border-vsc-border p-6 animate-slide-down">
            <TestRunPanel
              featureName={feature.name}
              tcName={tc.name}
              language={project.language}
            />
          </div>
        )}
      </div>

      {/* ── Modals ──────────────────────────────────────────────────────────── */}
      {showDupTo && (
        <DuplicateToModal
          tcName={tc.name}
          currentFeatureId={tc.featureId}
          features={projectFeatures}
          testCases={state.testCases.filter((t) => t.projectId === projectId)}
          onDuplicate={handleDuplicateTo}
          onClose={() => setShowDupTo(false)}
        />
      )}

      {pendingType && (
        <Modal
          title={`Switch to ${pendingType === 'api' ? 'API' : 'UI'} test?`}
          onClose={() => setPendingType(null)}
          footer={
            <>
              <Btn variant="ghost" onClick={() => setPendingType(null)}>Cancel</Btn>
              <Btn
                variant="danger"
                onClick={() => { update({ type: pendingType }); setPendingType(null) }}
              >
                Switch &amp; discard
              </Btn>
            </>
          }
        >
          <p className="text-sm text-vsc-muted leading-relaxed">
            Switching to{' '}
            <span className="font-semibold text-vsc-text">{pendingType === 'api' ? 'API' : 'UI'}</span>{' '}
            mode will discard the existing{' '}
            {pendingType === 'api' ? 'UI steps' : 'API requests'} in this test case.
            This cannot be undone.
          </p>
        </Modal>
      )}

      {showHistory && (
        <TcHistoryPanel
          testCaseId={testCaseId}
          projectId={projectId}
          currentTc={tc}
          onClose={() => setShowHistory(false)}
          onRestore={(restoredTc) => {
            dispatch({ type: 'UPDATE_TC', tc: { ...restoredTc, id: testCaseId, featureId, projectId } })
            toast('Test case restored')
          }}
        />
      )}
    </div>
  )
}
