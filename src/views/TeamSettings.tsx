import { useState, useEffect, useCallback } from 'react'
import { useApp } from '../store/AppContext'
import { useAuth } from '../components/auth/AuthProvider'
import { useToast } from '../components/common/Toast'
import { usePermissions } from '../hooks/usePermissions'
import {
  getTeamInfo,
  getTeamMembers,
  getTeamInvites,
  updateTeamName,
  updateMemberRole,
  removeMember,
  createInvite,
  revokeInvite,
  resendInvite,
  searchUserByEmail,
  addMemberDirectly,
  transferOwnership,
} from '../lib/database/teamManagement'
import type { TeamMember, TeamInvite, TeamRole } from '../lib/database/teamManagement'

const ROLE_BADGE: Record<TeamRole, string> = {
  owner: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  admin: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  member: 'bg-green-500/20 text-green-400 border-green-500/30',
  viewer: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
}

const ROLE_AVATAR_BG: Record<TeamRole, string> = {
  owner: 'bg-purple-500/30 text-purple-300',
  admin: 'bg-blue-500/30 text-blue-300',
  member: 'bg-green-500/30 text-green-300',
  viewer: 'bg-gray-500/30 text-gray-300',
}

function RoleBadge({ role }: { role: TeamRole }) {
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border capitalize ${ROLE_BADGE[role]}`}>
      {role}
    </span>
  )
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4 text-vsc-accent" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <button
      onClick={handleCopy}
      className="text-xs px-2 py-1 rounded bg-vsc-hover border border-vsc-border text-vsc-muted hover:text-vsc-text transition-colors"
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  )
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return iso
  }
}

function daysUntil(iso: string): number {
  const diff = new Date(iso).getTime() - Date.now()
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)))
}

export function TeamSettings() {
  const { navigate } = useApp()
  const { user, teamId, refreshTeam } = useAuth()
  const { toast } = useToast()
  const { canManageTeam, canManageMembers } = usePermissions()

  const [members, setMembers] = useState<TeamMember[]>([])
  const [invites, setInvites] = useState<TeamInvite[]>([])
  const [teamName, setTeamName] = useState('')
  const [teamCreatedAt, setTeamCreatedAt] = useState('')
  const [loading, setLoading] = useState(true)

  // Team name editing
  const [editingName, setEditingName] = useState('')
  const [savingName, setSavingName] = useState(false)

  // Member actions
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null)
  const [updatingRole, setUpdatingRole] = useState<string | null>(null)

  // Transfer ownership
  const [showTransfer, setShowTransfer] = useState(false)
  const [transferEmail, setTransferEmail] = useState('')
  const [transferring, setTransferring] = useState(false)

  // Invite by email
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<TeamRole>('member')
  const [sendingInvite, setSendingInvite] = useState(false)
  const [newInviteLink, setNewInviteLink] = useState<string | null>(null)

  // Confirm revoke
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null)
  const [revokingInvite, setRevokingInvite] = useState<string | null>(null)

  // Manual add
  const [addEmail, setAddEmail] = useState('')
  const [addRole, setAddRole] = useState<TeamRole>('member')
  const [addingMember, setAddingMember] = useState(false)

  const loadData = useCallback(async () => {
    if (!teamId) return
    setLoading(true)
    try {
      const [teamInfo, membersData, invitesData] = await Promise.all([
        getTeamInfo(teamId),
        getTeamMembers(teamId),
        getTeamInvites(teamId),
      ])
      setTeamName(teamInfo.name)
      setEditingName(teamInfo.name)
      setTeamCreatedAt(teamInfo.createdAt)
      setMembers(membersData)
      setInvites(invitesData)
    } catch (err) {
      toast(`Failed to load team data: ${err instanceof Error ? err.message : String(err)}`, 'error')
    } finally {
      setLoading(false)
    }
  }, [teamId, toast])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleSaveName = async () => {
    if (!teamId || !editingName.trim()) return
    setSavingName(true)
    try {
      await updateTeamName(teamId, editingName.trim())
      setTeamName(editingName.trim())
      await refreshTeam()
      toast('Team name updated')
    } catch (err) {
      toast(`Failed to update name: ${err instanceof Error ? err.message : String(err)}`, 'error')
    } finally {
      setSavingName(false)
    }
  }

  const handleRoleChange = async (userId: string, newRole: TeamRole) => {
    if (!teamId) return
    setUpdatingRole(userId)
    try {
      await updateMemberRole(teamId, userId, newRole)
      setMembers((prev) => prev.map((m) => m.userId === userId ? { ...m, role: newRole } : m))
      toast('Role updated')
    } catch (err) {
      toast(`Failed to update role: ${err instanceof Error ? err.message : String(err)}`, 'error')
    } finally {
      setUpdatingRole(null)
    }
  }

  const handleRemoveMember = async (userId: string) => {
    if (!teamId) return
    try {
      await removeMember(teamId, userId)
      setMembers((prev) => prev.filter((m) => m.userId !== userId))
      setConfirmRemove(null)
      toast('Member removed')
    } catch (err) {
      toast(`Failed to remove member: ${err instanceof Error ? err.message : String(err)}`, 'error')
    }
  }

  const handleSendInvite = async () => {
    if (!teamId || !user || !inviteEmail.trim()) return
    setSendingInvite(true)
    setNewInviteLink(null)
    try {
      const invite = await createInvite(teamId, inviteEmail.trim(), inviteRole, user.id)
      const link = `${window.location.origin}/invite/${invite.token}`
      setNewInviteLink(link)
      setInvites((prev) => [invite, ...prev])
      setInviteEmail('')
      toast('Invite created — copy the link to share')
    } catch (err) {
      toast(`Failed to create invite: ${err instanceof Error ? err.message : String(err)}`, 'error')
    } finally {
      setSendingInvite(false)
    }
  }

  const handleGenerateTeamLink = async () => {
    if (!teamId || !user) return
    setSendingInvite(true)
    setNewInviteLink(null)
    try {
      const invite = await createInvite(teamId, '*', 'member', user.id)
      const link = `${window.location.origin}/invite/${invite.token}`
      setNewInviteLink(link)
      setInvites((prev) => [invite, ...prev])
      toast('Team invite link generated')
    } catch (err) {
      toast(`Failed to generate link: ${err instanceof Error ? err.message : String(err)}`, 'error')
    } finally {
      setSendingInvite(false)
    }
  }

  const handleRevokeInvite = async (inviteId: string) => {
    setRevokingInvite(inviteId)
    try {
      await revokeInvite(inviteId)
      setInvites((prev) => prev.map((inv) => inv.id === inviteId ? { ...inv, status: 'revoked' } : inv))
      setConfirmRevoke(null)
      toast('Invite revoked')
    } catch (err) {
      toast(`Failed to revoke invite: ${err instanceof Error ? err.message : String(err)}`, 'error')
    } finally {
      setRevokingInvite(null)
    }
  }

  const handleResendInvite = async (inviteId: string) => {
    try {
      const updated = await resendInvite(inviteId)
      setInvites((prev) => prev.map((inv) => inv.id === inviteId ? updated : inv))
      toast('Invite expiry extended by 7 days')
    } catch (err) {
      toast(`Failed to resend invite: ${err instanceof Error ? err.message : String(err)}`, 'error')
    }
  }

  const handleAddMember = async () => {
    if (!teamId || !addEmail.trim()) return
    setAddingMember(true)
    try {
      const found = await searchUserByEmail(addEmail.trim())
      if (!found) {
        toast('No user found with that email. Send an invite instead.', 'error')
        return
      }
      await addMemberDirectly(teamId, found.userId, addRole)
      await loadData()
      setAddEmail('')
      toast(`${found.email} added to team`)
    } catch (err) {
      toast(`Failed to add member: ${err instanceof Error ? err.message : String(err)}`, 'error')
    } finally {
      setAddingMember(false)
    }
  }

  const handleTransferOwnership = async () => {
    if (!teamId || !user || !transferEmail.trim()) return
    setTransferring(true)
    try {
      await transferOwnership(teamId, user.id, transferEmail.trim())
      await refreshTeam()
      await loadData()
      setShowTransfer(false)
      setTransferEmail('')
      toast('Ownership transferred')
    } catch (err) {
      toast(`Failed to transfer ownership: ${err instanceof Error ? err.message : String(err)}`, 'error')
    } finally {
      setTransferring(false)
    }
  }

  const canActOnMember = (target: TeamMember): boolean => {
    if (!user || target.userId === user.id) return false
    const myMember = members.find((m) => m.userId === user.id)
    if (!myMember) return false
    if (myMember.role === 'owner') return target.role !== 'owner'
    if (myMember.role === 'admin') return target.role === 'member' || target.role === 'viewer'
    return false
  }

  const getRoleOptions = (actorRole: TeamRole): TeamRole[] => {
    if (actorRole === 'owner') return ['admin', 'member', 'viewer']
    return ['member', 'viewer']
  }

  const myMember = members.find((m) => m.userId === user?.id)
  const pendingInvites = invites.filter((inv) => inv.status === 'pending')

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full p-20">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={() => navigate({ type: 'projects' })}
          className="flex items-center justify-center w-7 h-7 rounded-md text-vsc-muted hover:text-vsc-text hover:bg-vsc-hover transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <h1 className="text-xl font-semibold text-vsc-text">Team Settings</h1>
      </div>

      {/* Section 1: Team Info */}
      <section className="mb-8 bg-vsc-panel border border-vsc-border rounded-xl p-6">
        <h2 className="text-sm font-semibold text-vsc-text mb-4">Team Info</h2>
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            {canManageMembers ? (
              <>
                <input
                  type="text"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveName() }}
                  className="flex-1 bg-vsc-hover border border-vsc-border rounded-md px-3 py-2 text-sm text-vsc-text outline-none focus:border-vsc-accent/60 transition-colors"
                  placeholder="Team name"
                />
                <button
                  onClick={handleSaveName}
                  disabled={savingName || editingName.trim() === teamName}
                  className="px-3 py-2 text-xs rounded-md bg-vsc-accent text-white hover:bg-vsc-accent-hover disabled:opacity-40 transition-colors"
                >
                  {savingName ? 'Saving…' : 'Save'}
                </button>
              </>
            ) : (
              <span className="text-sm font-semibold text-vsc-text">{teamName}</span>
            )}
          </div>
          <div className="flex items-center gap-6 text-xs text-vsc-dim">
            {teamCreatedAt && (
              <span>Created {formatDate(teamCreatedAt)}</span>
            )}
            <span>{members.length} member{members.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
      </section>

      {/* Section 2: Members */}
      <section className="mb-8 bg-vsc-panel border border-vsc-border rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-vsc-border">
          <h2 className="text-sm font-semibold text-vsc-text">Members</h2>
        </div>
        <div className="divide-y divide-vsc-border/50">
          {members.map((member) => {
            const isMe = member.userId === user?.id
            const canAct = canActOnMember(member)
            const isConfirmingRemove = confirmRemove === member.userId

            return (
              <div
                key={member.userId}
                className={`flex items-center gap-3 px-6 py-3 ${isMe ? 'bg-vsc-accent/5' : ''}`}
              >
                {/* Avatar */}
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${ROLE_AVATAR_BG[member.role]}`}>
                  {member.email[0].toUpperCase()}
                </div>

                {/* Name/Email */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-vsc-text truncate">
                    {member.fullName ?? member.email}
                    {isMe && <span className="text-vsc-dim ml-1.5">(you)</span>}
                  </p>
                  {member.fullName && (
                    <p className="text-[10px] text-vsc-dim truncate">{member.email}</p>
                  )}
                </div>

                {/* Role badge / dropdown */}
                <div className="shrink-0">
                  {canAct && canManageMembers ? (
                    <select
                      value={member.role}
                      onChange={(e) => handleRoleChange(member.userId, e.target.value as TeamRole)}
                      disabled={updatingRole === member.userId}
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-transparent cursor-pointer outline-none transition-colors appearance-none"
                      style={{ minWidth: '64px' }}
                    >
                      {getRoleOptions(myMember?.role ?? 'member').map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  ) : (
                    <RoleBadge role={member.role} />
                  )}
                </div>

                {/* Joined date */}
                <span className="text-[10px] text-vsc-dim shrink-0 hidden sm:block">
                  {formatDate(member.joinedAt)}
                </span>

                {/* Actions */}
                {canAct && canManageMembers && member.role !== 'owner' && (
                  <div className="shrink-0">
                    {isConfirmingRemove ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-vsc-muted">Remove?</span>
                        <button
                          onClick={() => handleRemoveMember(member.userId)}
                          className="text-[10px] px-2 py-0.5 rounded bg-vsc-danger/20 text-vsc-danger border border-vsc-danger/30 hover:bg-vsc-danger/30 transition-colors"
                        >
                          Yes
                        </button>
                        <button
                          onClick={() => setConfirmRemove(null)}
                          className="text-[10px] px-2 py-0.5 rounded bg-vsc-hover text-vsc-muted border border-vsc-border hover:text-vsc-text transition-colors"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmRemove(member.userId)}
                        className="text-[10px] px-2 py-0.5 rounded text-vsc-danger hover:bg-vsc-danger-light border border-transparent hover:border-vsc-danger/20 transition-colors"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Transfer ownership */}
        {canManageTeam && (
          <div className="px-6 py-3 border-t border-vsc-border/50">
            {showTransfer ? (
              <div className="flex flex-col gap-3">
                <p className="text-xs text-vsc-muted">
                  Warning: Transferring ownership is irreversible. You will become an admin.
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="email"
                    value={transferEmail}
                    onChange={(e) => setTransferEmail(e.target.value)}
                    placeholder="New owner email"
                    className="flex-1 bg-vsc-hover border border-vsc-border rounded-md px-3 py-1.5 text-xs text-vsc-text outline-none focus:border-vsc-accent/60 transition-colors"
                  />
                  <button
                    onClick={handleTransferOwnership}
                    disabled={transferring || !transferEmail.trim()}
                    className="px-3 py-1.5 text-xs rounded-md bg-vsc-danger/20 text-vsc-danger border border-vsc-danger/30 hover:bg-vsc-danger/30 disabled:opacity-40 transition-colors"
                  >
                    {transferring ? 'Transferring…' : 'Confirm Transfer'}
                  </button>
                  <button
                    onClick={() => { setShowTransfer(false); setTransferEmail('') }}
                    className="px-3 py-1.5 text-xs rounded-md text-vsc-muted hover:text-vsc-text hover:bg-vsc-hover transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowTransfer(true)}
                className="text-xs text-vsc-dim hover:text-vsc-muted transition-colors"
              >
                Transfer ownership
                <span className="ml-1 text-vsc-dim/60">→</span>
              </button>
            )}
          </div>
        )}
      </section>

      {/* Section 3: Invite Members */}
      {canManageMembers && (
        <section className="bg-vsc-panel border border-vsc-border rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-vsc-border">
            <h2 className="text-sm font-semibold text-vsc-text">Invite Members</h2>
          </div>

          {/* A) Invite by email */}
          <div className="px-6 py-5 border-b border-vsc-border/50">
            <p className="text-xs font-medium text-vsc-muted mb-3">Invite by email</p>
            <div className="flex items-center gap-2 mb-3">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSendInvite() }}
                placeholder="colleague@example.com"
                className="flex-1 bg-vsc-hover border border-vsc-border rounded-md px-3 py-2 text-xs text-vsc-text outline-none focus:border-vsc-accent/60 transition-colors"
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as TeamRole)}
                className="bg-vsc-hover border border-vsc-border rounded-md px-2 py-2 text-xs text-vsc-muted outline-none cursor-pointer"
              >
                <option value="admin">Admin</option>
                <option value="member">Member</option>
                <option value="viewer">Viewer</option>
              </select>
              <button
                onClick={handleSendInvite}
                disabled={sendingInvite || !inviteEmail.trim()}
                className="px-3 py-2 text-xs rounded-md bg-vsc-accent text-white hover:bg-vsc-accent-hover disabled:opacity-40 transition-colors whitespace-nowrap"
              >
                {sendingInvite ? 'Creating…' : 'Send Invite'}
              </button>
            </div>
            {newInviteLink && (
              <div className="flex items-center gap-2 bg-vsc-hover border border-vsc-border rounded-md px-3 py-2">
                <span className="text-xs text-vsc-dim flex-1 truncate font-mono">{newInviteLink}</span>
                <CopyButton text={newInviteLink} />
              </div>
            )}
          </div>

          {/* B) Team invite link */}
          <div className="px-6 py-5 border-b border-vsc-border/50">
            <p className="text-xs font-medium text-vsc-muted mb-3">General invite link</p>
            <button
              onClick={handleGenerateTeamLink}
              disabled={sendingInvite}
              className="px-3 py-2 text-xs rounded-md bg-vsc-hover border border-vsc-border text-vsc-muted hover:text-vsc-text transition-colors"
            >
              Generate team link
            </button>
            <p className="text-[10px] text-vsc-dim mt-2">
              Anyone with this link can join as a member. Expires in 7 days.
            </p>
          </div>

          {/* Pending invites table */}
          {pendingInvites.length > 0 && (
            <div className="px-6 py-4 border-b border-vsc-border/50">
              <p className="text-xs font-medium text-vsc-muted mb-3">Pending invites ({pendingInvites.length})</p>
              <div className="space-y-2">
                {pendingInvites.map((invite) => {
                  const inviteLink = `${window.location.origin}/invite/${invite.token}`
                  const isConfirmingRevoke = confirmRevoke === invite.id
                  const days = daysUntil(invite.expiresAt)

                  return (
                    <div key={invite.id} className="flex items-center gap-2 text-xs p-2 rounded-md bg-vsc-hover/50 border border-vsc-border/50">
                      <div className="flex-1 min-w-0">
                        <span className="text-vsc-text font-medium truncate block">
                          {invite.email === '*' ? 'General link' : invite.email}
                        </span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <RoleBadge role={invite.role} />
                          {invite.invitedByEmail && (
                            <span className="text-[10px] text-vsc-dim">by {invite.invitedByEmail}</span>
                          )}
                          <span className="text-[10px] text-vsc-dim">
                            {days > 0 ? `expires in ${days}d` : 'expired'}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <CopyButton text={inviteLink} />
                        <button
                          onClick={() => handleResendInvite(invite.id)}
                          className="px-2 py-1 rounded text-[10px] bg-vsc-hover border border-vsc-border text-vsc-muted hover:text-vsc-text transition-colors"
                        >
                          Extend
                        </button>
                        {isConfirmingRevoke ? (
                          <>
                            <button
                              onClick={() => handleRevokeInvite(invite.id)}
                              disabled={revokingInvite === invite.id}
                              className="px-2 py-1 rounded text-[10px] bg-vsc-danger/20 text-vsc-danger border border-vsc-danger/30 hover:bg-vsc-danger/30 transition-colors"
                            >
                              Revoke
                            </button>
                            <button
                              onClick={() => setConfirmRevoke(null)}
                              className="px-2 py-1 rounded text-[10px] text-vsc-muted hover:text-vsc-text transition-colors"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => setConfirmRevoke(invite.id)}
                            className="px-2 py-1 rounded text-[10px] text-vsc-danger hover:bg-vsc-danger-light border border-transparent hover:border-vsc-danger/20 transition-colors"
                          >
                            Revoke
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* C) Manual add */}
          <div className="px-6 py-5">
            <p className="text-xs font-medium text-vsc-muted mb-3">Add existing user</p>
            <div className="flex items-center gap-2">
              <input
                type="email"
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddMember() }}
                placeholder="user@example.com"
                className="flex-1 bg-vsc-hover border border-vsc-border rounded-md px-3 py-2 text-xs text-vsc-text outline-none focus:border-vsc-accent/60 transition-colors"
              />
              <select
                value={addRole}
                onChange={(e) => setAddRole(e.target.value as TeamRole)}
                className="bg-vsc-hover border border-vsc-border rounded-md px-2 py-2 text-xs text-vsc-muted outline-none cursor-pointer"
              >
                <option value="admin">Admin</option>
                <option value="member">Member</option>
                <option value="viewer">Viewer</option>
              </select>
              <button
                onClick={handleAddMember}
                disabled={addingMember || !addEmail.trim()}
                className="px-3 py-2 text-xs rounded-md bg-vsc-hover border border-vsc-border text-vsc-muted hover:text-vsc-text disabled:opacity-40 transition-colors whitespace-nowrap"
              >
                {addingMember ? 'Adding…' : 'Add'}
              </button>
            </div>
            <p className="text-[10px] text-vsc-dim mt-2">
              User must already have an account. If not found, use email invite above.
            </p>
          </div>
        </section>
      )}
    </div>
  )
}
