import { useState, useEffect, useRef, useCallback } from 'react'
import { useApp } from '../../store/AppContext'
import { Btn } from '../common/Btn'
import { DuplicateToModal } from '../DuplicateToModal'
import { BulkTcBar } from '../BulkTcBar'
import { useToast } from '../common/Toast'
import { getEnvColor } from '../../types'
import type { TestCase } from '../../types'

// ── Small tri-state checkbox visual ──────────────────────────────────────────

function Checkbox({
  checked,
  indeterminate,
  onChange,
  className = '',
}: {
  checked: boolean
  indeterminate?: boolean
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  className?: string
}) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = !checked && !!indeterminate
  }, [checked, indeterminate])
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      className={`w-3.5 h-3.5 accent-vsc-accent shrink-0 rounded cursor-pointer ${className}`}
    />
  )
}

export function Sidebar() {
  const { state, navigate, dispatch } = useApp()
  const { currentView } = state
  const { toast } = useToast()

  const activeProjectId =
    currentView.type !== 'projects' ? currentView.projectId : null
  const project = activeProjectId
    ? state.projects.find((p) => p.id === activeProjectId)
    : null
  const features = state.features.filter((f) => f.projectId === activeProjectId)
  const allProjectTCs = state.testCases.filter((tc) => tc.projectId === activeProjectId)
  const activeEnv = project?.environments?.find((e) => e.id === project?.activeEnvironmentId) ?? null
  const activeEnvHex = activeEnv ? getEnvColor(activeEnv) : null

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  // ── Selection state ────────────────────────────────────────────────────────
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [lastClickedId, setLastClickedId] = useState<string | null>(null)
  const [triggerDelete, setTriggerDelete] = useState(false)
  const [triggerDuplicate, setTriggerDuplicate] = useState(false)

  // Flat ordered TC list (sidebar display order) for range selection
  const flatTcList = features.flatMap((f) =>
    allProjectTCs.filter((tc) => tc.featureId === f.id)
  )

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false)
    setSelectedIds(new Set())
    setLastClickedId(null)
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
    setLastClickedId(null)
  }, [])

  // Keyboard shortcuts when in selection mode
  useEffect(() => {
    if (!selectionMode) return undefined
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { exitSelectionMode(); return }
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault()
        setSelectedIds(new Set(flatTcList.map((tc) => tc.id)))
      }
      if (e.key === 'Delete' && selectedIds.size > 0) {
        setTriggerDelete(true)
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'd' && selectedIds.size > 0) {
        e.preventDefault()
        setTriggerDuplicate(true)
      }
    }
    document.addEventListener('keydown', handle)
    return () => document.removeEventListener('keydown', handle)
  }, [selectionMode, selectedIds, flatTcList, exitSelectionMode])

  // Click away from sidebar — do nothing (selection is sidebar-local)

  const toggleTc = (tc: TestCase, shiftHeld: boolean) => {
    if (shiftHeld && lastClickedId) {
      // Range selection
      const flat = flatTcList
      const aIdx = flat.findIndex((t) => t.id === lastClickedId)
      const bIdx = flat.findIndex((t) => t.id === tc.id)
      if (aIdx !== -1 && bIdx !== -1) {
        const lo = Math.min(aIdx, bIdx)
        const hi = Math.max(aIdx, bIdx)
        const rangeIds = flat.slice(lo, hi + 1).map((t) => t.id)
        setSelectedIds((prev) => {
          const next = new Set(prev)
          rangeIds.forEach((id) => next.add(id))
          return next
        })
        return
      }
    }
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(tc.id)) next.delete(tc.id)
      else next.add(tc.id)
      return next
    })
    setLastClickedId(tc.id)
  }

  const toggleFeature = (featureId: string) => {
    const featureTcIds = allProjectTCs
      .filter((tc) => tc.featureId === featureId)
      .map((tc) => tc.id)
    const allSelected = featureTcIds.every((id) => selectedIds.has(id))
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allSelected) featureTcIds.forEach((id) => next.delete(id))
      else featureTcIds.forEach((id) => next.add(id))
      return next
    })
  }

  const toggleAll = () => {
    const allIds = allProjectTCs.map((tc) => tc.id)
    const allSelected = allIds.every((id) => selectedIds.has(id))
    setSelectedIds(allSelected ? new Set() : new Set(allIds))
  }

  // ── Context menu state ─────────────────────────────────────────────────────
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
      prev?.tcId === tcId ? null : { tcId, featureId, x: rect.right + 6, y: rect.top }
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

  const toggleFeatureCollapse = (fId: string) =>
    setCollapsed((prev) => ({ ...prev, [fId]: !prev[fId] }))

  if (sidebarCollapsed) {
    return (
      <aside className="w-12 shrink-0 bg-vsc-sidebar border-r border-vsc-border flex flex-col h-full overflow-hidden transition-all duration-200">
        <div className="h-12 border-b border-vsc-border flex items-center justify-center">
          <button
            onClick={() => setSidebarCollapsed(false)}
            title="Expand sidebar"
            className="w-8 h-8 flex items-center justify-center rounded-md text-vsc-dim hover:text-vsc-text hover:bg-vsc-hover transition-all"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 7h8M7 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </aside>
    )
  }

  const allTcCount = allProjectTCs.length
  const allSelectedCount = allProjectTCs.filter((tc) => selectedIds.has(tc.id)).length
  const allChecked = allTcCount > 0 && allSelectedCount === allTcCount
  const someChecked = allSelectedCount > 0 && allSelectedCount < allTcCount

  const selectedTcs = allProjectTCs.filter((tc) => selectedIds.has(tc.id))

  return (
    <>
    <aside className="w-56 shrink-0 bg-vsc-sidebar border-r border-vsc-border flex flex-col h-full overflow-hidden transition-all duration-200">
      {/* Logo / Home row */}
      <div className="h-12 border-b border-vsc-border flex items-center px-4 gap-2.5">
        <button
          className="flex items-center gap-2.5 flex-1 min-w-0 group"
          onClick={() => navigate({ type: 'projects' })}
          title="All projects"
        >
          <div className="w-6 h-6 rounded-md bg-vsc-accent/15 border border-vsc-accent/30 flex items-center justify-center shrink-0">
            <span className="text-vsc-accent text-2xs font-bold leading-none">PW</span>
          </div>
          <span className="text-xs font-semibold text-vsc-text truncate group-hover:text-white transition-colors">
            AutoScriptor
          </span>
        </button>
        <button
          onClick={() => setSidebarCollapsed(true)}
          title="Collapse sidebar"
          className="w-6 h-6 flex items-center justify-center rounded text-vsc-dim hover:text-vsc-text hover:bg-vsc-hover transition-all shrink-0"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M9 6H1M5 2L1 6l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {/* Main nav */}
      {!project ? (
        <div className="flex-1 overflow-y-auto p-3">
          <p className="text-2xs text-vsc-dim font-semibold uppercase tracking-widest mb-2 px-2 pt-1">
            Projects
          </p>
          {state.projects.length === 0 ? (
            <p className="text-xs text-vsc-dim px-2 py-2">No projects yet</p>
          ) : (
            state.projects.map((p) => (
              <button
                key={p.id}
                className="w-full text-left px-2.5 py-2 text-sm text-vsc-muted hover:text-vsc-text hover:bg-vsc-hover transition-all rounded-md"
                onClick={() => navigate({ type: 'project-dashboard', projectId: p.id })}
              >
                {p.name}
              </button>
            ))
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {/* Project info */}
          <div className="px-4 py-3 border-b border-vsc-border">
            <button
              className="text-sm font-semibold text-vsc-text hover:text-white transition-colors truncate w-full text-left leading-tight"
              onClick={() => navigate({ type: 'project-dashboard', projectId: project.id })}
            >
              {project.name}
            </button>
            <div className="flex gap-1.5 mt-2 flex-wrap">
              <span className="text-2xs text-vsc-dim bg-vsc-active border border-vsc-border px-2 py-0.5 rounded-full font-medium">
                {project.language === 'typescript' ? 'TS' : 'JS'}
              </span>
              <span className="text-2xs text-vsc-dim bg-vsc-active border border-vsc-border px-2 py-0.5 rounded-full font-medium">
                {project.browser}
              </span>
              {activeEnv && activeEnvHex && (
                <span
                  className="text-2xs px-2 py-0.5 rounded-full border font-semibold flex items-center gap-1"
                  style={{
                    color: activeEnvHex,
                    borderColor: `${activeEnvHex}50`,
                    backgroundColor: `${activeEnvHex}15`,
                  }}
                >
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: activeEnvHex }} />
                  {activeEnv.name}
                </span>
              )}
            </div>
          </div>

          {/* Feature tree */}
          <div className="p-2">
            {/* Selection mode header */}
            {features.length > 0 && (
              <div className="flex items-center gap-1.5 mb-1 px-1">
                {selectionMode && (
                  <Checkbox
                    checked={allChecked}
                    indeterminate={someChecked}
                    onChange={toggleAll}
                  />
                )}
                <button
                  onClick={() => {
                    if (selectionMode) exitSelectionMode()
                    else setSelectionMode(true)
                  }}
                  title={selectionMode ? 'Exit selection mode (Esc)' : 'Enter selection mode'}
                  className={`flex items-center gap-1.5 text-[10px] font-medium rounded px-1.5 py-0.5 transition-all ml-auto ${
                    selectionMode
                      ? 'text-vsc-accent bg-vsc-accent/10 border border-vsc-accent/30'
                      : 'text-vsc-dim hover:text-vsc-muted hover:bg-vsc-hover border border-transparent'
                  }`}
                >
                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                    <rect x="1" y="1" width="4" height="4" rx="0.8" stroke="currentColor" strokeWidth="1.2"/>
                    <rect x="6" y="1" width="4" height="4" rx="0.8" stroke="currentColor" strokeWidth="1.2"/>
                    <rect x="1" y="6" width="4" height="4" rx="0.8" stroke="currentColor" strokeWidth="1.2"/>
                    <path d="M6.5 8.5l1.5 1.5L10 7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  {selectionMode && selectedIds.size > 0
                    ? <span className="text-vsc-accent">{selectedIds.size}</span>
                    : 'Select'}
                </button>
              </div>
            )}

            {features.length === 0 ? (
              <p className="text-xs text-vsc-dim px-2.5 py-3">No features yet</p>
            ) : (
              features.map((feature) => {
                const tcs = allProjectTCs.filter((tc) => tc.featureId === feature.id)
                const isOpen = !collapsed[feature.id]
                const isActiveFeature =
                  currentView.type === 'feature' && currentView.featureId === feature.id

                // Feature checkbox state
                const featureTcIds = tcs.map((tc) => tc.id)
                const featureSelectedCount = featureTcIds.filter((id) => selectedIds.has(id)).length
                const featureAllChecked = featureTcIds.length > 0 && featureSelectedCount === featureTcIds.length
                const featureSomeChecked = featureSelectedCount > 0 && featureSelectedCount < featureTcIds.length

                return (
                  <div key={feature.id} className="mb-0.5">
                    <div className="flex items-center gap-0.5 group/feature">
                      {selectionMode ? (
                        <Checkbox
                          checked={featureAllChecked}
                          indeterminate={featureSomeChecked}
                          onChange={() => toggleFeature(feature.id)}
                          className="ml-0.5 mr-0.5"
                        />
                      ) : (
                        <button
                          className="w-5 h-6 flex items-center justify-center text-vsc-dim hover:text-vsc-muted shrink-0 transition-colors"
                          onClick={() => toggleFeatureCollapse(feature.id)}
                        >
                          <svg
                            width="8" height="8" viewBox="0 0 8 8" fill="none"
                            className={`transition-transform duration-150 ${isOpen ? 'rotate-90' : ''}`}
                          >
                            <path d="M2 1l4 3-4 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </button>
                      )}
                      <button
                        className={`flex-1 text-left text-xs py-1 px-2 rounded-md truncate transition-all border-l-2 ${
                          isActiveFeature
                            ? 'text-vsc-accent border-l-vsc-accent bg-vsc-accent-light font-semibold'
                            : 'text-vsc-text border-l-transparent hover:bg-vsc-hover font-medium'
                        }`}
                        onClick={() => {
                          if (selectionMode) { toggleFeature(feature.id); return }
                          navigate({ type: 'feature', projectId: project.id, featureId: feature.id })
                        }}
                      >
                        {feature.name}
                      </button>
                    </div>

                    {isOpen && (
                      <div className="ml-5 pl-3 border-l border-vsc-border/50">
                        {tcs.map((tc) => {
                          const isActiveTc =
                            currentView.type === 'test-case' && currentView.testCaseId === tc.id
                          const isMenuOpen = tcMenu?.tcId === tc.id
                          const isSelected = selectedIds.has(tc.id)
                          const deps = tc.dependencies ?? []
                          const depNames = deps.map((depId) => {
                            const depTc = state.testCases.find((t) => t.id === depId)
                            return depTc?.name ?? depId
                          })

                          return (
                            <div
                              key={tc.id}
                              className={`flex items-center group/tc rounded-md transition-all border-l-2 ${
                                isSelected && selectionMode
                                  ? 'border-l-vsc-accent/60 bg-vsc-accent/8'
                                  : isActiveTc
                                  ? 'border-l-vsc-accent bg-vsc-accent-light'
                                  : 'border-l-transparent hover:bg-vsc-hover'
                              }`}
                            >
                              {selectionMode && (
                                <Checkbox
                                  checked={isSelected}
                                  onChange={(e) => toggleTc(tc, e.nativeEvent instanceof MouseEvent && e.nativeEvent.shiftKey)}
                                  className="ml-0.5 mr-0.5"
                                />
                              )}

                              <button
                                className={`flex-1 text-left text-xs py-1 px-1.5 truncate transition-colors ${
                                  tc.disabled
                                    ? 'line-through opacity-40'
                                    : isActiveTc
                                    ? 'text-vsc-accent font-medium'
                                    : 'text-vsc-muted group-hover/tc:text-vsc-text'
                                }`}
                                onClick={(e) => {
                                  if (selectionMode) {
                                    toggleTc(tc, e.shiftKey)
                                    return
                                  }
                                  navigate({
                                    type: 'test-case',
                                    projectId: project.id,
                                    featureId: feature.id,
                                    testCaseId: tc.id,
                                  })
                                }}
                              >
                                {tc.name}
                              </button>

                              {tc.disabled && (
                                <span className="text-[9px] text-yellow-500/60 font-medium shrink-0 px-1">off</span>
                              )}

                              {deps.length > 0 && !selectionMode && (
                                <span
                                  title={`Depends on: ${depNames.join(', ')}`}
                                  className="shrink-0 w-4 h-4 flex items-center justify-center text-vsc-accent/60 opacity-70 group-hover/tc:opacity-100 transition-opacity"
                                >
                                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                    <path d="M2 5h5M5 2l3 3-3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                </span>
                              )}

                              {!selectionMode && (
                                <button
                                  onClick={(e) => handleDotMenu(e, tc.id, feature.id)}
                                  title="More actions"
                                  className={`shrink-0 w-5 h-5 flex items-center justify-center rounded text-[11px] leading-none transition-colors ${
                                    isMenuOpen
                                      ? 'text-vsc-accent opacity-100'
                                      : 'text-vsc-dim opacity-0 group-hover/tc:opacity-100 hover:text-vsc-accent'
                                  }`}
                                >
                                  ⋯
                                </button>
                              )}
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

      {/* TC context menu */}
      {tcMenu && (
        <div
          ref={tcMenuRef}
          className="fixed z-50 bg-vsc-panel border border-vsc-border rounded-lg shadow-xl shadow-black/50 py-1 min-w-[160px] animate-popover-in"
          style={{ top: tcMenu.y, left: tcMenu.x }}
        >
          <button
            className="w-full text-left px-4 py-2 text-sm text-vsc-muted hover:text-vsc-text hover:bg-vsc-hover transition-colors"
            onClick={handleDuplicateHere}
          >
            Duplicate here
          </button>
          <button
            className="w-full text-left px-4 py-2 text-sm text-vsc-muted hover:text-vsc-accent hover:bg-vsc-hover transition-colors"
            onClick={() => { setShowDupTo(true); setTcMenu(null) }}
          >
            Duplicate to…
          </button>
          <div className="my-1 border-t border-vsc-border/60" />
          <button
            className="w-full text-left px-4 py-2 text-sm text-vsc-danger hover:bg-vsc-danger-light transition-colors"
            onClick={handleDelete}
          >
            Delete
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
        <div className="border-t border-vsc-border p-2 space-y-0.5">
          <button
            className={`w-full text-left text-xs px-3 py-2 rounded-md transition-all flex items-center gap-2.5 font-medium ${
              currentView.type === 'utils'
                ? 'text-vsc-accent bg-vsc-accent-light'
                : 'text-vsc-muted hover:text-vsc-text hover:bg-vsc-hover'
            }`}
            onClick={() => navigate({ type: 'utils', projectId: project.id })}
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" className="shrink-0">
              <rect x="1" y="1" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/>
              <rect x="7" y="1" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/>
              <rect x="1" y="7" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M9.5 7.5v4M7.5 9.5h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Utils & Parameters
            {activeEnvHex && currentView.type !== 'utils' && (
              <span className="ml-auto w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: activeEnvHex }} />
            )}
          </button>
          <button
            className={`w-full text-left text-xs px-3 py-2 rounded-md transition-all flex items-center gap-2.5 font-medium ${
              currentView.type === 'project-settings'
                ? 'text-vsc-accent bg-vsc-accent-light'
                : 'text-vsc-muted hover:text-vsc-text hover:bg-vsc-hover'
            }`}
            onClick={() => navigate({ type: 'project-settings', projectId: project.id })}
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" className="shrink-0">
              <circle cx="6.5" cy="6.5" r="1.5" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M6.5 1v1.5M6.5 10.5V12M1 6.5h1.5M10.5 6.5H12M2.4 2.4l1.1 1.1M9.5 9.5l1.1 1.1M2.4 10.6l1.1-1.1M9.5 3.5l1.1-1.1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Settings
          </button>
          <Btn
            variant="ghost"
            size="sm"
            className="w-full justify-start text-vsc-dim"
            onClick={() => navigate({ type: 'projects' })}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="shrink-0">
              <path d="M8 6H1M4 2L0 6l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            All projects
          </Btn>
        </div>
      )}
    </aside>

    {/* Bulk action bar — rendered outside the aside so it spans full width */}
    {selectionMode && selectedIds.size > 0 && project && (
      <BulkTcBar
        selectedTcs={selectedTcs}
        features={features}
        allTestCases={allProjectTCs}
        project={project}
        onClear={clearSelection}
        onExit={exitSelectionMode}
        triggerDelete={triggerDelete}
        triggerDuplicate={triggerDuplicate}
        onTriggerHandled={() => { setTriggerDelete(false); setTriggerDuplicate(false) }}
      />
    )}
    </>
  )
}
