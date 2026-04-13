import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { signIn as authSignIn, signUp as authSignUp, signOut as authSignOut } from '../../lib/auth'
import { ensureTeam } from '../../lib/database/teams'
import { getMyRole, getTeamInfo } from '../../lib/database/teamManagement'
import type { TeamRole } from '../../lib/database/teamManagement'

interface AuthContextValue {
  user: User | null
  session: Session | null
  teamId: string | null
  teamName: string | null
  role: TeamRole | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signUp: (email: string, password: string, displayName: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  refreshTeam: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [teamId, setTeamId] = useState<string | null>(null)
  const [teamName, setTeamName] = useState<string | null>(null)
  const [role, setRole] = useState<TeamRole | null>(null)
  const [loading, setLoading] = useState(true)

  async function resolveTeam(userId: string): Promise<void> {
    try {
      const id = await ensureTeam(userId)
      setTeamId(id)

      const [myRole, teamInfo] = await Promise.all([
        getMyRole(id, userId),
        getTeamInfo(id).catch(() => null),
      ])
      setRole(myRole)
      setTeamName(teamInfo?.name ?? null)
    } catch (err) {
      console.error('[AuthProvider] ensureTeam failed:', err)
      // Leave teamId null — AppContext will show an error
    }
  }

  async function refreshTeam(): Promise<void> {
    if (!user) return
    try {
      const id = await ensureTeam(user.id)
      setTeamId(id)

      const [myRole, teamInfo] = await Promise.all([
        getMyRole(id, user.id),
        getTeamInfo(id).catch(() => null),
      ])
      setRole(myRole)
      setTeamName(teamInfo?.name ?? null)
    } catch (err) {
      console.error('[AuthProvider] refreshTeam failed:', err)
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
        setTeamName(null)
        setRole(null)
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

  async function signUp(email: string, password: string, displayName: string) {
    console.log('[AuthProvider] signUp attempt for:', email)
    const { error } = await authSignUp(email, password, displayName)
    if (error) console.error('[AuthProvider] signUp error:', error)
    return { error: error as Error | null }
  }

  async function signOut() {
    await authSignOut()
  }

  return (
    <AuthContext.Provider value={{ user, session, teamId, teamName, role, loading, signIn, signUp, signOut, refreshTeam }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
