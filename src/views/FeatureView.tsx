import { useState } from 'react'
import { useApp } from '../store/AppContext'
import { useToast } from '../components/common/Toast'
import { Modal } from '../components/common/Modal'
import { Btn } from '../components/common/Btn'
import { Field, Input } from '../components/common/Field'
import { ChipInput } from '../components/common/ChipInput'
import { StepTable } from '../components/steps/StepTable'
import { PRIORITY_COLORS } from '../types'
import type { TestCase, Feature, Priority } from '../types'

function newTC(featureId: string, projectId: string, name: string, type: 'ui' | 'api' = 'ui'): TestCase {
  return {
    id: crypto.randomUUID(),
    featureId,
    projectId,
    name,
    description: '',
    priority: 'P2',
    tags: [],
    annotations: [],
    viewport: null,
    screenshotOnFailure: false,
    traceRecording: false,
    steps: [],
    type,
    apiSteps: [],
  }
}

interface Props { projectId: string; featureId: string }

export function FeatureView({ projectId, featureId }: Props) {
  const { state, dispatch, navigate } = useApp()
  const { toast } = useToast()
  const [creatingTC, setCreatingTC] = useState(false)
  const [tcName, setTcName] = useState('')
  const [tcType, setTcType] = useState<'ui' | 'api'>('ui')
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const feature = state.features.find((f) => f.id === featureId)
  const testCases = state.testCases.filter((tc) => tc.featureId === featureId)
  const projectUtils = state.utils.filter((u) => u.projectId === projectId)
  const projectVars = state.variables
    .filter((v) => v.projectId === projectId)
    .map((v) => v.key)

  if (!feature) return <div className="p-8 text-vsc-muted text-xs">Feature not found</div>

  const updateFeature = (updates: Partial<Feature>) =>
    dispatch({
      type: 'UPDATE_FEATURE',
      feature: { ...feature, ...updates },
    })

  const handleCreateTC = () => {
    if (!tcName.trim()) return
    const tc = newTC(featureId, projectId, tcName.trim(), tcType)
    dispatch({ type: 'CREATE_TC', tc })
    toast(`Test case "${tc.name}" created`)
    navigate({ type: 'test-case', projectId, featureId, testCaseId: tc.id })
    setCreatingTC(false)
    setTcName('')
    setTcType('ui')
  }

  const doDeleteTC = () => {
    if (!deleteTarget) return
    const tc = testCases.find((tc) => tc.id === deleteTarget)
    dispatch({ type: 'DELETE_TC', tcId: deleteTarget })
    toast(`"${tc?.name}" deleted`, 'error')
    setDeleteTarget(null)
  }

  return (
    <div className="p-6 max-w-5xl flex flex-col gap-6">
      {/* Feature header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <p className="text-[9px] text-vsc-accent uppercase tracking-[0.16em] mb-1.5">◆ Feature</p>
          <input
            className="text-xl font-semibold bg-transparent text-vsc-text border-b border-transparent hover:border-vsc-border focus:border-vsc-accent outline-none w-full pb-0.5 transition-all"
            value={feature.name}
            onChange={(e) => updateFeature({ name: e.target.value })}
          />
          <input
            className="text-[11px] text-vsc-muted bg-transparent border-b border-transparent hover:border-vsc-border focus:border-vsc-accent outline-none w-full mt-1.5 pb-0.5 transition-all"
            value={feature.description}
            onChange={(e) => updateFeature({ description: e.target.value })}
            placeholder="Add a description…"
          />
          <div className="mt-3">
            <ChipInput
              tags={feature.tags}
              onChange={(tags) => updateFeature({ tags })}
              placeholder="Add tags (@smoke, @regression…)"
            />
          </div>
        </div>
        <div className="flex gap-2 pt-6">
          <Btn
            variant="danger"
            size="sm"
            onClick={() => {
              dispatch({ type: 'DELETE_FEATURE', featureId })
              navigate({ type: 'project-dashboard', projectId })
              toast('Feature deleted', 'error')
            }}
          >
            Delete
          </Btn>
        </div>
      </div>

      {/* beforeEach / afterEach */}
      <div className="flex flex-col gap-3">
        <details className="group">
          <summary className="cursor-pointer text-[9px] font-semibold text-vsc-muted uppercase tracking-[0.14em] py-2 hover:text-vsc-text transition-colors select-none list-none flex items-center gap-2">
            <span className="group-open:rotate-90 transition-transform inline-block text-vsc-dim">▸</span>
            <span>beforeEach</span>
            <span className="text-vsc-dim normal-case tracking-normal">— setup steps ({feature.beforeEachSteps.length})</span>
          </summary>
          <div className="mt-2">
            <StepTable
              steps={feature.beforeEachSteps}
              onChange={(steps) => updateFeature({ beforeEachSteps: steps })}
              variables={projectVars}
              availableUtils={projectUtils}
            />
          </div>
        </details>

        <details className="group">
          <summary className="cursor-pointer text-[9px] font-semibold text-vsc-muted uppercase tracking-[0.14em] py-2 hover:text-vsc-text transition-colors select-none list-none flex items-center gap-2">
            <span className="group-open:rotate-90 transition-transform inline-block text-vsc-dim">▸</span>
            <span>afterEach</span>
            <span className="text-vsc-dim normal-case tracking-normal">— teardown steps ({feature.afterEachSteps.length})</span>
          </summary>
          <div className="mt-2">
            <StepTable
              steps={feature.afterEachSteps}
              onChange={(steps) => updateFeature({ afterEachSteps: steps })}
              variables={projectVars}
              availableUtils={projectUtils}
            />
          </div>
        </details>
      </div>

      {/* Test cases */}
      <div>
        <div className="flex items-center gap-3 mb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-[9px] font-semibold text-vsc-dim uppercase tracking-[0.14em]">
              Test cases
            </h2>
            <span className="text-[9px] text-vsc-accent font-semibold tabular-nums">
              {testCases.length}
            </span>
          </div>
          <div className="flex-1 h-px bg-vsc-border/50" />
          <Btn variant="primary" size="sm" onClick={() => setCreatingTC(true)}>
            + Add test case
          </Btn>
        </div>

        {testCases.length === 0 ? (
          <div className="border border-dashed border-vsc-border/60 rounded-sm p-10 text-center">
            <p className="text-vsc-dim text-[10px] uppercase tracking-wider">No test cases yet</p>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {testCases.map((tc) => (
              <div
                key={tc.id}
                className="flex items-center gap-3 bg-vsc-panel border border-vsc-border rounded-sm px-4 py-2.5 cursor-pointer hover:border-vsc-accent/50 hover:bg-vsc-hover transition-all duration-150 group relative overflow-hidden"
                onClick={() =>
                  navigate({ type: 'test-case', projectId, featureId, testCaseId: tc.id })
                }
              >
                <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-vsc-accent/15 group-hover:bg-vsc-accent/50 transition-all" />
                <span className="text-[10px] text-vsc-muted shrink-0">◇</span>
                <div className="flex-1 min-w-0 pl-1">
                  <span className="text-[11px] text-vsc-text truncate block">{tc.name}</span>
                  {tc.description && (
                    <span className="text-[10px] text-vsc-muted truncate block">{tc.description}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {tc.type === 'api' && (
                    <span className="text-[8px] px-1.5 py-0.5 rounded-sm border border-vsc-blue/40 text-vsc-blue bg-vsc-blue/10 uppercase tracking-wider font-semibold">
                      API
                    </span>
                  )}
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-sm font-medium ${PRIORITY_COLORS[tc.priority]}`}>
                    {tc.priority}
                  </span>
                  {tc.tags.map((t) => (
                    <span key={t} className="text-[9px] border border-vsc-accent/30 text-vsc-accent px-1.5 py-0.5 uppercase tracking-wide">
                      {t}
                    </span>
                  ))}
                  <span className="text-[10px] text-vsc-dim tabular-nums">
                    {tc.type === 'api'
                      ? `${(tc.apiSteps ?? []).length} request${(tc.apiSteps ?? []).length !== 1 ? 's' : ''}`
                      : `${tc.steps.length} step${tc.steps.length !== 1 ? 's' : ''}`}
                  </span>
                  <button
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-vsc-dim hover:text-vsc-danger text-[11px]"
                    onClick={(e) => {
                      e.stopPropagation()
                      setDeleteTarget(tc.id)
                    }}
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {creatingTC && (
        <Modal
          title="New test case"
          onClose={() => setCreatingTC(false)}
          footer={
            <>
              <Btn variant="ghost" onClick={() => setCreatingTC(false)}>Cancel</Btn>
              <Btn variant="primary" onClick={handleCreateTC} disabled={!tcName.trim()}>
                Create
              </Btn>
            </>
          }
        >
          {/* Type selector */}
          <div className="flex gap-2 mb-4">
            {(['ui', 'api'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTcType(t)}
                className={`flex-1 flex flex-col items-center gap-1.5 py-3 px-4 rounded-sm border transition-all ${
                  tcType === t
                    ? t === 'api'
                      ? 'border-vsc-blue/60 bg-vsc-blue/10 text-vsc-blue'
                      : 'border-vsc-accent/60 bg-vsc-accent/10 text-vsc-accent'
                    : 'border-vsc-border text-vsc-muted hover:border-vsc-border hover:text-vsc-text'
                }`}
              >
                <span className="text-lg leading-none">{t === 'ui' ? '🖥' : '⚡'}</span>
                <span className="text-[10px] font-semibold uppercase tracking-widest">
                  {t === 'ui' ? 'UI Test' : 'API Test'}
                </span>
                <span className="text-[9px] opacity-70 normal-case tracking-normal">
                  {t === 'ui' ? 'Browser interactions' : 'HTTP requests'}
                </span>
              </button>
            ))}
          </div>

          <Field label="Test case name">
            <Input
              autoFocus
              value={tcName}
              onChange={(e) => setTcName(e.target.value)}
              placeholder={
                tcType === 'api'
                  ? 'GET /users returns 200 with data'
                  : 'User can log in with valid credentials'
              }
              onKeyDown={(e) => e.key === 'Enter' && handleCreateTC()}
            />
          </Field>
        </Modal>
      )}

      {deleteTarget && (
        <Modal
          title="Delete test case?"
          onClose={() => setDeleteTarget(null)}
          footer={
            <>
              <Btn variant="ghost" onClick={() => setDeleteTarget(null)}>Cancel</Btn>
              <Btn variant="danger" onClick={doDeleteTC}>Delete</Btn>
            </>
          }
        >
          <p className="text-xs text-vsc-muted leading-relaxed">
            This will permanently delete the test case and all its steps.
          </p>
        </Modal>
      )}
    </div>
  )
}
