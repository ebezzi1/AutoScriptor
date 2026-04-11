import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import { AppProvider } from './store/AppContext'
import { ToastProvider } from './components/common/Toast'
import { AuthProvider, useAuth } from './components/auth/AuthProvider'
import { LoginPage } from './components/auth/LoginPage'
import App from './App'

function Spinner() {
  return (
    <div className="dark min-h-screen bg-vsc-bg flex items-center justify-center">
      <svg className="animate-spin h-6 w-6 text-vsc-accent" viewBox="0 0 24 24" fill="none" aria-label="Loading">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
      </svg>
    </div>
  )
}

function AuthGate() {
  const { user, loading } = useAuth()
  if (loading) return <Spinner />
  if (!user) return <LoginPage />
  return (
    <AppProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </AppProvider>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  </StrictMode>,
)
