import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { signIn as authSignIn, signUp as authSignUp, signOut as authSignOut } from '../../lib/auth'
import { ensureTeam } from '../../lib/database/teams'

interface AuthContextValue {
  user: User | null
  session: Session | null
  teamId: string | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [teamId, setTeamId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  async function resolveTeam(userId: string): Promise<void> {
    try {
      const id = await ensureTeam(userId)
      setTeamId(id)
    } catch (err) {
      console.error('[AuthProvider] ensureTeam failed:', err)
      // Leave teamId null — AppContext will show an error
    }
  }

  useEffect(() => {
    // Initial session check
    supabase.auth.getSession().then(async ({ data }) => {
      const currentUser = data.session?.user ?? null
      setSession(data.session)
      setUser(currentUser)
      if (currentUser) {
        await resolveTeam(currentUser.id)
      }
      setLoading(false)
    })

    // Live auth state changes (sign in, sign out, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[AuthProvider] onAuthStateChange event:', event, 'user:', session?.user?.id)
      const currentUser = session?.user ?? null
      setSession(session)
      setUser(currentUser)

      if (event === 'SIGNED_IN' && currentUser) {
        await resolveTeam(currentUser.id)
      } else if (event === 'SIGNED_OUT') {
        setTeamId(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signIn(email: string, password: string) {
    console.log('[AuthProvider] signIn attempt for:', email)
    const { error } = await authSignIn(email, password)
    if (error) console.error('[AuthProvider] signIn error:', error)
    return { error: error as Error | null }
  }

  async function signUp(email: string, password: string) {
    console.log('[AuthProvider] signUp attempt for:', email)
    const { error } = await authSignUp(email, password)
    if (error) console.error('[AuthProvider] signUp error:', error)
    return { error: error as Error | null }
  }

  async function signOut() {
    await authSignOut()
  }

  return (
    <AuthContext.Provider value={{ user, session, teamId, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
