import { useState } from 'react'
import { useAuth } from '../components/auth/AuthProvider'
import { useToast } from '../components/common/Toast'
import { supabase } from '../lib/supabase'
import { acceptInvite } from '../lib/database/teamManagement'

function extractToken(input: string): string {
  const trimmed = input.trim()
  // If it looks like a URL, extract the token from the path
  if (trimmed.includes('/invite/')) {
    const parts = trimmed.split('/invite/')
    return parts[parts.length - 1].split('?')[0].split('#')[0]
  }
  return trimmed
}

export function TeamOnboarding() {
  const { user, refreshTeam } = useAuth()
  const { toast } = useToast()

  const [tab, setTab] = useState<'create' | 'join'>('create')

  // Create team
  const [teamName, setTeamName] = useState('My Workspace')
  const [creating, setCreating] = useState(false)

  // Join with invite
  const [inviteInput, setInviteInput] = useState('')
  const [joining, setJoining] = useState(false)

  const handleCreateTeam = async () => {
    if (!user || !teamName.trim()) return
    setCreating(true)
    try {
      // Create team
      const { data: team, error: teamErr } = await supabase
        .from('teams')
        .insert({ name: teamName.trim() })
        .select('id')
        .single()

      if (teamErr) throw new Error(teamErr.message)
      const teamId = (team as Record<string, unknown>).id as string

      // Add user as owner
      const { error: memberErr } = await supabase
        .from('team_members')
        .insert({ team_id: teamId, user_id: user.id, role: 'owner' })

      if (memberErr) throw new Error(memberErr.message)

      // Ensure profile exists
      await supabase
        .from('profiles')
        .upsert({ id: user.id, email: user.email ?? '' }, { onConflict: 'id' })

      await refreshTeam()
      toast(`Team "${teamName.trim()}" created`)
    } catch (err) {
      toast(`Failed to create team: ${err instanceof Error ? err.message : String(err)}`, 'error')
    } finally {
      setCreating(false)
    }
  }

  const handleJoinWithInvite = async () => {
    if (!user || !inviteInput.trim()) return
    setJoining(true)
    try {
      const token = extractToken(inviteInput)
      await acceptInvite(token, user.id, user.email ?? '')
      await refreshTeam()
      toast('Successfully joined the team')
    } catch (err) {
      toast(`Failed to join team: ${err instanceof Error ? err.message : String(err)}`, 'error')
    } finally {
      setJoining(false)
    }
  }

  return (
    <div className="min-h-screen bg-vsc-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-8 h-8 rounded-lg bg-vsc-accent/15 border border-vsc-accent/30 flex items-center justify-center">
            <span className="text-vsc-accent text-xs font-bold leading-none">PW</span>
          </div>
          <span className="text-lg font-semibold text-vsc-text">AutoScriptor</span>
        </div>

        <div className="bg-vsc-panel border border-vsc-border rounded-xl overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-vsc-border">
            <button
              onClick={() => setTab('create')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                tab === 'create'
                  ? 'text-vsc-accent bg-vsc-accent-light border-b-2 border-vsc-accent'
                  : 'text-vsc-muted hover:text-vsc-text'
              }`}
            >
              Create a team
            </button>
            <button
              onClick={() => setTab('join')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                tab === 'join'
                  ? 'text-vsc-accent bg-vsc-accent-light border-b-2 border-vsc-accent'
                  : 'text-vsc-muted hover:text-vsc-text'
              }`}
            >
              Join with invite
            </button>
          </div>

          <div className="p-6">
            {tab === 'create' ? (
              <div className="flex flex-col gap-4">
                <p className="text-sm text-vsc-muted">
                  Create a new workspace for your team.
                </p>
                <div>
                  <label className="block text-xs text-vsc-dim mb-1.5">Team name</label>
                  <input
                    type="text"
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleCreateTeam() }}
                    className="w-full bg-vsc-hover border border-vsc-border rounded-md px-3 py-2 text-sm text-vsc-text outline-none focus:border-vsc-accent/60 transition-colors"
                    placeholder="My Workspace"
                    autoFocus
                  />
                </div>
                <button
                  onClick={handleCreateTeam}
                  disabled={creating || !teamName.trim()}
                  className="w-full py-2.5 text-sm font-medium rounded-md bg-vsc-accent text-white hover:bg-vsc-accent-hover disabled:opacity-40 transition-colors"
                >
                  {creating ? 'Creating…' : 'Create Team'}
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <p className="text-sm text-vsc-muted">
                  Paste an invite link or token to join an existing team.
                </p>
                <div>
                  <label className="block text-xs text-vsc-dim mb-1.5">Invite link or token</label>
                  <input
                    type="text"
                    value={inviteInput}
                    onChange={(e) => setInviteInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleJoinWithInvite() }}
                    className="w-full bg-vsc-hover border border-vsc-border rounded-md px-3 py-2 text-sm text-vsc-text outline-none focus:border-vsc-accent/60 transition-colors font-mono"
                    placeholder="https://…/invite/abc123 or abc123"
                    autoFocus
                  />
                </div>
                <button
                  onClick={handleJoinWithInvite}
                  disabled={joining || !inviteInput.trim()}
                  className="w-full py-2.5 text-sm font-medium rounded-md bg-vsc-accent text-white hover:bg-vsc-accent-hover disabled:opacity-40 transition-colors"
                >
                  {joining ? 'Joining…' : 'Join Team'}
                </button>
              </div>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-vsc-dim mt-4">
          Signed in as <span className="text-vsc-muted">{user?.email}</span>
        </p>
      </div>
    </div>
  )
}
