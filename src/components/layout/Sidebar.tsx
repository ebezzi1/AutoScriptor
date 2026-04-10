import { useState, useEffect, useRef } from 'react'
import { useApp } from '../../store/AppContext'
import { Btn } from '../common/Btn'
import { DuplicateToModal } from '../DuplicateToModal'
import { useToast } from '../common/Toast'
import { getEnvColor } from '../../types'

export function Sidebar() {
  const { state, navigate, dispatch } = useApp()
  const { currentView } = state

  const activeProjectId =
    currentView.type !== 'projects' ? currentView.projectId : null

  const project = activeProjectId
    ? state.projects.find((p) => p.id === activeProjectId)
    : null

  const features = state.features.filter((f) => f.projectId === activeProjectId)

  const activeEnv = project?.environments?.find((e) => e.id === project?.activeEnvironmentId) ?? null
  const activeEnvHex = activeEnv ? getEnvColor(activeEnv) : null

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const { toast } = useToast()

  // Three-dot menu state: which TC, its feature, and viewport position
  type TcMenu = { tcId: string; featureId: string; x: number; y: number } | null
  const [tcMenu, setTcMenu] = useState<TcMenu>(null)
  const [showDupTo, setShowDupTo] = useState(false)
  const tcMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (tcMenu) {
      const handle = (e: MouseEvent) => {
        if (tcMenuRef.current && !tcMenuRef.current.contains(e.target as Node)) {
          setTcMenu(null)
        }
      }
      document.addEventListener('mousedown', handle)
      return () => document.removeEventListener('mousedown', handle)
    }
    return undefined
  }, [tcMenu])

  const handleDotMenu = (e: React.MouseEvent, tcId: string, featureId: string) => {
    e.stopPropagation()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setTcMenu(prev =>
      prev?.tcId === tcId ? null : { tcId, featureId, x: rect.right + 4, y: rect.top }
    )
  }

  const handleDuplicateHere = () => {
    if (!tcMenu || !project) return
    const original = state.testCases.find((t) => t.id === tcMenu.tcId)
    if (!original) return
    const newTcId = crypto.randomUUID()
    dispatch({ type: 'DUPLICATE_TC', tcId: tcMenu.tcId, newTcId })
    toast(`"${original.name}" duplicated`)
    navigate({ type: 'test-case', projectId: project.id, featureId: tcMenu.featureId, testCaseId: newTcId })
    setTcMenu(null)
  }

  const handleDuplicateTo = (targetFeatureId: string) => {
    if (!tcMenu || !project) return
    const original = state.testCases.find((t) => t.id === tcMenu.tcId)
    if (!original) return
    const newTcId = crypto.randomUUID()
    const targetFeature = state.features.find((f) => f.id === targetFeatureId)
    dispatch({ type: 'DUPLICATE_TC_TO', tcId: tcMenu.tcId, targetFeatureId, newTcId })
    toast(`"${original.name}" duplicated to "${targetFeature?.name ?? 'feature'}"`)
    navigate({ type: 'test-case', projectId: project.id, featureId: targetFeatureId, testCaseId: newTcId })
    setTcMenu(null)
  }

  const handleDelete = () => {
    if (!tcMenu) return
    dispatch({ type: 'DELETE_TC', tcId: tcMenu.tcId })
    setTcMenu(null)
  }

  const toggleFeature = (fId: string) =>
    setCollapsed((prev) => ({ ...prev, [fId]: !prev[fId] }))

  return (
    <aside className="w-60 shrink-0 bg-vsc-sidebar border-r border-vsc-border flex flex-col h-full overflow-hidden">
      {/* Logo / home */}
      <div
        className="flex items-center gap-2.5 px-4 py-3 border-b border-vsc-border cursor-pointer hover:bg-vsc-hover transition-colors group"
        onClick={() => navigate({ type: 'projects' })}
      >
        <div className="w-5 h-5 border border-vsc-accent flex items-center justify-center shrink-0">
          <span className="text-vsc-accent text-[9px] font-semibold leading-none">PW</span>
        </div>
        <span className="text-[10px] font-semibold text-vsc-text uppercase tracking-widest">
          PW Generator
        </span>
      </div>

      {/* Project list or project nav */}
      {!project ? (
        <div className="flex-1 overflow-y-auto p-2">
          <p className="text-[9px] uppercase tracking-[0.14em] text-vsc-dim mb-2 px-2 pt-1">
            Projects
          </p>
          {state.projects.length === 0 ? (
            <p className="text-[10px] text-vsc-dim px-2 py-1">No projects yet</p>
          ) : (
            state.projects.map((p) => (
              <button
                key={p.id}
                className="w-full text-left px-2 py-1.5 text-[11px] text-vsc-muted hover:text-vsc-text hover:bg-vsc-hover transition-all rounded-sm"
                onClick={() =>
                  navigate({ type: 'project-dashboard', projectId: p.id })
                }
              >
                {p.name}
              </button>
            ))
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {/* Project name */}
          <div className="px-3 py-2.5 border-b border-vsc-border">
            <button
              className="text-[11px] font-semibold text-vsc-text hover:text-vsc-accent transition-colors truncate w-full text-left"
              onClick={() =>
                navigate({ type: 'project-dashboard', projectId: project.id })
              }
            >
              {project.name}
            </button>
            <div className="flex gap-1 mt-1.5 flex-wrap">
              <span className="text-[9px] text-vsc-muted bg-vsc-active border border-vsc-border px-1.5 py-0.5 uppercase tracking-wide">
                {project.language === 'typescript' ? 'TS' : 'JS'}
              </span>
              <span className="text-[9px] text-vsc-muted bg-vsc-active border border-vsc-border px-1.5 py-0.5 uppercase tracking-wide">
                {project.browser}
              </span>
              {activeEnv && activeEnvHex && (
                <span
                  className="text-[9px] px-1.5 py-0.5 border rounded-sm uppercase tracking-wide font-semibold"
                  style={{
                    color: activeEnvHex,
                    borderColor: `${activeEnvHex}60`,
                    backgroundColor: `${activeEnvHex}18`,
                  }}
                >
                  ● {activeEnv.name}
                </span>
              )}
            </div>
          </div>

          {/* Features + TCs tree */}
          <div className="p-1.5">
            {features.length === 0 ? (
              <p className="text-[10px] text-vsc-dim px-2 py-2">No features yet</p>
            ) : (
              features.map((feature) => {
                const tcs = state.testCases.filter(
                  (tc) => tc.featureId === feature.id
                )
                const isOpen = !collapsed[feature.id]
                const isActiveFeature =
                  currentView.type === 'feature' &&
                  currentView.featureId === feature.id
                return (
                  <div key={feature.id}>
                    <div className="flex items-center gap-0.5 group">
                      <button
                        className="text-vsc-dim hover:text-vsc-muted text-[10px] w-4 shrink-0"
                        onClick={() => toggleFeature(feature.id)}
                      >
                        {isOpen ? '▾' : '▸'}
                      </button>
                      <button
                        className={`flex-1 text-left text-[11px] py-1 px-1.5 truncate transition-all border-l-2 ${
                          isActiveFeature
                            ? 'text-vsc-accent border-l-vsc-accent bg-vsc-accent-light'
                            : 'text-vsc-text border-l-transparent hover:bg-vsc-hover hover:border-l-vsc-border'
                        }`}
                        onClick={() =>
                          navigate({
                            type: 'feature',
                            projectId: project.id,
                            featureId: feature.id,
                          })
                        }
                      >
                        ◆ {feature.name}
                      </button>
                    </div>
                    {isOpen && (
                      <div className="ml-4 border-l border-vsc-border/40 pl-2">
                        {tcs.map((tc) => {
                          const isActiveTc =
                            currentView.type === 'test-case' &&
                            currentView.testCaseId === tc.id
                          const isMenuOpen = tcMenu?.tcId === tc.id
                          return (
                            <div
                              key={tc.id}
                              className={`flex items-center group transition-all border-l-2 ${
                                isActiveTc
                                  ? 'border-l-vsc-accent bg-vsc-accent-light'
                                  : 'border-l-transparent hover:bg-vsc-hover hover:border-l-vsc-border'
                              }`}
                            >
                              <button
                                className={`flex-1 text-left text-[10px] py-0.5 px-1.5 truncate transition-colors ${
                                  isActiveTc ? 'text-vsc-accent' : 'text-vsc-muted group-hover:text-vsc-text'
                                }`}
                                onClick={() =>
                                  navigate({
                                    type: 'test-case',
                                    projectId: project.id,
                                    featureId: feature.id,
                                    testCaseId: tc.id,
                                  })
                                }
                              >
                                ◇ {tc.name}
                              </button>
                              <button
                                onClick={(e) => handleDotMenu(e, tc.id, feature.id)}
                                title="More actions"
                                className={`shrink-0 px-1 py-0.5 text-[11px] leading-none transition-colors ${
                                  isMenuOpen
                                    ? 'text-vsc-accent'
                                    : 'text-vsc-dim opacity-0 group-hover:opacity-100 hover:text-vsc-accent'
                                }`}
                              >
                                ⋯
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}

      {/* Three-dot TC menu — rendered fixed to escape overflow:hidden */}
      {tcMenu && (
        <div
          ref={tcMenuRef}
          className="fixed z-50 bg-vsc-panel border border-vsc-border rounded-sm shadow-lg shadow-black/50 py-0.5 min-w-[152px]"
          style={{ top: tcMenu.y, left: tcMenu.x }}
        >
          <button
            className="w-full text-left px-3 py-1.5 text-[10px] text-vsc-muted hover:text-vsc-text hover:bg-vsc-hover transition-colors uppercase tracking-wide"
            onClick={handleDuplicateHere}
          >
            ⧉ Duplicate here
          </button>
          <button
            className="w-full text-left px-3 py-1.5 text-[10px] text-vsc-muted hover:text-vsc-accent hover:bg-vsc-hover transition-colors uppercase tracking-wide"
            onClick={() => { setShowDupTo(true); setTcMenu(null) }}
          >
            ⧉ Duplicate to…
          </button>
          <div className="my-0.5 border-t border-vsc-border/40" />
          <button
            className="w-full text-left px-3 py-1.5 text-[10px] text-vsc-danger hover:bg-vsc-danger-light hover:text-vsc-danger transition-colors uppercase tracking-wide"
            onClick={handleDelete}
          >
            × Delete
          </button>
        </div>
      )}

      {showDupTo && tcMenu && project && (() => {
        const menuTcFeatureId = tcMenu.featureId
        const menuTcId = tcMenu.tcId
        const menuTc = state.testCases.find((t) => t.id === menuTcId)
        return (
          <DuplicateToModal
            tcName={menuTc?.name ?? ''}
            currentFeatureId={menuTcFeatureId}
            features={state.features.filter((f) => f.projectId === project.id)}
            testCases={state.testCases.filter((t) => t.projectId === project.id)}
            onDuplicate={handleDuplicateTo}
            onClose={() => setShowDupTo(false)}
          />
        )
      })()}

      {/* Bottom nav */}
      {project && (
        <div className="border-t border-vsc-border p-1.5 space-y-0.5">
          <button
            className={`w-full text-left text-[10px] px-2 py-1.5 transition-all border-l-2 uppercase tracking-wide flex items-center gap-1.5 ${
              currentView.type === 'utils'
                ? 'text-vsc-accent border-l-vsc-accent bg-vsc-accent-light'
                : 'text-vsc-muted border-l-transparent hover:text-vsc-text hover:bg-vsc-hover hover:border-l-vsc-border'
            }`}
            onClick={() =>
              navigate({ type: 'utils', projectId: project.id })
            }
          >
            <span># Utils & Params</span>
            {activeEnvHex && currentView.type !== 'utils' && (
              <span className="text-[7px] leading-none ml-auto" style={{ color: activeEnvHex }}>●</span>
            )}
          </button>
          <button
            className={`w-full text-left text-[10px] px-2 py-1.5 transition-all border-l-2 uppercase tracking-wide ${
              currentView.type === 'project-settings'
                ? 'text-vsc-accent border-l-vsc-accent bg-vsc-accent-light'
                : 'text-vsc-muted border-l-transparent hover:text-vsc-text hover:bg-vsc-hover hover:border-l-vsc-border'
            }`}
            onClick={() =>
              navigate({ type: 'project-settings', projectId: project.id })
            }
          >
            @ Settings
          </button>
          <Btn
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            onClick={() => navigate({ type: 'projects' })}
          >
            ← All projects
          </Btn>
        </div>
      )}
    </aside>
  )
}
