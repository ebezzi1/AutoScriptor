import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import { ThemeProvider } from './store/ThemeContext'
import { AppProvider } from './store/AppContext'
import { AgentProvider } from './store/AgentContext'
import { ToastProvider } from './components/common/Toast'
import { AuthProvider, useAuth } from './components/auth/AuthProvider'
import { LoginPage } from './components/auth/LoginPage'
import { TeamSelectorModal } from './components/auth/TeamSelectorModal'
import { TeamOnboarding } from './views/TeamOnboarding'
import { InviteAccept } from './views/InviteAccept'
import App from './App'

function Spinner() {
  return (
    <div className="min-h-screen bg-vsc-bg flex flex-col items-center justify-center gap-3">
      <svg className="animate-spin h-6 w-6 text-vsc-accent" viewBox="0 0 24 24" fill="none" aria-label="Loading">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
      </svg>
      <p className="text-vsc-muted text-sm font-mono">Loading workspace…</p>
    </div>
  )
}

function AuthGate() {
  const { user, loading, teamState } = useAuth()

  // 1. Auth is still loading (initial session check)
  if (loading) return <Spinner />

  // 2. No user — show login
  if (!user) return <LoginPage />

  // 3. Team resolution is in progress
  if (teamState.status === 'loading') return <Spinner />

  // 4. User has no teams — show create/join onboarding
  if (teamState.status === 'none') {
    return (
      <ToastProvider>
        <TeamOnboarding />
      </ToastProvider>
    )
  }

  // 5. User has teams but hasn't picked one yet — show BLOCKING selector
  //    This fires for ALL users with teams (1 or many) unless "don't show again" was set.
  if (teamState.status === 'pending') {
    return <TeamSelectorModal teams={teamState.teams} />
  }

  // 6. Team is resolved (status === 'ready') — render the full app
  return (
    <ToastProvider>
      <AgentProvider>
        <AppProvider>
          <App />
        </AppProvider>
      </AgentProvider>
    </ToastProvider>
  )
}

// Check if we are on an invite path
const invitePathMatch = window.location.pathname.match(/^\/invite\/([^/?#]+)/)
const inviteToken = invitePathMatch ? invitePathMatch[1] : null

function InviteGate() {
  if (!inviteToken) return null
  return (
    <ToastProvider>
      <InviteAccept token={inviteToken} />
    </ToastProvider>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <AuthProvider>
        {inviteToken ? <InviteGate /> : <AuthGate />}
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>,
)
