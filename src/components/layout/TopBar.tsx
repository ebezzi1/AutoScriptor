import { useState } from 'react'
import { useApp } from '../../store/AppContext'
import { useToast } from '../common/Toast'
import { Btn } from '../common/Btn'
import { generateAndDownload } from '../../lib/zipBuilder'
import { getEnvColor } from '../../types'

export function TopBar() {
  const { state, dispatch, navigate } = useApp()
  const { toast } = useToast()
  const { currentView } = state
  const [generating, setGenerating] = useState(false)

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
          navigate({
            type: 'feature',
            projectId: project!.id,
            featureId: f.id,
          }),
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

      // Apply active environment base URL override
      const effectiveProject = activeEnv?.baseUrl ? { ...project, baseUrl: activeEnv.baseUrl } : project

      // Compute effective vars: Base + env-specific (env overrides Base by key) + legacy variableOverrides
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
        // Apply legacy variableOverrides from EnvProfile
        effectiveVars = merged.map((v) =>
          activeEnv.variableOverrides[v.key] !== undefined
            ? { ...v, value: activeEnv.variableOverrides[v.key] }
            : v
        )
      } else {
        effectiveVars = allVars.filter((v) => !v.environmentId)
      }

      // Effective utils: Base + env-specific
      const effectiveUtils = activeEnv
        ? allUtils.filter((u) => !u.environmentId || u.environmentId === activeEnv.id)
        : allUtils.filter((u) => !u.environmentId)

      // Effective fixtures: Base + env-specific
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
    <header className="h-9 shrink-0 bg-vsc-sidebar border-b border-vsc-border flex items-center px-4 gap-3">
      {/* Amber accent mark */}
      <div className="w-1.5 h-1.5 bg-vsc-accent rounded-sm shrink-0" />

      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 flex-1 overflow-hidden">
        {breadcrumb.length === 0 && (
          <span className="text-[10px] text-vsc-dim uppercase tracking-widest">
            playwright test generator
          </span>
        )}
        {breadcrumb.map((crumb, i) => (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-vsc-dim text-[10px]">/</span>}
            {crumb.onClick ? (
              <button
                className="text-[10px] text-vsc-muted hover:text-vsc-accent transition-colors truncate uppercase tracking-wide"
                onClick={crumb.onClick}
              >
                {crumb.label}
              </button>
            ) : (
              <span className="text-[10px] text-vsc-text truncate uppercase tracking-wide">{crumb.label}</span>
            )}
          </span>
        ))}
      </div>

      {project && (
        <div className="flex items-center gap-2 shrink-0">
          {/* Environment switcher — styled pill with env color */}
          {(project.environments ?? []).length > 0 && (
            <div className="relative">
              {activeEnv && envHex && (
                <span
                  className="absolute left-2 top-1/2 -translate-y-1/2 text-[7px] pointer-events-none leading-none"
                  style={{ color: envHex }}
                >
                  ●
                </span>
              )}
              <select
                value={project.activeEnvironmentId ?? ''}
                onChange={(e) =>
                  dispatch({ type: 'SET_ACTIVE_ENV', projectId: project.id, envId: e.target.value || null })
                }
                className="appearance-none rounded-sm text-[9px] uppercase tracking-wider outline-none cursor-pointer transition-all border"
                style={
                  activeEnv && envHex
                    ? {
                        paddingLeft: '18px',
                        paddingRight: '8px',
                        paddingTop: '2px',
                        paddingBottom: '2px',
                        color: envHex,
                        borderColor: `${envHex}70`,
                        backgroundColor: `${envHex}18`,
                      }
                    : {
                        paddingLeft: '8px',
                        paddingRight: '8px',
                        paddingTop: '2px',
                        paddingBottom: '2px',
                        color: 'var(--color-vsc-muted, #888)',
                        borderColor: 'var(--color-vsc-border, #333)',
                        backgroundColor: 'var(--color-vsc-bg, #1e1e1e)',
                      }
                }
                title="Active environment"
              >
                <option value="">— no env —</option>
                {(project.environments ?? []).map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {generating && (
            <span className="text-[10px] text-vsc-muted tracking-wide uppercase animate-pulse">
              generating...
            </span>
          )}
          <Btn
            variant="primary"
            size="sm"
            onClick={handleGenerate}
            disabled={generating}
          >
            {generating ? '...' : '↓ Export ZIP'}
          </Btn>
        </div>
      )}
    </header>
  )
}
