import { useState, useRef, useEffect } from 'react'
import { useApp } from '../../store/AppContext'
import { useToast } from '../common/Toast'
import { Btn } from '../common/Btn'
import { generateAndDownload } from '../../lib/zipBuilder'
import { getEnvColor } from '../../types'
import { MatrixPreviewModal } from '../MatrixPreviewModal'
import { TestPlanModal } from '../TestPlanModal'

export function TopBar() {
  const { state, dispatch, navigate } = useApp()
  const { toast } = useToast()
  const { currentView } = state
  const [generating, setGenerating] = useState(false)
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const [showMatrix, setShowMatrix] = useState(false)
  const [showTestPlan, setShowTestPlan] = useState(false)
  const exportMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!exportMenuOpen) return undefined
    const handle = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setExportMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [exportMenuOpen])

  const activeProjectId =
    currentView.type !== 'projects' ? currentView.projectId : null
  const project = activeProjectId
    ? state.projects.find((p) => p.id === activeProjectId)
    : null

  const breadcrumb: { label: string; onClick?: () => void }[] = []

  if (project) {
    breadcrumb.push({
      label: project.name,
      onClick: () => navigate({ type: 'project-dashboard', projectId: project.id }),
    })
  }

  if (currentView.type === 'feature') {
    const f = state.features.find((f) => f.id === currentView.featureId)
    if (f) breadcrumb.push({ label: f.name })
  }

  if (currentView.type === 'test-case') {
    const f = state.features.find((f) => f.id === currentView.featureId)
    const tc = state.testCases.find((tc) => tc.id === currentView.testCaseId)
    if (f)
      breadcrumb.push({
        label: f.name,
        onClick: () =>
          navigate({ type: 'feature', projectId: project!.id, featureId: f.id }),
      })
    if (tc) breadcrumb.push({ label: tc.name })
  }

  if (currentView.type === 'utils') breadcrumb.push({ label: 'Utils & Parameters' })
  if (currentView.type === 'project-settings') breadcrumb.push({ label: 'Settings' })

  const activeEnv = project
    ? (project.environments ?? []).find((e) => e.id === project.activeEnvironmentId) ?? null
    : null
  const envHex = activeEnv ? getEnvColor(activeEnv) : null

  const handleGenerate = async () => {
    if (!project) return
    setGenerating(true)
    try {
      const features = state.features.filter((f) => f.projectId === project.id)
      const testCases = state.testCases.filter((tc) => tc.projectId === project.id)
      const allVars = state.variables.filter((v) => v.projectId === project.id)
      const allUtils = state.utils.filter((u) => u.projectId === project.id)
      const allFixtures = state.fixtures.filter((fx) => fx.projectId === project.id)

      const effectiveProject = activeEnv?.baseUrl ? { ...project, baseUrl: activeEnv.baseUrl } : project

      let effectiveVars: typeof allVars
      if (activeEnv) {
        const baseVars = allVars.filter((v) => !v.environmentId)
        const envVars = allVars.filter((v) => v.environmentId === activeEnv.id)
        const merged = [...baseVars]
        for (const ev of envVars) {
          const idx = merged.findIndex((v) => v.key === ev.key)
          if (idx >= 0) merged[idx] = ev
          else merged.push(ev)
        }
        effectiveVars = merged.map((v) =>
          activeEnv.variableOverrides[v.key] !== undefined
            ? { ...v, value: activeEnv.variableOverrides[v.key] }
            : v
        )
      } else {
        effectiveVars = allVars.filter((v) => !v.environmentId)
      }

      const effectiveUtils = activeEnv
        ? allUtils.filter((u) => !u.environmentId || u.environmentId === activeEnv.id)
        : allUtils.filter((u) => !u.environmentId)

      const effectiveFixtures = activeEnv
        ? allFixtures.filter((fx) => !fx.environmentId || fx.environmentId === activeEnv.id)
        : allFixtures.filter((fx) => !fx.environmentId)

      await generateAndDownload({
        project: effectiveProject,
        features,
        testCases,
        variables: effectiveVars,
        utils: effectiveUtils,
        fixtures: effectiveFixtures,
      })
      toast('Test suite generated and downloaded!')
    } catch (e) {
      toast(`Generation failed: ${e instanceof Error ? e.message : String(e)}`, 'error')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <>
    <header className="h-12 shrink-0 bg-vsc-sidebar border-b border-vsc-border flex items-center px-5 gap-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 flex-1 min-w-0 overflow-hidden">
        {breadcrumb.length === 0 ? (
          <span className="text-xs text-vsc-dim font-medium tracking-wide">
            Playwright Generator
          </span>
        ) : (
          breadcrumb.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1.5 min-w-0">
              {i > 0 && (
                <svg width="12" height="12" viewBox="0 0 12 12" className="text-vsc-dim shrink-0">
                  <path d="M4.5 2L8 6l-3.5 4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
              {crumb.onClick ? (
                <button
                  className="text-sm text-vsc-muted hover:text-vsc-text transition-colors truncate font-medium"
                  onClick={crumb.onClick}
                >
                  {crumb.label}
                </button>
              ) : (
                <span className="text-sm text-vsc-text font-semibold truncate">{crumb.label}</span>
              )}
            </span>
          ))
        )}
      </div>

      {project && (
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Environment pill */}
          {(project.environments ?? []).length > 0 && (
            <div className="relative">
              <select
                value={project.activeEnvironmentId ?? ''}
                onChange={(e) =>
                  dispatch({ type: 'SET_ACTIVE_ENV', projectId: project.id, envId: e.target.value || null })
                }
                className="appearance-none border rounded-full text-xs font-medium outline-none cursor-pointer transition-all pl-4 pr-3 py-1"
                style={
                  activeEnv && envHex
                    ? {
                        color: envHex,
                        borderColor: `${envHex}50`,
                        backgroundColor: `${envHex}12`,
                        paddingLeft: '22px',
                      }
                    : {
                        color: 'var(--color-vsc-muted, #8888A0)',
                        borderColor: '#28283A',
                        backgroundColor: '#1A1A22',
                      }
                }
                title="Active environment"
              >
                <option value="">No environment</option>
                {(project.environments ?? []).map((e) => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
              {activeEnv && envHex && (
                <span
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full pointer-events-none"
                  style={{ backgroundColor: envHex }}
                />
              )}
            </div>
          )}

          {generating && (
            <span className="text-xs text-vsc-muted animate-pulse font-medium">
              Generating…
            </span>
          )}

          {/* Split export button */}
          <div ref={exportMenuRef} className="relative flex">
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="inline-flex items-center gap-1.5 bg-vsc-accent hover:bg-vsc-accent-hover disabled:opacity-50 text-white transition-all duration-150 rounded-l-md px-3 py-1.5 text-sm font-medium border-r border-white/20"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="shrink-0">
                <path d="M6 1v7.5M2.5 6L6 9.5 9.5 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M1 11h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              {generating ? 'Generating…' : 'Export ZIP'}
            </button>
            <button
              onClick={() => setExportMenuOpen((v) => !v)}
              className="inline-flex items-center bg-vsc-accent hover:bg-vsc-accent-hover text-white transition-all duration-150 rounded-r-md px-2 py-1.5 text-sm"
              aria-label="More export options"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M2 3.5L5 7l3-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            {exportMenuOpen && (
              <div className="absolute top-full right-0 mt-1.5 z-30 bg-vsc-panel border border-vsc-border rounded-lg shadow-xl shadow-black/40 py-1 min-w-[180px] animate-popover-in">
                <button
                  className="w-full text-left px-4 py-2 text-sm text-vsc-muted hover:text-vsc-text hover:bg-vsc-hover transition-colors flex items-center gap-2.5"
                  onClick={() => { handleGenerate(); setExportMenuOpen(false) }}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M6 1v7.5M2.5 6L6 9.5 9.5 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M1 11h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  Export ZIP
                </button>
                <button
                  className="w-full text-left px-4 py-2 text-sm text-vsc-muted hover:text-vsc-accent hover:bg-vsc-hover transition-colors flex items-center gap-2.5"
                  onClick={() => { setShowMatrix(true); setExportMenuOpen(false) }}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <rect x="1" y="1" width="10" height="10" rx="1" stroke="currentColor" strokeWidth="1.2"/>
                    <path d="M1 4h10M1 7h10M4 4v7M8 4v7" stroke="currentColor" strokeWidth="1.2"/>
                  </svg>
                  Export Matrix…
                </button>
                <div className="h-px bg-vsc-border/60 my-1" />
                <button
                  className="w-full text-left px-4 py-2 text-sm text-vsc-muted hover:text-vsc-accent hover:bg-vsc-hover transition-colors flex items-center gap-2.5"
                  onClick={() => { setShowTestPlan(true); setExportMenuOpen(false) }}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2.5 1h5.5L10 3.5V11h-7.5V1z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
                    <path d="M7 1v3h3" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
                    <path d="M4 5.5h4M4 7.5h4M4 9.5h2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                  </svg>
                  Generate Test Plan…
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </header>

    {showMatrix && project && (
      <MatrixPreviewModal
        project={project}
        features={state.features.filter((f) => f.projectId === project.id)}
        testCases={state.testCases.filter((tc) => tc.projectId === project.id)}
        fixtures={state.fixtures.filter((fx) => fx.projectId === project.id)}
        onClose={() => setShowMatrix(false)}
      />
    )}

    {showTestPlan && project && (
      <TestPlanModal
        project={project}
        features={state.features.filter((f) => f.projectId === project.id)}
        testCases={state.testCases.filter((tc) => tc.projectId === project.id)}
        variables={state.variables.filter((v) => v.projectId === project.id)}
        utils={state.utils.filter((u) => u.projectId === project.id)}
        fixtures={state.fixtures.filter((fx) => fx.projectId === project.id)}
        onClose={() => setShowTestPlan(false)}
      />
    )}
  </>
  )
}
