import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { signIn as authSignIn, signUp as authSignUp, signOut as authSignOut } from '../../lib/auth'
import { getUserTeams, type UserTeam } from '../../lib/database/teams'
import { getMyRole, getTeamInfo } from '../../lib/database/teamManagement'
import { getPreference, setPreference } from '../../lib/database/preferences'
import type { TeamRole } from '../../lib/database/teamManagement'

// ── Preference keys ───────────────────────────────────────────────────────────

const PREF_SHOW_TEAM_MODAL = 'show_team_modal'
const PREF_LAST_TEAM_ID = 'last_team_id'

// ── Context shape ─────────────────────────────────────────────────────────────

export type TeamState =
  | { status: 'loading' }
  | { status: 'none'; teams: [] }
  | { status: 'pending'; teams: UserTeam[] }
  | { status: 'ready' }

interface AuthContextValue {
  user: User | null
  session: Session | null
  teamId: string | null
  teamName: string | null
  role: TeamRole | null
  loading: boolean
  /** Resolved team state — used by the gate to decide what to show */
  teamState: TeamState
  /** Select a team from the list and enter workspace */
  selectTeam: (teamId: string, skipModalNextTime: boolean) => Promise<void>
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signUp: (email: string, password: string, displayName: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  /** Re-query teams (after creating/joining a team) */
  refreshTeam: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

// ── Provider ──────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [teamId, setTeamId] = useState<string | null>(null)
  const [teamName, setTeamName] = useState<string | null>(null)
  const [role, setRole] = useState<TeamRole | null>(null)
  const [loading, setLoading] = useState(true)
  const [teamState, setTeamState] = useState<TeamState>({ status: 'loading' })

  // Tracks the user.id we've already resolved teams for, so spurious
  // SIGNED_IN / TOKEN_REFRESHED events (e.g. on tab focus) don't reset
  // teamState and remount AppProvider downstream.
  const resolvedForUserIdRef = useRef<string | null>(null)

  // ── Apply a chosen team (sets teamId + role + name, transitions to ready) ─

  const applyTeam = useCallback(async (id: string, userId: string) => {
    console.log('[AuthProvider] applyTeam:', id)
    setTeamId(id)
    const [myRole, teamInfo] = await Promise.all([
      getMyRole(id, userId),
      getTeamInfo(id).catch(() => null),
    ])
    setRole(myRole)
    setTeamName(teamInfo?.name ?? null)
    setTeamState({ status: 'ready' })
  }, [])

  // ── Resolve all teams for a user ────────────────────────────────────────

  const resolveTeams = useCallback(async (userId: string) => {
    console.log('[AuthProvider] resolveTeams for:', userId)
    setTeamState({ status: 'loading' })

    try {
      const teams = await getUserTeams(userId)
      console.log('[AuthProvider] Teams found:', teams.length)

      if (teams.length === 0) {
        // No teams at all — show create/join onboarding
        console.log('[AuthProvider] No teams — showing onboarding')
        setTeamId(null)
        setTeamState({ status: 'none', teams: [] })
        return
      }

      // Check "don't show again" preference
      let shouldSkip = false
      try {
        const pref = await getPreference(userId, PREF_SHOW_TEAM_MODAL)
        // pref === 'false' means user previously checked "don't show again"
        shouldSkip = pref === 'false'
        console.log('[AuthProvider] show_team_modal preference:', pref, '→ shouldSkip:', shouldSkip)
      } catch {
        // Preference read failed — default to showing modal
      }

      if (shouldSkip) {
        // Try to auto-select last used team
        let lastTeamId: string | null = null
        try {
          lastTeamId = await getPreference(userId, PREF_LAST_TEAM_ID)
        } catch {
          // ignore
        }

        // Verify last team still exists in user's memberships
        const lastTeam = lastTeamId ? teams.find((t) => t.teamId === lastTeamId) : null

        if (lastTeam) {
          console.log('[AuthProvider] Auto-selecting last team (dont-show-again):', lastTeam.teamId)
          await applyTeam(lastTeam.teamId, userId)
          return
        }

        // Last team not found — fall through to show modal
        console.log('[AuthProvider] Last team not found in memberships, showing modal')
      }

      // Default: ALWAYS show the modal. No auto-select.
      console.log('[AuthProvider] Showing team modal with', teams.length, 'team(s)')
      setTeamId(null)
      setTeamState({ status: 'pending', teams })
    } catch (err) {
      console.error('[AuthProvider] resolveTeams failed:', err)
      setTeamId(null)
      setTeamState({ status: 'none', teams: [] })
    }
  }, [applyTeam])

  // ── Select a team (called by TeamSelectorModal) ─────────────────────────

  const selectTeam = useCallback(async (id: string, skipModalNextTime: boolean) => {
    if (!user) return
    console.log('[AuthProvider] selectTeam:', id, 'skipNextTime:', skipModalNextTime)
    setTeamState({ status: 'loading' })

    // Save preferences
    try {
      await setPreference(user.id, PREF_LAST_TEAM_ID, id)
      await setPreference(user.id, PREF_SHOW_TEAM_MODAL, skipModalNextTime ? 'false' : 'true')
    } catch (err) {
      console.warn('[AuthProvider] Failed to save team preferences:', err)
    }

    await applyTeam(id, user.id)
  }, [user, applyTeam])

  // ── Refresh teams (after create/join) ───────────────────────────────────

  const refreshTeam = useCallback(async () => {
    if (!user) return
    await resolveTeams(user.id)
  }, [user, resolveTeams])

  // ── Initial session + live auth state ───────────────────────────────────

  useEffect(() => {
    console.log('[AuthProvider] mount — subscribing to auth state')

    supabase.auth.getSession().then(async ({ data }) => {
      const currentUser = data.session?.user ?? null
      console.log('[AuthProvider] getSession resolved — user:', currentUser?.id ?? 'none')
      setSession(data.session)
      setUser(currentUser)
      if (currentUser && resolvedForUserIdRef.current !== currentUser.id) {
        resolvedForUserIdRef.current = currentUser.id
        await resolveTeams(currentUser.id)
      }
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, nextSession) => {
      const nextUser = nextSession?.user ?? null
      console.log('[AuthProvider] onAuthStateChange:', event, 'user:', nextUser?.id ?? 'none')

      // Always keep session/user in sync — the User object reference may
      // change on TOKEN_REFRESHED, but downstream consumers compare by id.
      setSession(nextSession)
      setUser(nextUser)

      if (event === 'SIGNED_OUT') {
        console.log('[AuthProvider] SIGNED_OUT — clearing team state')
        resolvedForUserIdRef.current = null
        setTeamId(null)
        setTeamName(null)
        setRole(null)
        setTeamState({ status: 'loading' })
        return
      }

      // Resolve teams ONLY when the authenticated user actually changes.
      // Supabase fires SIGNED_IN / INITIAL_SESSION / TOKEN_REFRESHED on
      // tab-focus and silent refreshes — re-resolving on those events would
      // flip teamState back to 'loading', unmount AppProvider, and force a
      // full workspace reload (the bug we're fixing).
      if (nextUser && resolvedForUserIdRef.current !== nextUser.id) {
        console.log('[AuthProvider] New user id — resolving teams')
        resolvedForUserIdRef.current = nextUser.id
        await resolveTeams(nextUser.id)
      } else {
        console.log('[AuthProvider] Skipping team resolution (already resolved for this user)')
      }
    })

    return () => {
      console.log('[AuthProvider] unmount — unsubscribing')
      subscription.unsubscribe()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auth actions ────────────────────────────────────────────────────────

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
    <AuthContext.Provider value={{
      user, session, teamId, teamName, role, loading,
      teamState, selectTeam,
      signIn, signUp, signOut, refreshTeam,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
