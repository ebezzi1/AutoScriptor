import { useState, useEffect } from 'react'
import { useAuth } from '../components/auth/AuthProvider'
import { useToast } from '../components/common/Toast'
import { getInviteByToken, acceptInvite } from '../lib/database/teamManagement'
import type { TeamInvite, TeamRole } from '../lib/database/teamManagement'
import { LoginPage } from '../components/auth/LoginPage'

interface Props {
  token: string
}

type InviteState =
  | { status: 'loading' }
  | { status: 'not_found' }
  | { status: 'expired' }
  | { status: 'already_member' }
  | { status: 'valid'; invite: TeamInvite & { teamName: string } }
  | { status: 'accepted'; teamId: string; role: TeamRole }
  | { status: 'error'; message: string }

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

export function InviteAccept({ token }: Props) {
  const { user, loading: authLoading, teamId: currentTeamId, refreshTeam } = useAuth()
  const { toast } = useToast()
  const [inviteState, setInviteState] = useState<InviteState>({ status: 'loading' })
  const [accepting, setAccepting] = useState(false)

  useEffect(() => {
    if (authLoading) return

    async function checkInvite() {
      setInviteState({ status: 'loading' })
      try {
        const invite = await getInviteByToken(token)
        if (!invite) {
          setInviteState({ status: 'not_found' })
          return
        }
        if (invite.status !== 'pending') {
          setInviteState({ status: 'not_found' })
          return
        }
        if (new Date(invite.expiresAt) < new Date()) {
          setInviteState({ status: 'expired' })
          return
        }
        // Check if already a member of this team
        if (user && currentTeamId === invite.teamId) {
          setInviteState({ status: 'already_member' })
          return
        }
        setInviteState({ status: 'valid', invite })
      } catch (err) {
        setInviteState({ status: 'error', message: err instanceof Error ? err.message : String(err) })
      }
    }

    checkInvite()
  }, [token, authLoading, user, currentTeamId])

  const handleAccept = async () => {
    if (!user || inviteState.status !== 'valid') return
    setAccepting(true)
    try {
      const { teamId, role } = await acceptInvite(token, user.id, user.email ?? '')
      await refreshTeam()
      setInviteState({ status: 'accepted', teamId, role })
      toast('Successfully joined the team')
    } catch (err) {
      toast(`Failed to accept invite: ${err instanceof Error ? err.message : String(err)}`, 'error')
    } finally {
      setAccepting(false)
    }
  }

  const handleGoToApp = () => {
    // Remove the invite path and navigate to the root
    window.history.replaceState(null, '', '/')
    window.location.reload()
  }

  if (authLoading || inviteState.status === 'loading') return <Spinner />

  // Not logged in
  if (!user) {
    return (
      <div>
        <div className="fixed top-0 left-0 right-0 z-50 bg-vsc-accent/10 border-b border-vsc-accent/20 px-4 py-3 text-center">
          <p className="text-sm text-vsc-accent font-medium">
            You have been invited to join a team. Sign in or create an account to accept.
          </p>
        </div>
        <div className="pt-14">
          <LoginPage />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-vsc-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-8 h-8 rounded-lg bg-vsc-accent/15 border border-vsc-accent/30 flex items-center justify-center">
            <span className="text-vsc-accent text-xs font-bold leading-none">PW</span>
          </div>
          <span className="text-lg font-semibold text-vsc-text">AutoScriptor</span>
        </div>

        <div className="bg-vsc-panel border border-vsc-border rounded-xl p-8 text-center">
          {inviteState.status === 'not_found' && (
            <>
              <div className="w-12 h-12 rounded-full bg-vsc-danger/20 flex items-center justify-center mx-auto mb-4">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-vsc-danger">
                  <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M10 6v4M10 14h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
              <h2 className="text-base font-semibold text-vsc-text mb-2">Invite not found</h2>
              <p className="text-sm text-vsc-muted mb-6">
                This invite link is invalid, has been revoked, or has already been used.
              </p>
              <button onClick={handleGoToApp} className="px-4 py-2 text-sm rounded-md bg-vsc-hover border border-vsc-border text-vsc-muted hover:text-vsc-text transition-colors">
                Go to app
              </button>
            </>
          )}

          {inviteState.status === 'expired' && (
            <>
              <div className="w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center mx-auto mb-4">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-yellow-400">
                  <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M10 6v4M10 14h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
              <h2 className="text-base font-semibold text-vsc-text mb-2">Invite expired</h2>
              <p className="text-sm text-vsc-muted mb-6">
                This invite link has expired. Ask a team admin to send a new one.
              </p>
              <button onClick={handleGoToApp} className="px-4 py-2 text-sm rounded-md bg-vsc-hover border border-vsc-border text-vsc-muted hover:text-vsc-text transition-colors">
                Go to app
              </button>
            </>
          )}

          {inviteState.status === 'already_member' && (
            <>
              <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-green-400">
                  <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M6 10l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <h2 className="text-base font-semibold text-vsc-text mb-2">You are already on this team</h2>
              <p className="text-sm text-vsc-muted mb-6">
                You are already a member of this team.
              </p>
              <button onClick={handleGoToApp} className="px-4 py-2 text-sm font-medium rounded-md bg-vsc-accent text-white hover:bg-vsc-accent-hover transition-colors">
                Go to app
              </button>
            </>
          )}

          {inviteState.status === 'valid' && (
            <>
              <div className="w-12 h-12 rounded-full bg-vsc-accent/20 flex items-center justify-center mx-auto mb-4">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-vsc-accent">
                  <circle cx="8" cy="7" r="3" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M2 17c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  <path d="M14 12l2 2 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <h2 className="text-base font-semibold text-vsc-text mb-2">
                Join {inviteState.invite.teamName}
              </h2>
              <p className="text-sm text-vsc-muted mb-1">
                You have been invited as a{' '}
                <span className="font-semibold text-vsc-text capitalize">{inviteState.invite.role}</span>
              </p>
              <p className="text-xs text-vsc-dim mb-6">
                Signing in as <span className="text-vsc-muted">{user.email}</span>
              </p>
              <button
                onClick={handleAccept}
                disabled={accepting}
                className="w-full py-2.5 text-sm font-medium rounded-md bg-vsc-accent text-white hover:bg-vsc-accent-hover disabled:opacity-40 transition-colors"
              >
                {accepting ? 'Accepting…' : 'Accept Invite'}
              </button>
            </>
          )}

          {inviteState.status === 'accepted' && (
            <>
              <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-green-400">
                  <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M6 10l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <h2 className="text-base font-semibold text-vsc-text mb-2">Welcome to the team</h2>
              <p className="text-sm text-vsc-muted mb-6">
                You have joined as a{' '}
                <span className="font-semibold text-vsc-text capitalize">{inviteState.role}</span>.
              </p>
              <button
                onClick={handleGoToApp}
                className="w-full py-2.5 text-sm font-medium rounded-md bg-vsc-accent text-white hover:bg-vsc-accent-hover transition-colors"
              >
                Go to app
              </button>
            </>
          )}

          {inviteState.status === 'error' && (
            <>
              <div className="w-12 h-12 rounded-full bg-vsc-danger/20 flex items-center justify-center mx-auto mb-4">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-vsc-danger">
                  <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M10 6v4M10 14h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
              <h2 className="text-base font-semibold text-vsc-text mb-2">Something went wrong</h2>
              <p className="text-sm text-vsc-muted mb-6">{inviteState.message}</p>
              <button onClick={handleGoToApp} className="px-4 py-2 text-sm rounded-md bg-vsc-hover border border-vsc-border text-vsc-muted hover:text-vsc-text transition-colors">
                Go to app
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
