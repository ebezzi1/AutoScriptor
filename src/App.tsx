import { useEffect, useRef, useCallback } from 'react'
import { useApp } from './store/AppContext'
import { useAgent } from './store/AgentContext'
import { Sidebar } from './components/layout/Sidebar'
import { TopBar } from './components/layout/TopBar'
import { TestRunnerPanel } from './components/TestRunnerPanel'
import { SetupWizard } from './components/SetupWizard'
import { ProjectsList } from './views/ProjectsList'
import { ProjectDashboard } from './views/ProjectDashboard'
import { ProjectSettings } from './views/ProjectSettings'
import { FeatureView } from './views/FeatureView'
import { TestCaseEditor } from './views/TestCaseEditor'
import { UtilsView } from './views/UtilsView'
import { TeamSettings } from './views/TeamSettings'
import { TestResultsView } from './views/TestResultsView'
import { getEnvColor } from './types'

function MainContent() {
  const { state } = useApp()
  const { currentView } = state

  switch (currentView.type) {
    case 'projects':
      return <ProjectsList />
    case 'project-dashboard':
      return <ProjectDashboard projectId={currentView.projectId} />
    case 'project-settings':
      return <ProjectSettings projectId={currentView.projectId} />
    case 'feature':
      return (
        <FeatureView
          projectId={currentView.projectId}
          featureId={currentView.featureId}
        />
      )
    case 'test-case':
      return (
        <TestCaseEditor
          projectId={currentView.projectId}
          featureId={currentView.featureId}
          testCaseId={currentView.testCaseId}
        />
      )
    case 'utils':
      return <UtilsView projectId={currentView.projectId} />
    case 'test-results':
      return <TestResultsView projectId={currentView.projectId} initialRunId={currentView.runId} />
    case 'team-settings':
      return <TeamSettings />
  }
}

export default function App() {
  const { state, dispatch } = useApp()
  const {
    showSetupWizard, setShowSetupWizard, showRunner,
    switchProject, activeProjectId, setOnSaveProjectAgent,
  } = useAgent()

  // ── Bridge: persist agent settings onto the project record ────────────────
  const saveProjectAgent = useCallback(
    (projectId: string, url: string, token: string, setupComplete: boolean) => {
      const project = state.projects.find((p) => p.id === projectId)
      if (!project) return
      dispatch({
        type: 'UPDATE_PROJECT',
        project: {
          ...project,
          agentUrl: url,
          agentToken: token,
          agentSetupComplete: setupComplete,
          updatedAt: new Date().toISOString(),
        },
      })
    },
    [state.projects, dispatch]
  )

  // Register the save callback once (and whenever it changes)
  useEffect(() => {
    setOnSaveProjectAgent(saveProjectAgent)
  }, [saveProjectAgent, setOnSaveProjectAgent])

  // ── Bridge: switch agent when active project changes ──────────────────────
  const currentProjectId =
    state.currentView.type !== 'projects' && state.currentView.type !== 'team-settings'
      ? (state.currentView as { projectId: string }).projectId
      : null

  const prevProjectIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (currentProjectId === prevProjectIdRef.current) return
    prevProjectIdRef.current = currentProjectId

    if (!currentProjectId) {
      if (activeProjectId) switchProject(null)
      return
    }

    const project = state.projects.find((p) => p.id === currentProjectId)
    if (project) {
      switchProject(project)
    }
  }, [currentProjectId, state.projects, activeProjectId, switchProject])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Compute active env color for the main content accent
  const activeProject = currentProjectId ? state.projects.find((p) => p.id === currentProjectId) : null
  const activeEnv = activeProject?.environments?.find((e) => e.id === activeProject?.activeEnvironmentId) ?? null
  const envHex = activeEnv ? getEnvColor(activeEnv) : null

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-vsc-bg">
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main
          className="flex-1 overflow-y-auto scrollbar-thin bg-vsc-bg"
          style={{
            ...(envHex ? { borderTop: `2px solid ${envHex}50` } : {}),
            ...(showRunner ? { paddingBottom: '300px' } : {}),
          }}
        >
          <MainContent />
        </main>
      </div>
      <TestRunnerPanel />
      {showSetupWizard && (
        <SetupWizard onClose={() => setShowSetupWizard(false)} />
      )}
    </div>
  )
}
