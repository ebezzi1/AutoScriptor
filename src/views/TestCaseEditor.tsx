import { useState, useEffect, useRef } from 'react'
import { useApp } from '../store/AppContext'
import { useToast } from '../components/common/Toast'
import { Btn } from '../components/common/Btn'
import { Modal } from '../components/common/Modal'
import { CodeBlock } from '../components/CodeBlock'
import { TestRunPanel } from '../components/TestRunPanel'
import { Field, Select, Toggle } from '../components/common/Field'
import { ChipInput } from '../components/common/ChipInput'
import { StepTable } from '../components/steps/StepTable'
import { ApiStepEditor } from '../components/api/ApiStepEditor'
import { DuplicateToModal } from '../components/DuplicateToModal'
import { generateTCPreview } from '../lib/codeGenerator'
import { generateApiTcPreview } from '../lib/apiCodeGenerator'
import type { TestCase, Priority, Annotation } from '../types'
import { PRIORITY_COLORS } from '../types'

interface Props { projectId: string; featureId: string; testCaseId: string }

export function TestCaseEditor({ projectId, featureId, testCaseId }: Props) {
  const { state, dispatch, navigate } = useApp()
  const { toast } = useToast()
  const [showPreview, setShowPreview] = useState(false)
  const [preview, setPreview] = useState('')
  const [dupMenuOpen, setDupMenuOpen] = useState(false)
  const [showDupTo, setShowDupTo] = useState(false)
  const [pendingType, setPendingType] = useState<'ui' | 'api' | null>(null)
  const dupMenuRef = useRef<HTMLDivElement>(null)

  const tc = state.testCases.find((t) => t.id === testCaseId)
  const feature = state.features.find((f) => f.id === featureId)
  const project = state.projects.find((p) => p.id === projectId)
  const projectUtils = state.utils.filter((u) => u.projectId === projectId)
  const projectVars = state.variables
    .filter((v) => v.projectId === projectId)
    .map((v) => v.key)
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
    return <div className="p-8 text-vsc-muted text-xs">Test case not found</div>
  }

  const projectFeatures = state.features.filter((f) => f.projectId === projectId)

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

  return (
    <div className="p-6 flex flex-col gap-5 max-w-full">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <p className="text-[9px] text-vsc-accent uppercase tracking-[0.16em] mb-1.5">◇ Test case</p>
          <input
            className="text-xl font-semibold bg-transparent text-vsc-text border-b border-transparent hover:border-vsc-border focus:border-vsc-accent outline-none w-full pb-0.5 transition-all"
            value={tc.name}
            onChange={(e) => update({ name: e.target.value })}
          />
          <input
            className="text-[11px] text-vsc-muted bg-transparent border-b border-transparent hover:border-vsc-border focus:border-vsc-accent outline-none w-full mt-1.5 pb-0.5 transition-all"
            value={tc.description}
            onChange={(e) => update({ description: e.target.value })}
            placeholder="Add a description…"
          />
        </div>
        <div className="flex gap-2 pt-6 items-center">
          {/* Split duplicate button */}
          <div ref={dupMenuRef} className="relative flex">
            <button
              onClick={handleDuplicateHere}
              className="inline-flex items-center gap-1.5 border border-vsc-border bg-transparent hover:bg-vsc-hover text-vsc-muted hover:text-vsc-text transition-all duration-150 rounded-l-sm px-2.5 py-1 text-[10px] tracking-wider uppercase font-medium border-r-0"
            >
              ⧉ Duplicate here
            </button>
            <button
              onClick={() => setDupMenuOpen((v) => !v)}
              className="inline-flex items-center border border-vsc-border bg-transparent hover:bg-vsc-hover text-vsc-muted hover:text-vsc-accent transition-all duration-150 rounded-r-sm px-2 py-1 text-[10px]"
              title="More duplicate options"
            >
              ▾
            </button>
            {dupMenuOpen && (
              <div className="absolute top-full right-0 mt-1 z-30 bg-vsc-panel border border-vsc-border rounded-sm shadow-lg shadow-black/40 py-0.5 min-w-[160px]">
                <button
                  className="w-full text-left px-3 py-1.5 text-[10px] text-vsc-muted hover:text-vsc-text hover:bg-vsc-hover transition-colors uppercase tracking-wide"
                  onClick={handleDuplicateHere}
                >
                  ⧉ Duplicate here
                </button>
                <button
                  className="w-full text-left px-3 py-1.5 text-[10px] text-vsc-muted hover:text-vsc-accent hover:bg-vsc-hover transition-colors uppercase tracking-wide"
                  onClick={() => { setShowDupTo(true); setDupMenuOpen(false) }}
                >
                  ⧉ Duplicate to…
                </button>
              </div>
            )}
          </div>

          <Btn
            variant={showPreview ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setShowPreview((v) => !v)}
          >
            {showPreview ? '▾ Hide preview' : '▸ Code preview'}
          </Btn>
        </div>
      </div>

      {/* Settings bar */}
      <div className="flex flex-wrap items-start gap-4 p-4 bg-vsc-panel border border-vsc-border rounded-sm">
        <Field label="Type">
          <div className="flex gap-1.5">
            {(['ui', 'api'] as const).map((t) => {
              const active = (tc.type ?? 'ui') === t
              return (
                <button
                  key={t}
                  onClick={() => {
                    if (active) return
                    const hasSteps = t === 'api' ? tc.steps.length > 0 : (tc.apiSteps ?? []).length > 0
                    if (hasSteps) {
                      setPendingType(t)
                    } else {
                      update({ type: t })
                    }
                  }}
                  className={`px-2.5 py-1 text-[10px] uppercase tracking-wider font-medium rounded-sm border transition-all duration-150 ${
                    active
                      ? t === 'api'
                        ? 'border-vsc-blue/60 bg-vsc-blue/15 text-vsc-blue'
                        : 'border-vsc-accent/60 bg-vsc-accent/15 text-vsc-accent'
                      : 'border-vsc-border text-vsc-muted hover:border-vsc-border hover:text-vsc-text'
                  }`}
                >
                  {t === 'ui' ? '🖥 UI' : '⚡ API'}
                </button>
              )
            })}
          </div>
        </Field>

        <Field label="Priority">
          <select
            value={tc.priority}
            onChange={(e) => update({ priority: e.target.value as Priority })}
            className="bg-vsc-bg border border-vsc-border rounded-sm px-2 py-1 text-[10px] cursor-pointer focus:border-vsc-accent outline-none uppercase tracking-wide"
          >
            {(['P0', 'P1', 'P2', 'P3'] as Priority[]).map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </Field>

        <Field label="Tags">
          <div className="min-w-[200px]">
            <ChipInput
              tags={tc.tags}
              onChange={(tags) => update({ tags })}
              placeholder="@smoke, @regression…"
            />
          </div>
        </Field>

        <Field label="Annotations">
          <div className="flex gap-3 mt-1">
            {(['slow', 'skip', 'fixme'] as Annotation[]).map((a) => (
              <label key={a} className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={tc.annotations.includes(a)}
                  onChange={() => toggleAnnotation(a)}
                  className="accent-vsc-accent w-3 h-3"
                />
                <span className="text-[10px] text-vsc-muted uppercase tracking-wide">{a}</span>
              </label>
            ))}
          </div>
        </Field>

        {project.auth?.enabled && (project.auth.roles.length ?? 0) > 0 && (
          <Field label="Auth Role">
            {project.auth.roles.length === 1 ? (
              <div className="flex items-center gap-2 mt-1">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: project.auth.roles[0].color }} />
                <span className="text-[10px] text-vsc-text">{project.auth.roles[0].name}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: (project.auth.roles.find((r) => r.id === (tc.authRoleId ?? project.auth!.roles[0].id))?.color) ?? '#888' }}
                />
                <select
                  value={tc.authRoleId ?? project.auth.roles[0].id}
                  onChange={(e) => update({ authRoleId: e.target.value })}
                  className="bg-vsc-bg border border-vsc-border rounded-sm px-2 py-1 text-[10px] cursor-pointer focus:border-vsc-accent outline-none uppercase tracking-wide"
                >
                  {project.auth.roles.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
            )}
          </Field>
        )}

        {(tc.type ?? 'ui') === 'ui' && (
          <>
            <Field label="Linked fixture">
              <Select
                value={tc.linkedFixture ?? ''}
                onChange={(e) => update({ linkedFixture: e.target.value || undefined })}
                className="!w-auto text-[10px]"
              >
                <option value="">— none —</option>
                {projectFixtures.map((fx) => (
                  <option key={fx.id} value={fx.id}>{fx.name}</option>
                ))}
              </Select>
            </Field>

            <Field label="Viewport">
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  placeholder="w"
                  value={tc.viewport?.width ?? ''}
                  onChange={(e) => {
                    const w = Number(e.target.value)
                    update({ viewport: w ? { width: w, height: tc.viewport?.height ?? 720 } : null })
                  }}
                  className="w-16 bg-vsc-bg border border-vsc-border rounded-sm px-2 py-1 text-[10px] focus:border-vsc-accent outline-none tabular-nums"
                />
                <span className="text-vsc-dim text-[10px]">×</span>
                <input
                  type="number"
                  placeholder="h"
                  value={tc.viewport?.height ?? ''}
                  onChange={(e) => {
                    const h = Number(e.target.value)
                    update({ viewport: h ? { width: tc.viewport?.width ?? 1280, height: h } : null })
                  }}
                  className="w-16 bg-vsc-bg border border-vsc-border rounded-sm px-2 py-1 text-[10px] focus:border-vsc-accent outline-none tabular-nums"
                />
              </div>
            </Field>

            <div className="flex items-center gap-5 mt-4">
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

      {/* Status badges */}
      <div className="flex items-center gap-2">
        {(tc.type ?? 'ui') === 'api' && (
          <span className="text-[9px] px-1.5 py-0.5 rounded-sm font-medium border border-vsc-blue/40 text-vsc-blue bg-vsc-blue/10 uppercase tracking-wider">
            API
          </span>
        )}
        <span className={`text-[9px] px-1.5 py-0.5 rounded-sm font-medium ${PRIORITY_COLORS[tc.priority]}`}>
          {tc.priority}
        </span>
        <span className="text-[10px] text-vsc-dim tabular-nums">
          {(tc.type ?? 'ui') === 'api'
            ? `${(tc.apiSteps ?? []).length} request${(tc.apiSteps ?? []).length !== 1 ? 's' : ''}`
            : `${tc.steps.length} step${tc.steps.length !== 1 ? 's' : ''}`}
        </span>
        {tc.annotations.map((a) => (
          <span key={a} className="text-[9px] bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 rounded-sm px-1.5 py-0.5 uppercase tracking-wide">
            {a}
          </span>
        ))}
      </div>

      {/* Page URL — UI only */}
      {(tc.type ?? 'ui') === 'ui' && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-3 mb-0.5">
            <label className="text-[9px] font-semibold text-vsc-dim uppercase tracking-[0.14em]">Page URL</label>
            <div className="flex-1 h-px bg-vsc-border/50" />
          </div>
          <div className="relative">
            <input
              value={tc.pageUrl ?? ''}
              onChange={(e) => update({ pageUrl: e.target.value || undefined })}
              placeholder="https://example.com/dashboard  or  {{baseUrl}}/login"
              list="pageurl-vars"
              className="w-full bg-vsc-bg border border-vsc-border rounded-sm px-3 py-1.5 text-xs text-vsc-text placeholder-vsc-dim focus:border-vsc-accent focus:shadow-[0_0_0_1px_rgba(200,152,32,0.15)] outline-none transition-all font-mono"
            />
            <datalist id="pageurl-vars">
              {projectVars.map((v) => (
                <option key={v} value={`{{${v}}}`} />
              ))}
            </datalist>
          </div>
          <p className="text-[9px] text-vsc-dim">
            Emitted as <span className="font-mono text-vsc-accent/80">await page.goto(...)</span> before steps run. Supports <span className="font-mono text-vsc-accent/80">{'{{variable}}'}</span> syntax.
          </p>
        </div>
      )}

      {/* Step editor — branches on type */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <h2 className="text-[9px] font-semibold text-vsc-dim uppercase tracking-[0.14em]">
            {(tc.type ?? 'ui') === 'api' ? 'API Requests' : 'Steps'}
          </h2>
          <div className="flex-1 h-px bg-vsc-border/50" />
        </div>
        {(tc.type ?? 'ui') === 'api' ? (
          <ApiStepEditor
            steps={tc.apiSteps ?? []}
            onChange={(apiSteps) => update({ apiSteps })}
            variables={projectVars}
          />
        ) : (
          <StepTable
            steps={tc.steps}
            onChange={(steps) => update({ steps })}
            variables={projectVars}
            utils={projectUtils}
            availableUtils={projectUtils}
            projectId={projectId}
          />
        )}
      </div>

      {/* Code preview */}
      {showPreview && (
        <div className="rounded-sm border border-vsc-border overflow-hidden">
          <div className="bg-vsc-panel px-4 py-2.5 border-b border-vsc-border flex items-center gap-2">
            <span className="text-[9px] font-semibold text-vsc-accent uppercase tracking-widest">
              Code preview
            </span>
            <span className="text-[9px] text-vsc-dim uppercase tracking-wide">
              — {project.language}
            </span>
          </div>
          <CodeBlock code={preview} language={project.language} />
        </div>
      )}

      {/* Run command + IDE links */}
      <div className="bg-vsc-panel border border-vsc-border rounded-sm p-4">
        <TestRunPanel
          featureName={feature.name}
          tcName={tc.name}
          language={project.language}
        />
      </div>

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
                onClick={() => {
                  update({ type: pendingType })
                  setPendingType(null)
                }}
              >
                Switch &amp; discard
              </Btn>
            </>
          }
        >
          <p className="text-xs text-vsc-muted leading-relaxed">
            Switching to <span className="font-semibold text-vsc-text">{pendingType === 'api' ? 'API' : 'UI'}</span> mode will
            discard the existing {pendingType === 'api' ? 'UI steps' : 'API requests'} in this test case.
            This cannot be undone.
          </p>
        </Modal>
      )}
    </div>
  )
}
