import { useState } from 'react'
import { useApp } from '../store/AppContext'
import { useToast } from '../components/common/Toast'
import { Modal } from '../components/common/Modal'
import { Btn } from '../components/common/Btn'
import { Field, Input } from '../components/common/Field'
import { BulkRunPanel } from '../components/BulkRunPanel'
import type { Feature } from '../types'

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

export function ProjectDashboard({ projectId }: Props) {
  const { state, dispatch, navigate } = useApp()
  const { toast } = useToast()
  const [creating, setCreating] = useState(false)
  const [featureName, setFeatureName] = useState('')
  const [showRunPanel, setShowRunPanel] = useState(false)

  const project = state.projects.find((p) => p.id === projectId)
  const features = state.features.filter((f) => f.projectId === projectId)
  const testCases = state.testCases.filter((tc) => tc.projectId === projectId)
  const stepCount = testCases.reduce((acc, tc) => acc + tc.steps.length, 0)

  if (!project) return <div className="p-8 text-vsc-muted text-xs">Project not found</div>

  const handleCreateFeature = () => {
    if (!featureName.trim()) return
    const f = newFeature(projectId, featureName.trim())
    dispatch({ type: 'CREATE_FEATURE', feature: f })
    toast(`Feature "${f.name}" created`)
    navigate({ type: 'feature', projectId, featureId: f.id })
    setCreating(false)
    setFeatureName('')
  }

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="text-[9px] text-vsc-accent uppercase tracking-[0.16em] mb-1.5">Project</p>
          <h1 className="text-xl font-semibold text-vsc-text tracking-tight">{project.name}</h1>
          {project.description && (
            <p className="text-[11px] text-vsc-muted mt-1">{project.description}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Btn
            variant="ghost"
            onClick={() => navigate({ type: 'project-settings', projectId })}
          >
            @ Settings
          </Btn>
          <Btn variant="ghost" onClick={() => setShowRunPanel(true)}>
            ▶ Run
          </Btn>
          <Btn variant="primary" onClick={() => setCreating(true)}>
            + Add feature
          </Btn>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-px mb-8 border border-vsc-border rounded-sm overflow-hidden">
        {[
          { label: 'Features', value: features.length },
          { label: 'Test cases', value: testCases.length },
          { label: 'Steps', value: stepCount },
          { label: 'Utils', value: state.utils.filter((u) => u.projectId === projectId).length },
        ].map((stat, i) => (
          <div
            key={stat.label}
            className={`bg-vsc-panel p-4 text-center ${i < 3 ? 'border-r border-vsc-border' : ''}`}
          >
            <div className="text-2xl font-semibold text-vsc-accent tabular-nums">{stat.value}</div>
            <div className="text-[9px] text-vsc-muted mt-1 uppercase tracking-widest">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Features list */}
      <div className="flex items-center gap-3 mb-3">
        <h2 className="text-[9px] font-semibold text-vsc-dim uppercase tracking-[0.14em]">
          Features
        </h2>
        <div className="flex-1 h-px bg-vsc-border/50" />
      </div>

      {features.length === 0 ? (
        <div className="border border-dashed border-vsc-border/60 rounded-sm p-12 text-center">
          <p className="text-vsc-dim text-[10px] uppercase tracking-wider">No features yet</p>
          <div className="mt-4">
            <Btn variant="primary" onClick={() => setCreating(true)}>
              + Add first feature
            </Btn>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {features.map((f) => {
            const tcs = testCases.filter((tc) => tc.featureId === f.id)
            return (
              <div
                key={f.id}
                className="bg-vsc-panel border border-vsc-border rounded-sm px-4 py-3 cursor-pointer hover:border-vsc-accent/50 hover:bg-vsc-hover transition-all duration-150 group flex items-center gap-3 relative overflow-hidden"
                onClick={() =>
                  navigate({ type: 'feature', projectId, featureId: f.id })
                }
              >
                <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-vsc-accent/20 group-hover:bg-vsc-accent/60 transition-all" />
                <div className="w-4 h-4 flex items-center justify-center shrink-0">
                  <span className="text-vsc-accent text-[10px]">◆</span>
                </div>
                <div className="flex-1 min-w-0 pl-1">
                  <p className="text-[12px] font-medium text-vsc-text truncate">{f.name}</p>
                  {f.description && (
                    <p className="text-[10px] text-vsc-muted truncate">{f.description}</p>
                  )}
                  {f.tags.length > 0 && (
                    <div className="flex gap-1.5 mt-1">
                      {f.tags.map((t) => (
                        <span
                          key={t}
                          className="text-[9px] border border-vsc-accent/30 text-vsc-accent px-1.5 py-0.5 uppercase tracking-wide"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <span className="text-[10px] text-vsc-dim shrink-0 tabular-nums">
                  {tcs.length} test{tcs.length !== 1 ? 's' : ''}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {showRunPanel && (
        <BulkRunPanel
          features={features}
          testCases={testCases}
          onClose={() => setShowRunPanel(false)}
        />
      )}

      {creating && (
        <Modal
          title="New feature"
          onClose={() => setCreating(false)}
          footer={
            <>
              <Btn variant="ghost" onClick={() => setCreating(false)}>Cancel</Btn>
              <Btn
                variant="primary"
                onClick={handleCreateFeature}
                disabled={!featureName.trim()}
              >
                Create
              </Btn>
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
