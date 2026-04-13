import { useState, type FormEvent } from 'react'
import { useAuth } from './AuthProvider'
import { resetPassword } from '../../lib/auth'

type Mode = 'signin' | 'signup' | 'forgot'

export function LoginPage() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState<Mode>('signin')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  function reset() {
    setError(null)
    setMessage(null)
  }

  function switchMode(next: Mode) {
    reset()
    setMode(next)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    reset()
    setLoading(true)

    try {
      if (mode === 'signin') {
        const { error } = await signIn(email, password)
        if (error) setError(error.message)
      } else if (mode === 'signup') {
        if (displayName.trim().length < 2) {
          setError('Full name must be at least 2 characters.')
          return
        }
        const { error } = await signUp(email, password, displayName.trim())
        if (error) setError(error.message)
        else setMessage('Check your email to confirm your account.')
      } else {
        const { error } = await resetPassword(email)
        if (error) setError((error as Error).message)
        else setMessage('Password reset link sent — check your inbox.')
      }
    } finally {
      setLoading(false)
    }
  }

  const isSignin = mode === 'signin'
  const isSignup = mode === 'signup'
  const isForgot = mode === 'forgot'

  return (
    <div className="min-h-screen bg-vsc-bg flex items-center justify-center p-4">
      {/* Ambient glow — subtle, mode-aware */}
      <div
        className="pointer-events-none fixed inset-0 overflow-hidden"
        aria-hidden
      >
        <div
          className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full opacity-[0.04]"
          style={{ background: 'radial-gradient(ellipse at center, rgb(var(--vsc-accent-rgb)), transparent 70%)' }}
        />
      </div>

      <div className="w-full max-w-[400px]">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-vsc-accent/10 border border-vsc-accent/20 mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18"
                stroke="rgb(var(--vsc-accent-rgb))"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h1 className="text-vsc-text text-xl font-semibold tracking-tight">AutoScriptor</h1>
          <p className="text-vsc-muted text-sm mt-1 font-mono">
            {isSignin && 'Sign in to your workspace'}
            {isSignup && 'Create your workspace'}
            {isForgot && 'Reset your password'}
          </p>
        </div>

        {/* Card */}
        <div className="bg-vsc-panel border border-vsc-border rounded-xl p-6 shadow-xl">
          <div className="h-px bg-vsc-border -mx-6 mb-6" />

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name — signup only */}
            {isSignup && (
              <div>
                <label className="block text-xs font-medium text-vsc-muted mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  autoComplete="name"
                  required
                  minLength={2}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Jane Smith"
                  className="w-full px-3 py-2.5 rounded-md bg-vsc-bg border border-vsc-border text-vsc-text text-sm placeholder:text-vsc-dim focus:outline-none focus:border-vsc-accent focus:ring-1 focus:ring-vsc-accent/30 transition-colors"
                />
              </div>
            )}

            {/* Email */}
            <div>
              <label className="block text-xs font-medium text-vsc-muted mb-1.5 font-medium">
                Email
              </label>
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-3 py-2.5 rounded-md bg-vsc-bg border border-vsc-border text-vsc-text text-sm placeholder:text-vsc-dim focus:outline-none focus:border-vsc-accent focus:ring-1 focus:ring-vsc-accent/30 transition-colors font-mono"
              />
            </div>

            {/* Password */}
            {!isForgot && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-vsc-muted font-medium">
                    Password
                  </label>
                  {isSignin && (
                    <button
                      type="button"
                      onClick={() => switchMode('forgot')}
                      className="text-xs text-vsc-accent hover:text-vsc-accent-hover transition-colors"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <input
                  type="password"
                  autoComplete={isSignin ? 'current-password' : 'new-password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2.5 rounded-md bg-vsc-bg border border-vsc-border text-vsc-text text-sm placeholder:text-vsc-dim focus:outline-none focus:border-vsc-accent focus:ring-1 focus:ring-vsc-accent/30 transition-colors font-mono"
                />
                {isSignup && (
                  <p className="text-xs text-vsc-dim mt-1.5">Minimum 6 characters</p>
                )}
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-md bg-vsc-danger-light border border-vsc-danger/20 text-vsc-danger text-xs">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className="shrink-0 mt-0.5" aria-hidden>
                  <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 3a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 4zm0 7a1 1 0 1 1 0-2 1 1 0 0 1 0 2z" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            {/* Success message */}
            {message && (
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-md bg-vsc-success/10 border border-vsc-success/20 text-vsc-success text-xs">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className="shrink-0 mt-0.5" aria-hidden>
                  <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm3.28 5.03a.75.75 0 0 0-1.06-1.06L7 8.19 5.78 6.97a.75.75 0 0 0-1.06 1.06l1.75 1.75a.75.75 0 0 0 1.06 0l3.75-3.75z" />
                </svg>
                <span>{message}</span>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-md bg-vsc-accent hover:bg-vsc-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors flex items-center justify-center gap-2 mt-2"
            >
              {loading && (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              )}
              {isSignin && (loading ? 'Signing in…' : 'Sign in')}
              {isSignup && (loading ? 'Creating account…' : 'Create account')}
              {isForgot && (loading ? 'Sending…' : 'Send reset link')}
            </button>
          </form>

          {/* Footer links */}
          <div className="mt-5 pt-4 border-t border-vsc-border text-center text-xs text-vsc-muted">
            {isSignin && (
              <>
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('signup')}
                  className="text-vsc-accent hover:text-vsc-accent-hover transition-colors font-medium"
                >
                  Create one
                </button>
              </>
            )}
            {isSignup && (
              <>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('signin')}
                  className="text-vsc-accent hover:text-vsc-accent-hover transition-colors font-medium"
                >
                  Sign in
                </button>
              </>
            )}
            {isForgot && (
              <button
                type="button"
                onClick={() => switchMode('signin')}
                className="text-vsc-accent hover:text-vsc-accent-hover transition-colors font-medium"
              >
                ← Back to sign in
              </button>
            )}
          </div>
        </div>

        {/* Bottom tagline */}
        <p className="text-center text-vsc-dim text-xs mt-5 font-mono">
          Playwright · TypeScript · Zero config
        </p>
      </div>
    </div>
  )
}
