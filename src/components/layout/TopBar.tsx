import { useState, useRef, useEffect } from 'react'
import { useApp } from '../../store/AppContext'
import { useAuth } from '../auth/AuthProvider'
import { usePermissions } from '../../hooks/usePermissions'
import { useToast } from '../common/Toast'
import { useTheme, type Theme } from '../../store/ThemeContext'
import { useAgent } from '../../store/AgentContext'
import { Btn } from '../common/Btn'
import { generateAndDownload } from '../../lib/zipBuilder'
import { getEnvColor } from '../../types'
import { MatrixPreviewModal } from '../MatrixPreviewModal'
import { TestPlanModal } from '../TestPlanModal'
import { SyncStatusIndicator } from '../sync/SyncStatusIndicator'

function ThemeToggle() {
  const { theme, setTheme } = useTheme()
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

  const options: { value: Theme; label: string; icon: React.ReactNode }[] = [
    {
      value: 'light',
      label: 'Light',
      icon: (
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.4"/>
          <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3.05 3.05l1.06 1.06M11.88 11.88l1.07 1.07M12.95 3.05l-1.06 1.06M4.12 11.88l-1.07 1.07" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        </svg>
      ),
    },
    {
      value: 'dark',
      label: 'Dark',
      icon: (
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
          <path d="M13.5 10.5A6 6 0 0 1 5.5 2.5a6 6 0 1 0 8 8z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
        </svg>
      ),
    },
    {
      value: 'system',
      label: 'System',
      icon: (
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
          <rect x="1.5" y="2.5" width="13" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
          <path d="M5.5 13.5h5M8 11.5v2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        </svg>
      ),
    },
  ]

  const current = options.find((o) => o.value === theme) ?? options[0]

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-7 h-7 flex items-center justify-center rounded-md text-vsc-muted hover:text-vsc-text hover:bg-vsc-hover transition-colors"
        title={`Theme: ${current.label}`}
      >
        {current.icon}
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-1.5 z-50 bg-vsc-panel border border-vsc-border rounded-lg shadow-xl py-1 min-w-[120px] animate-popover-in">
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { setTheme(opt.value); setOpen(false) }}
              className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-xs transition-colors ${
                theme === opt.value
                  ? 'text-vsc-accent bg-vsc-accent-light font-medium'
                  : 'text-vsc-muted hover:text-vsc-text hover:bg-vsc-hover'
              }`}
            >
              {opt.icon}
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function UserMenu() {
  const { user, teamName, signOut } = useAuth()
  const { navigate } = useApp()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [savingName, setSavingName] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return undefined
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  const initial = user?.email?.[0]?.toUpperCase() ?? '?'

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault()
    if (!user || nameInput.trim().length < 2) return
    setSavingName(true)
    try {
      const { updateDisplayName } = await import('../../lib/database/teamManagement')
      await updateDisplayName(user.id, nameInput.trim())
      toast('Display name updated')
      setEditingName(false)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to update name', 'error')
    } finally {
      setSavingName(false)
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-7 h-7 rounded-full bg-vsc-accent/20 border border-vsc-accent/30 flex items-center justify-center text-xs font-bold text-vsc-accent hover:bg-vsc-accent/30 transition-colors"
        title={user?.email}
      >
        {initial}
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-1.5 z-50 bg-vsc-panel border border-vsc-border rounded-lg shadow-xl py-1 min-w-[200px] animate-popover-in">
          <div className="px-3 py-2 border-b border-vsc-border/60">
            {editingName ? (
              <form onSubmit={handleSaveName} className="flex gap-1.5 mt-0.5">
                <input
                  autoFocus
                  type="text"
                  minLength={2}
                  required
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="Your name"
                  className="flex-1 min-w-0 px-2 py-1 text-xs rounded bg-vsc-bg border border-vsc-accent/40 text-vsc-text focus:outline-none focus:border-vsc-accent"
                />
                <button
                  type="submit"
                  disabled={savingName || nameInput.trim().length < 2}
                  className="px-2 py-1 text-xs rounded bg-vsc-accent text-white disabled:opacity-50"
                >
                  {savingName ? '…' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingName(false)}
                  className="px-2 py-1 text-xs rounded text-vsc-dim hover:text-vsc-muted hover:bg-vsc-hover"
                >
                  ✕
                </button>
              </form>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-vsc-text truncate">{user?.email}</p>
                  {teamName && <p className="text-[10px] text-vsc-dim truncate mt-0.5">{teamName}</p>}
                </div>
                <button
                  onClick={() => { setNameInput(''); setEditingName(true) }}
                  title="Edit display name"
                  className="shrink-0 text-vsc-dim hover:text-vsc-muted transition-colors"
                >
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                    <path d="M8.5 1.5l2 2L3 11H1V9L8.5 1.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
            )}
          </div>
          <button
            className="w-full text-left px-3 py-2 text-xs text-vsc-muted hover:text-vsc-text hover:bg-vsc-hover transition-colors flex items-center gap-2"
            onClick={() => { navigate({ type: 'team-settings' }); setOpen(false) }}
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" className="shrink-0">
              <circle cx="5" cy="4" r="2" stroke="currentColor" strokeWidth="1.4"/>
              <path d="M1 11c0-2.2 1.8-4 4-4s4 1.8 4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              <circle cx="10" cy="4" r="1.5" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M10 8.5c1.4.3 2.5 1.5 2.5 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
            Team Settings
          </button>
          <div className="h-px bg-vsc-border/60 my-1" />
          <button
            className="w-full text-left px-3 py-2 text-xs text-vsc-danger hover:bg-vsc-danger-light transition-colors flex items-center gap-2"
            onClick={() => { signOut(); setOpen(false) }}
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" className="shrink-0">
              <path d="M5 2H2a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              <path d="M8.5 9l3-2.5L8.5 4M11.5 6.5H5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Sign Out
          </button>
        </div>
      )}
    </div>
  )
}

function AgentStatusIndicator() {
  const { isConnected, agentUrl, agentToken, agentVersion, agentUptime, projectDir, disconnect, setShowSetupWizard, activeProjectId, consecutiveFailures, testConnection } = useAgent()
  const { navigate } = useApp()
  const [open, setOpen] = useState(false)
  const [reconnecting, setReconnecting] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return undefined
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  const host = (() => { try { return new URL(agentUrl).host } catch { return agentUrl } })()

  const formatUptime = (ms: number) => {
    const s = Math.floor(ms / 1000)
    if (s < 60) return `${s}s`
    if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`
    return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`
  }

  const handleReconnect = async () => {
    setReconnecting(true)
    await testConnection()
    setReconnecting(false)
  }

  // Determine dot color: green = connected, amber = configured but unreachable, gray = not configured
  const dotColor = isConnected
    ? 'bg-green-500'
    : agentToken && consecutiveFailures > 0
      ? 'bg-amber-400'
      : 'bg-vsc-border'

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs text-vsc-muted hover:text-vsc-text hover:bg-vsc-hover transition-colors"
      >
        <span className={`w-2 h-2 rounded-full transition-colors shrink-0 ${dotColor}`} />
        <span className="hidden sm:inline">Agent</span>
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-1.5 z-50 bg-vsc-panel border border-vsc-border rounded-lg shadow-xl min-w-[220px] animate-popover-in">
          {isConnected ? (
            <div className="p-3 flex flex-col gap-2.5">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                <span className="text-xs font-medium text-green-400">Connected</span>
              </div>
              <div className="flex flex-col gap-1.5 text-[10px]">
                <div className="flex justify-between">
                  <span className="text-vsc-dim">URL</span>
                  <span className="text-vsc-muted font-mono">{host}</span>
                </div>
                {agentVersion && (
                  <div className="flex justify-between">
                    <span className="text-vsc-dim">Version</span>
                    <span className="text-vsc-muted">v{agentVersion}</span>
                  </div>
                )}
                {agentUptime != null && (
                  <div className="flex justify-between">
                    <span className="text-vsc-dim">Uptime</span>
                    <span className="text-vsc-muted">{formatUptime(agentUptime)}</span>
                  </div>
                )}
                {projectDir && (
                  <div className="flex justify-between gap-3">
                    <span className="text-vsc-dim shrink-0">Directory</span>
                    <span className="text-vsc-muted font-mono truncate text-right" title={projectDir}>
                      {projectDir.split('/').slice(-2).join('/')}
                    </span>
                  </div>
                )}
              </div>
              <div className="h-px bg-vsc-border/50 mt-1" />
              <button
                onClick={() => { disconnect(); setOpen(false) }}
                className="text-[10px] text-vsc-dim hover:text-red-400 transition-colors text-left"
              >
                Disconnect
              </button>
            </div>
          ) : agentToken && consecutiveFailures > 0 ? (
            /* Agent configured but unreachable */
            <div className="p-3 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                <span className="text-xs text-amber-400">Agent not reachable</span>
              </div>
              <p className="text-[10px] text-vsc-dim">Is the agent running at {host}?</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { handleReconnect(); }}
                  disabled={reconnecting}
                  className="text-xs text-vsc-accent hover:text-white transition-colors flex items-center gap-1.5"
                >
                  {reconnecting ? 'Reconnecting…' : 'Reconnect'}
                </button>
                <span className="text-vsc-dim">·</span>
                <button
                  onClick={() => { setShowSetupWizard(true); setOpen(false) }}
                  className="text-xs text-vsc-dim hover:text-vsc-accent transition-colors"
                >
                  Setup Agent
                </button>
              </div>
            </div>
          ) : activeProjectId ? (
            /* Project selected but no agent configured */
            <div className="p-3 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-vsc-border shrink-0" />
                <span className="text-xs text-vsc-muted">No agent configured</span>
              </div>
              <button
                onClick={() => { setShowSetupWizard(true); setOpen(false) }}
                className="text-xs text-vsc-accent hover:text-vsc-accent-hover transition-colors text-left flex items-center gap-1.5"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 2h8v8H2V2z" stroke="currentColor" strokeWidth="1.2"/>
                  <path d="M5 4.5l3 1.5-3 1.5v-3z" fill="currentColor"/>
                </svg>
                Setup Agent
              </button>
              {activeProjectId && (
                <button
                  onClick={() => { navigate({ type: 'project-settings', projectId: activeProjectId }); setOpen(false) }}
                  className="text-[10px] text-vsc-dim hover:text-vsc-muted transition-colors text-left"
                >
                  Configure in Settings
                </button>
              )}
            </div>
          ) : (
            /* No project selected */
            <div className="p-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-vsc-border shrink-0" />
                <span className="text-xs text-vsc-dim">Select a project first</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function TopBar() {
  const { state, dispatch, navigate } = useApp()
  const { isReadOnly } = usePermissions()
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
    (currentView.type !== 'projects' && currentView.type !== 'team-settings')
      ? (currentView as { projectId: string }).projectId
      : null
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
    <header className="h-12 shrink-0 bg-vsc-sidebar border-b border-vsc-border flex items-center px-4 gap-3">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 flex-1 min-w-0 overflow-hidden">
        {breadcrumb.length === 0 ? (
          <span className="text-sm font-semibold text-vsc-text">AutoScriptor</span>
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
                  className="text-sm text-vsc-muted hover:text-vsc-text transition-colors truncate"
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
        {isReadOnly && (
          <span className="text-[10px] font-semibold text-vsc-muted border border-vsc-border rounded-full px-2 py-0.5 ml-2 shrink-0">
            View only
          </span>
        )}
      </div>

      {/* Right-side controls */}
      <div className="flex items-center gap-2 shrink-0">
        {project && (project.environments ?? []).length > 0 && (
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
                      backgroundColor: `${envHex}10`,
                      paddingLeft: '22px',
                    }
                  : {
                      color: 'var(--vsc-muted)',
                      borderColor: 'rgb(var(--vsc-border-rgb))',
                      backgroundColor: 'var(--vsc-hover)',
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
          <span className="text-xs text-vsc-muted animate-pulse">Generating…</span>
        )}

        {project && (
          <div ref={exportMenuRef} className="relative flex">
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="inline-flex items-center gap-1.5 bg-vsc-accent hover:bg-vsc-accent-hover disabled:opacity-50 text-white transition-colors rounded-l-md px-3 py-1.5 text-xs font-medium border-r border-white/20"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="shrink-0">
                <path d="M6 1v7.5M2.5 6L6 9.5 9.5 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M1 11h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              {generating ? 'Generating…' : 'Export ZIP'}
            </button>
            <button
              onClick={() => setExportMenuOpen((v) => !v)}
              className="inline-flex items-center bg-vsc-accent hover:bg-vsc-accent-hover text-white transition-colors rounded-r-md px-2 py-1.5 text-xs"
              aria-label="More export options"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M2 3.5L5 7l3-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            {exportMenuOpen && (
              <div className="absolute top-full right-0 mt-1.5 z-30 bg-vsc-panel border border-vsc-border rounded-lg shadow-xl py-1 min-w-[180px] animate-popover-in">
                <button
                  className="w-full text-left px-3 py-2 text-xs text-vsc-muted hover:text-vsc-text hover:bg-vsc-hover transition-colors flex items-center gap-2.5"
                  onClick={() => { handleGenerate(); setExportMenuOpen(false) }}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M6 1v7.5M2.5 6L6 9.5 9.5 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M1 11h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  Export ZIP
                </button>
                <button
                  className="w-full text-left px-3 py-2 text-xs text-vsc-muted hover:text-vsc-accent hover:bg-vsc-hover transition-colors flex items-center gap-2.5"
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
                  className="w-full text-left px-3 py-2 text-xs text-vsc-muted hover:text-vsc-accent hover:bg-vsc-hover transition-colors flex items-center gap-2.5"
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
        )}

        {project?.localDirectory && activeProjectId && (
          <SyncStatusIndicator projectId={activeProjectId} />
        )}
        <AgentStatusIndicator />
        <ThemeToggle />
        <UserMenu />
      </div>
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
