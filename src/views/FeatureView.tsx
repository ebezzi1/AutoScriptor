import { useState } from 'react'
import { useApp } from '../store/AppContext'
import { useToast } from '../components/common/Toast'
import { usePermissions } from '../hooks/usePermissions'
import { Modal } from '../components/common/Modal'
import { Btn } from '../components/common/Btn'
import { Field, Input } from '../components/common/Field'
import { ChipInput } from '../components/common/ChipInput'
import { StepTable } from '../components/steps/StepTable'
import { useAgent } from '../store/AgentContext'
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
  const { isReadOnly } = usePermissions()
  const { isConnected, runCommand } = useAgent()
  const [creatingTC, setCreatingTC] = useState(false)
  const [tcName, setTcName] = useState('')
  const [tcType, setTcType] = useState<'ui' | 'api'>('ui')
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const project = state.projects.find((p) => p.id === projectId)
  const feature = state.features.find((f) => f.id === featureId)
  const testCases = state.testCases.filter((tc) => tc.featureId === featureId)
  const projectUtils = state.utils.filter((u) => u.projectId === projectId)
  const projectVars = state.variables.filter((v) => v.projectId === projectId).map((v) => v.key)

  // Resolve auth role used by TCs in this feature (if any)
  const authRoles = project?.auth?.roles ?? []
  const authEnabled = !!project?.auth?.enabled
  const featureRoleIds = new Set(
    testCases.map((tc) => tc.authRoleId).filter((id): id is string => !!id)
  )
  const usedRoles = authRoles.filter((r) => featureRoleIds.has(r.id))
  const fallbackRole = authEnabled && usedRoles.length === 0 && authRoles.length > 0 ? authRoles[0] : null

  if (!feature) return <div className="p-10 text-vsc-muted text-sm">Feature not found</div>

  const updateFeature = (updates: Partial<Feature>) =>
    dispatch({ type: 'UPDATE_FEATURE', feature: { ...feature, ...updates } })

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
    <div className="p-8 max-w-5xl mx-auto w-full flex flex-col gap-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-6">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-vsc-dim font-semibold uppercase tracking-widest mb-3">Feature</p>
          <input
            className="text-2xl font-bold bg-transparent text-vsc-text border-b border-transparent hover:border-vsc-border focus:border-vsc-accent outline-none w-full pb-1 transition-all leading-tight"
            value={feature.name}
            onChange={(e) => updateFeature({ name: e.target.value })}
            placeholder="Feature name"
            aria-label="Feature name"
          />
          <input
            className="text-sm text-vsc-muted bg-transparent border-b border-transparent hover:border-vsc-border focus:border-vsc-accent outline-none w-full mt-2 pb-1 transition-all"
            value={feature.description}
            onChange={(e) => updateFeature({ description: e.target.value })}
            placeholder="Add a description…"
            aria-label="Feature description"
          />
          <div className="mt-4">
            <ChipInput
              tags={feature.tags}
              onChange={(tags) => updateFeature({ tags })}
              placeholder="Add tags (@smoke, @regression…)"
            />
          </div>
        </div>
        <div className="pt-8 shrink-0 flex items-center gap-2.5">
          {isConnected && project?.localDirectory && feature && (
            <button
              onClick={() => {
                const s = (n: string) => n.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
                const cmd = `npx playwright test tests/${s(feature.name)}/`
                runCommand(cmd, projectId)
                toast('Running feature tests…')
              }}
              title="Run all tests in this feature"
              className="inline-flex items-center gap-1.5 border border-vsc-accent/40 bg-vsc-accent/10 hover:bg-vsc-accent/20 text-vsc-accent transition-all duration-150 rounded-md px-3 py-1.5 text-xs font-medium"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="shrink-0">
                <path d="M2 1l7 4-7 4V1z" fill="currentColor" fillOpacity="0.8"/>
              </svg>
              Run
            </button>
          )}
          {!isReadOnly && (
            <Btn
              variant="danger"
              size="sm"
              onClick={() => {
                dispatch({ type: 'DELETE_FEATURE', featureId })
                navigate({ type: 'project-dashboard', projectId })
                toast('Feature deleted', 'error')
              }}
            >
              Delete feature
            </Btn>
          )}
        </div>
      </div>

      {/* Auth reference */}
      {(() => {
        if (!authEnabled || authRoles.length === 0) {
          return (
            <div className="flex items-center gap-2.5 px-4 py-3 rounded-lg border border-vsc-border/60 bg-vsc-panel/40 text-xs text-vsc-muted">
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" className="text-vsc-dim shrink-0">
                <circle cx="6.5" cy="6.5" r="5.5" stroke="currentColor" strokeWidth="1.2"/>
                <path d="M6.5 4v3M6.5 9v.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              <span className="flex-1">No auth configured —</span>
              <button
                onClick={() => navigate({ type: 'utils', projectId })}
                className="text-vsc-accent hover:text-white font-medium transition-colors"
              >
                set up auth roles in Utils &amp; Params →
              </button>
            </div>
          )
        }
        const rolesToShow = usedRoles.length > 0 ? usedRoles : (fallbackRole ? [fallbackRole] : [])
        if (rolesToShow.length === 0) return null
        return (
          <div className="flex items-center gap-2.5 px-4 py-3 rounded-lg border border-vsc-accent/30 bg-vsc-accent/5 text-xs text-vsc-muted">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-vsc-accent shrink-0">
              <path d="M6 1l3.5 1.5v3.5c0 2.5-1.5 4-3.5 4.5-2-.5-3.5-2-3.5-4.5V2.5L6 1z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
            </svg>
            <span className="text-vsc-dim uppercase tracking-widest text-[10px] font-semibold">Auth</span>
            <span>Using</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {rolesToShow.map((role) => (
                <span
                  key={role.id}
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11px] font-medium"
                  style={{ color: role.color, borderColor: `${role.color}60`, backgroundColor: `${role.color}18` }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: role.color }} />
                  {role.name}
                </span>
              ))}
            </div>
            <span>for beforeEach</span>
            <div className="flex-1" />
            <button
              onClick={() => navigate({ type: 'utils', projectId })}
              className="text-vsc-dim hover:text-vsc-accent transition-colors text-[10px]"
            >
              Manage →
            </button>
          </div>
        )
      })()}

      {/* beforeEach / afterEach */}
      <div className="flex flex-col gap-3">
        <details className="group">
          <summary className="cursor-pointer py-2.5 select-none list-none flex items-center gap-3 hover:text-vsc-text transition-colors">
            <svg
              width="12" height="12" viewBox="0 0 12 12" fill="none"
              className="text-vsc-dim transition-transform group-open:rotate-90 shrink-0"
            >
              <path d="M3 2l6 4-6 4V2z" fill="currentColor" fillOpacity="0.7"/>
            </svg>
            <span className="text-xs font-semibold text-vsc-muted uppercase tracking-widest">beforeEach</span>
            <span className="text-xs text-vsc-dim">— setup steps ({feature.beforeEachSteps.length})</span>
          </summary>
          <div className="mt-3">
            <StepTable
              steps={feature.beforeEachSteps}
              onChange={(steps) => updateFeature({ beforeEachSteps: steps })}
              variables={projectVars}
              availableUtils={projectUtils}
            />
          </div>
        </details>

        <details className="group">
          <summary className="cursor-pointer py-2.5 select-none list-none flex items-center gap-3 hover:text-vsc-text transition-colors">
            <svg
              width="12" height="12" viewBox="0 0 12 12" fill="none"
              className="text-vsc-dim transition-transform group-open:rotate-90 shrink-0"
            >
              <path d="M3 2l6 4-6 4V2z" fill="currentColor" fillOpacity="0.7"/>
            </svg>
            <span className="text-xs font-semibold text-vsc-muted uppercase tracking-widest">afterEach</span>
            <span className="text-xs text-vsc-dim">— teardown steps ({feature.afterEachSteps.length})</span>
          </summary>
          <div className="mt-3">
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
        <div className="flex items-center gap-3 mb-5">
          <h2 className="text-xs font-semibold text-vsc-dim uppercase tracking-widest">Test cases</h2>
          <span className="text-xs text-vsc-accent font-bold tabular-nums">{testCases.length}</span>
          <div className="flex-1 h-px bg-vsc-border/60" />
          {!isReadOnly && (
            <Btn variant="primary" size="sm" onClick={() => setCreatingTC(true)}>
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none" className="shrink-0">
                <path d="M5.5 1v9M1 5.5h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              Add test case
            </Btn>
          )}
        </div>

        {testCases.length === 0 ? (
          <div className="border border-dashed border-vsc-border/60 rounded-xl p-12 text-center">
            <p className="text-vsc-dim text-sm">No test cases yet</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {testCases.map((tc) => (
              <div
                key={tc.id}
                className="flex items-center gap-4 bg-vsc-panel border border-vsc-border rounded-xl px-5 py-3.5 cursor-pointer hover:border-vsc-accent/40 hover:bg-vsc-hover transition-all duration-200 group relative overflow-hidden"
                onClick={() => navigate({ type: 'test-case', projectId, featureId, testCaseId: tc.id })}
              >
                <div className="absolute left-0 top-3 bottom-3 w-[2px] rounded-full bg-vsc-border group-hover:bg-vsc-accent transition-all" />
                <div className="flex-1 min-w-0 pl-2">
                  <span className="text-sm text-vsc-text font-medium truncate block group-hover:text-white transition-colors">
                    {tc.name}
                  </span>
                  {tc.description && (
                    <span className="text-xs text-vsc-muted truncate block mt-0.5">{tc.description}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {tc.type === 'api' && (
                    <span className="text-2xs px-2 py-0.5 rounded-full border border-vsc-blue/40 text-vsc-blue bg-vsc-blue/10 font-semibold">
                      API
                    </span>
                  )}
                  <span className={`text-2xs px-2 py-0.5 rounded-full font-semibold border ${PRIORITY_COLORS[tc.priority]}`}>
                    {tc.priority}
                  </span>
                  {tc.tags.map((t) => (
                    <span key={t} className="text-2xs border border-vsc-accent/30 text-vsc-accent px-2 py-0.5 rounded-full font-medium">
                      {t}
                    </span>
                  ))}
                  <span className="text-xs text-vsc-dim tabular-nums">
                    {tc.type === 'api'
                      ? `${(tc.apiSteps ?? []).length} req`
                      : `${tc.steps.length} step${tc.steps.length !== 1 ? 's' : ''}`}
                  </span>
                  {!isReadOnly && (
                    <button
                      className="opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 flex items-center justify-center rounded text-vsc-dim hover:text-vsc-danger hover:bg-vsc-danger-light text-base leading-none"
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget(tc.id) }}
                      aria-label="Delete test case"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create TC modal */}
      {creatingTC && (
        <Modal
          title="New test case"
          onClose={() => setCreatingTC(false)}
          footer={
            <>
              <Btn variant="ghost" onClick={() => setCreatingTC(false)}>Cancel</Btn>
              <Btn variant="primary" onClick={handleCreateTC} disabled={!tcName.trim()}>Create</Btn>
            </>
          }
        >
          <div className="flex gap-3 mb-6">
            {(['ui', 'api'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTcType(t)}
                className={`flex-1 flex flex-col items-center gap-2 py-4 px-5 rounded-xl border transition-all ${
                  tcType === t
                    ? t === 'api'
                      ? 'border-vsc-blue/50 bg-vsc-blue/10 text-vsc-blue'
                      : 'border-vsc-accent/50 bg-vsc-accent/10 text-vsc-accent'
                    : 'border-vsc-border text-vsc-muted hover:text-vsc-text hover:border-vsc-border/80 hover:bg-vsc-hover'
                }`}
              >
                <span className="text-xl leading-none">{t === 'ui' ? '🖥' : '⚡'}</span>
                <span className="text-sm font-semibold">{t === 'ui' ? 'UI Test' : 'API Test'}</span>
                <span className="text-xs opacity-60">
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
              placeholder={tcType === 'api' ? 'GET /users returns 200 with data' : 'User can log in with valid credentials'}
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
          <p className="text-sm text-vsc-muted leading-relaxed">
            This will permanently delete the test case and all its steps.
          </p>
        </Modal>
      )}
    </div>
  )
}
