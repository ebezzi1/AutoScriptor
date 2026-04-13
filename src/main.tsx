import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import { ThemeProvider } from './store/ThemeContext'
import { AppProvider } from './store/AppContext'
import { ToastProvider, useToast } from './components/common/Toast'
import { AuthProvider, useAuth } from './components/auth/AuthProvider'
import { LoginPage } from './components/auth/LoginPage'
import { TeamOnboarding } from './views/TeamOnboarding'
import { InviteAccept } from './views/InviteAccept'
import App from './App'

function Spinner() {
  return (
    <div className="min-h-screen bg-vsc-bg flex items-center justify-center">
      <svg className="animate-spin h-6 w-6 text-vsc-accent" viewBox="0 0 24 24" fill="none" aria-label="Loading">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
      </svg>
    </div>
  )
}

function AuthGate() {
  const { user, loading, teamId } = useAuth()
  if (loading) return <Spinner />
  if (!user) return <LoginPage />
  if (!teamId) return (
    <ToastProvider>
      <TeamOnboarding />
    </ToastProvider>
  )
  return (
    <ToastProvider>
      <AppProvider>
        <App />
      </AppProvider>
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
