import { useState } from 'react'
import { useApp } from '../store/AppContext'
import { useToast } from '../components/common/Toast'
import { usePermissions } from '../hooks/usePermissions'
import { useAgent } from '../store/AgentContext'
import { Modal } from '../components/common/Modal'
import { Btn } from '../components/common/Btn'
import { Field, Input } from '../components/common/Field'
import { BulkRunPanel } from '../components/BulkRunPanel'
import { CiCdPanel } from '../components/CiCdPanel'
import { MatrixPreviewModal } from '../components/MatrixPreviewModal'
import { CoverageMap } from '../components/CoverageMap'
import { TestPlanModal } from '../components/TestPlanModal'
import { DependencyGraph } from '../components/DependencyGraph'
import { ProjectHistoryTab } from '../components/ProjectHistoryTab'
import type { Feature, CiCdConfig } from '../types'

function newFeature(projectId: string, name: string): Feature {
  return {
    id: crypto.randomUUID(),
    projectId,
    name,
    description: '',
    tags: [],
    beforeEachSteps: [],
    afterEachSteps: [],
  }
}

interface Props { projectId: string }

const BANNER_DISMISSED_KEY = 'agent-banner-dismissed'

export function ProjectDashboard({ projectId }: Props) {
  const { state, dispatch, navigate } = useApp()
  const { toast } = useToast()
  const { isReadOnly } = usePermissions()
  const { isConnected } = useAgent()
  const [bannerDismissed, setBannerDismissed] = useState(() => {
    try { return localStorage.getItem(BANNER_DISMISSED_KEY) === '1' } catch { return false }
  })
  const [creating, setCreating] = useState(false)
  const [featureName, setFeatureName] = useState('')
  const [showRunPanel, setShowRunPanel] = useState(false)
  const [showCicd, setShowCicd] = useState(false)
  const [showMatrix, setShowMatrix] = useState(false)
  const [showTestPlan, setShowTestPlan] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'coverage' | 'dependencies' | 'history'>('overview')

  const project = state.projects.find((p) => p.id === projectId)
  const features = state.features.filter((f) => f.projectId === projectId)
  const testCases = state.testCases.filter((tc) => tc.projectId === projectId)
  const stepCount = testCases.reduce((acc, tc) => acc + tc.steps.length, 0)

  if (!project) return <div className="p-10 text-vsc-muted text-sm">Project not found</div>

  const handleCreateFeature = () => {
    if (!featureName.trim()) return
    const f = newFeature(projectId, featureName.trim())
    dispatch({ type: 'CREATE_FEATURE', feature: f })
    toast(`Feature "${f.name}" created`)
    navigate({ type: 'feature', projectId, featureId: f.id })
    setCreating(false)
    setFeatureName('')
  }

  const dismissBanner = () => {
    setBannerDismissed(true)
    try { localStorage.setItem(BANNER_DISMISSED_KEY, '1') } catch { /* ignore */ }
  }

  return (
    <div className="py-10 px-6 max-w-4xl mx-auto">
      {/* Agent not-running banner */}
      {!isConnected && !bannerDismissed && (
        <div className="flex items-center gap-3 mb-6 px-4 py-3 rounded-lg border border-vsc-border bg-vsc-panel text-xs text-vsc-muted">
          <span className="w-2 h-2 rounded-full bg-vsc-border shrink-0" />
          <span className="flex-1">
            Install the agent to run tests:{' '}
            <code className="font-mono text-vsc-text bg-vsc-hover px-1.5 py-0.5 rounded text-[10px]">
              npm i -g autoscriptor-agent &amp;&amp; autoscriptor-agent start
            </code>
          </span>
          <button
            onClick={dismissBanner}
            className="text-vsc-dim hover:text-vsc-muted transition-colors shrink-0"
            title="Dismiss"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      )}

      {/* Title */}
      <div className="mb-3">
        <p className="text-xs text-vsc-dim font-semibold uppercase tracking-widest mb-2">Project</p>
        <h1 className="text-3xl font-bold text-vsc-text tracking-tight">{project.name}</h1>
        {project.description && (
          <p className="text-sm text-vsc-muted mt-1.5">{project.description}</p>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 mb-8 flex-wrap">
        <Btn variant="ghost" onClick={() => navigate({ type: 'project-settings', projectId })}>
          Settings
        </Btn>
        <Btn variant="ghost" onClick={() => setShowCicd(true)}>
          CI/CD
          {project.cicd && (
            <span className="w-1.5 h-1.5 rounded-full bg-vsc-accent shrink-0" />
          )}
        </Btn>
        <Btn variant="ghost" onClick={() => setShowTestPlan(true)}>
          Test Plan
        </Btn>
        <Btn variant="ghost" onClick={() => setShowMatrix(true)}>
          Export Matrix
        </Btn>
        <Btn variant="ghost" onClick={() => setShowRunPanel(true)}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="shrink-0">
            <path d="M2 1l7 4-7 4V1z" fill="currentColor" fillOpacity="0.7"/>
          </svg>
          Run
        </Btn>
        <div className="flex-1" />
        {!isReadOnly && (
          <Btn variant="primary" onClick={() => setCreating(true)}>
            + Add feature
          </Btn>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-px mb-8 border border-vsc-border rounded-xl overflow-hidden">
        {[
          { label: 'Features', value: features.length },
          { label: 'Test cases', value: testCases.length },
          { label: 'Steps', value: stepCount },
          { label: 'Utils', value: state.utils.filter((u) => u.projectId === projectId).length },
        ].map((stat, i) => (
          <div
            key={stat.label}
            className={`bg-vsc-panel px-6 py-5 text-center ${i < 3 ? 'border-r border-vsc-border' : ''}`}
          >
            <div className="text-2xl font-bold text-vsc-accent tabular-nums">{stat.value}</div>
            <div className="text-2xs text-vsc-dim mt-1.5 font-semibold uppercase tracking-widest">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0 border-b border-vsc-border mb-6">
        {([
          { id: 'overview', label: 'Overview' },
          { id: 'coverage', label: 'Coverage Map' },
          { id: 'dependencies', label: 'Dependencies' },
          { id: 'history', label: 'History' },
        ] as const).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px ${
              activeTab === tab.id
                ? 'border-vsc-accent text-vsc-accent'
                : 'border-transparent text-vsc-muted hover:text-vsc-text'
            }`}
          >
            {tab.label}
            {tab.id === 'dependencies' && (() => {
              const count = testCases.filter((tc) => (tc.dependencies?.length ?? 0) > 0).length
              if (count === 0) return null
              return (
                <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded tabular-nums bg-vsc-accent/15 text-vsc-accent">
                  {count}
                </span>
              )
            })()}
            {tab.id === 'history' && null}
            {tab.id === 'coverage' && (() => {
              const nonZero = features.filter((f) =>
                testCases.some((tc) => tc.featureId === f.id)
              ).length
              const total = features.length
              if (total === 0) return null
              const pct = Math.round((nonZero / total) * 100)
              return (
                <span className={`ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded tabular-nums ${
                  pct === 100 ? 'bg-green-500/15 text-green-400' :
                  pct >= 50  ? 'bg-amber-500/15 text-amber-400' :
                              'bg-red-500/15 text-red-400'
                }`}>
                  {pct}%
                </span>
              )
            })()}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && (
        <>
          <div className="flex items-center gap-3 mb-5">
            <h2 className="text-xs font-semibold text-vsc-dim uppercase tracking-widest">Features</h2>
            <div className="flex-1 h-px bg-vsc-border/60" />
          </div>

          {features.length === 0 ? (
            <div className="border border-dashed border-vsc-border/60 rounded-xl p-14 text-center">
              <p className="text-vsc-dim text-sm font-medium">No features yet</p>
              <div className="mt-5">
                <Btn variant="primary" onClick={() => setCreating(true)}>
                  Add first feature
                </Btn>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {features.map((f) => {
                const tcs = testCases.filter((tc) => tc.featureId === f.id)
                return (
                  <div
                    key={f.id}
                    className="bg-vsc-panel border border-vsc-border rounded-xl px-5 py-4 cursor-pointer hover:border-vsc-accent/40 hover:bg-vsc-hover transition-all duration-200 group flex items-center gap-4 relative overflow-hidden"
                    onClick={() => navigate({ type: 'feature', projectId, featureId: f.id })}
                  >
                    <div className="absolute left-0 top-4 bottom-4 w-[2px] rounded-full bg-vsc-border group-hover:bg-vsc-accent transition-all duration-200" />
                    <div className="flex-1 min-w-0 pl-2">
                      <p className="text-sm font-semibold text-vsc-text truncate group-hover:text-white transition-colors">
                        {f.name}
                      </p>
                      {f.description && (
                        <p className="text-xs text-vsc-muted truncate mt-0.5">{f.description}</p>
                      )}
                      {f.tags.length > 0 && (
                        <div className="flex gap-1.5 mt-2">
                          {f.tags.map((t) => (
                            <span key={t} className="text-2xs border border-vsc-accent/30 text-vsc-accent px-2 py-0.5 rounded-full font-medium">
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <span className="text-xs text-vsc-dim shrink-0 tabular-nums font-medium">
                      {tcs.length} test{tcs.length !== 1 ? 's' : ''}
                    </span>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-vsc-dim shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {activeTab === 'coverage' && (
        <CoverageMap
          features={features}
          testCases={testCases}
          projectId={projectId}
          onNavigateFeature={(featureId) => navigate({ type: 'feature', projectId, featureId })}
        />
      )}

      {activeTab === 'dependencies' && (
        <DependencyGraph
          features={features}
          testCases={testCases}
          projectId={projectId}
          onNavigate={(tc) => navigate({ type: 'test-case', projectId, featureId: tc.featureId, testCaseId: tc.id })}
        />
      )}

      {activeTab === 'history' && (
        <ProjectHistoryTab projectId={projectId} projectName={project.name} />
      )}

      {showRunPanel && (
        <BulkRunPanel project={project} features={features} testCases={testCases} onClose={() => setShowRunPanel(false)} />
      )}

      {showTestPlan && (
        <TestPlanModal
          project={project}
          features={features}
          testCases={testCases}
          variables={state.variables.filter((v) => v.projectId === projectId)}
          utils={state.utils.filter((u) => u.projectId === projectId)}
          fixtures={state.fixtures.filter((fx) => fx.projectId === projectId)}
          onClose={() => setShowTestPlan(false)}
        />
      )}

      {showMatrix && (
        <MatrixPreviewModal
          project={project}
          features={features}
          testCases={testCases}
          fixtures={state.fixtures.filter((fx) => fx.projectId === projectId)}
          onClose={() => setShowMatrix(false)}
        />
      )}

      {showCicd && (
        <CiCdPanel
          project={project}
          onSave={(cfg: CiCdConfig) => {
            dispatch({ type: 'UPDATE_PROJECT', project: { ...project, cicd: cfg } })
            toast('CI/CD config saved')
          }}
          onClose={() => setShowCicd(false)}
        />
      )}

      {creating && (
        <Modal
          title="New feature"
          onClose={() => setCreating(false)}
          footer={
            <>
              <Btn variant="ghost" onClick={() => setCreating(false)}>Cancel</Btn>
              <Btn variant="primary" onClick={handleCreateFeature} disabled={!featureName.trim()}>Create</Btn>
            </>
          }
        >
          <Field label="Feature name">
            <Input
              autoFocus
              value={featureName}
              onChange={(e) => setFeatureName(e.target.value)}
              placeholder="Authentication, Checkout, Dashboard…"
              onKeyDown={(e) => e.key === 'Enter' && handleCreateFeature()}
            />
          </Field>
        </Modal>
      )}
    </div>
  )
}
