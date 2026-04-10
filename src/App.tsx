import { useEffect } from 'react'
import { useApp } from './store/AppContext'
import { Sidebar } from './components/layout/Sidebar'
import { TopBar } from './components/layout/TopBar'
import { ProjectsList } from './views/ProjectsList'
import { ProjectDashboard } from './views/ProjectDashboard'
import { ProjectSettings } from './views/ProjectSettings'
import { FeatureView } from './views/FeatureView'
import { TestCaseEditor } from './views/TestCaseEditor'
import { UtilsView } from './views/UtilsView'
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
  }
}

export default function App() {
  const { state } = useApp()

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

  const hasProject = state.currentView.type !== 'projects'

  // Compute active env color for the main content border
  const activeProjectId = state.currentView.type !== 'projects' ? state.currentView.projectId : null
  const activeProject = activeProjectId ? state.projects.find((p) => p.id === activeProjectId) : null
  const activeEnv = activeProject?.environments?.find((e) => e.id === activeProject?.activeEnvironmentId) ?? null
  const envHex = activeEnv ? getEnvColor(activeEnv) : null

  return (
    <div className="h-screen flex flex-col overflow-hidden dark">
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        {hasProject && <Sidebar />}
        {!hasProject && state.currentView.type === 'projects' && <Sidebar />}
        <main
          className="flex-1 overflow-y-auto scrollbar-thin texture-grid"
          style={envHex ? { borderTop: `2px solid ${envHex}60` } : undefined}
        >
          <MainContent />
        </main>
      </div>
    </div>
  )
}
