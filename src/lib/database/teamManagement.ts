import { supabase } from '../supabase'

export type TeamRole = 'owner' | 'admin' | 'member' | 'viewer'

export interface TeamInfo {
  id: string
  name: string
  createdAt: string
}

export interface TeamMember {
  userId: string
  email: string
  fullName: string | null
  role: TeamRole
  joinedAt: string
}

export interface TeamInvite {
  id: string
  teamId: string
  email: string
  role: TeamRole
  token: string
  invitedBy: string | null
  invitedByEmail: string | null
  createdAt: string
  expiresAt: string
  status: 'pending' | 'accepted' | 'revoked'
}

export async function getTeamInfo(teamId: string): Promise<TeamInfo> {
  const { data, error } = await supabase
    .from('teams')
    .select('id, name, created_at')
    .eq('id', teamId)
    .single()

  if (error) throw new Error(`Failed to fetch team info: ${error.message}`)
  const row = data as Record<string, unknown>
  return {
    id: row.id as string,
    name: row.name as string,
    createdAt: row.created_at as string,
  }
}

export async function getTeamMembers(teamId: string): Promise<TeamMember[]> {
  const { data, error } = await supabase
    .from('team_members')
    .select('user_id, role, joined_at')
    .eq('team_id', teamId)

  if (error) throw new Error(`Failed to fetch team members: ${error.message}`)

  const rows = (data ?? []) as Array<{ user_id: string; role: string; joined_at: string }>

  if (rows.length === 0) return []

  // Fetch profiles for all members
  const userIds = rows.map((r) => r.user_id)
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, email, full_name')
    .in('id', userIds)

  const profileMap = new Map<string, { email: string; full_name: string | null }>()
  for (const p of (profiles ?? []) as Array<{ id: string; email: string; full_name: string | null }>) {
    profileMap.set(p.id, { email: p.email, full_name: p.full_name })
  }

  return rows.map((r) => {
    const profile = profileMap.get(r.user_id)
    return {
      userId: r.user_id,
      email: profile?.email ?? r.user_id,
      fullName: profile?.full_name ?? null,
      role: r.role as TeamRole,
      joinedAt: r.joined_at,
    }
  })
}

export async function updateTeamName(teamId: string, name: string): Promise<void> {
  const { error } = await supabase
    .from('teams')
    .update({ name })
    .eq('id', teamId)

  if (error) throw new Error(`Failed to update team name: ${error.message}`)
}

export async function getMyRole(teamId: string, userId: string): Promise<TeamRole | null> {
  const { data, error } = await supabase
    .from('team_members')
    .select('role')
    .eq('team_id', teamId)
    .eq('user_id', userId)
    .single()

  if (error) return null
  return (data as Record<string, unknown>).role as TeamRole
}

export async function updateMemberRole(teamId: string, userId: string, role: TeamRole): Promise<void> {
  const { error } = await supabase
    .from('team_members')
    .update({ role })
    .eq('team_id', teamId)
    .eq('user_id', userId)

  if (error) throw new Error(`Failed to update member role: ${error.message}`)
}

export async function removeMember(teamId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('team_members')
    .delete()
    .eq('team_id', teamId)
    .eq('user_id', userId)

  if (error) throw new Error(`Failed to remove member: ${error.message}`)
}

export async function getTeamInvites(teamId: string): Promise<TeamInvite[]> {
  const { data, error } = await supabase
    .from('team_invites')
    .select('id, team_id, email, role, token, invited_by, created_at, expires_at, status')
    .eq('team_id', teamId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Failed to fetch team invites: ${error.message}`)

  const rows = (data ?? []) as Array<{
    id: string
    team_id: string
    email: string
    role: string
    token: string
    invited_by: string | null
    created_at: string
    expires_at: string
    status: string
  }>

  // Fetch profiles for invited_by users
  const inviterIds = [...new Set(rows.map((r) => r.invited_by).filter(Boolean))] as string[]
  const profileMap = new Map<string, string>()
  if (inviterIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email')
      .in('id', inviterIds)
    for (const p of (profiles ?? []) as Array<{ id: string; email: string }>) {
      profileMap.set(p.id, p.email)
    }
  }

  return rows.map((r) => ({
    id: r.id,
    teamId: r.team_id,
    email: r.email,
    role: r.role as TeamRole,
    token: r.token,
    invitedBy: r.invited_by,
    invitedByEmail: r.invited_by ? (profileMap.get(r.invited_by) ?? null) : null,
    createdAt: r.created_at,
    expiresAt: r.expires_at,
    status: r.status as TeamInvite['status'],
  }))
}

export async function createInvite(
  teamId: string,
  email: string,
  role: TeamRole,
  invitedBy: string
): Promise<TeamInvite> {
  const { data, error } = await supabase
    .from('team_invites')
    .insert({ team_id: teamId, email, role, invited_by: invitedBy })
    .select('id, team_id, email, role, token, invited_by, created_at, expires_at, status')
    .single()

  if (error) throw new Error(`Failed to create invite: ${error.message}`)

  const row = data as Record<string, unknown>
  return {
    id: row.id as string,
    teamId: row.team_id as string,
    email: row.email as string,
    role: row.role as TeamRole,
    token: row.token as string,
    invitedBy: row.invited_by as string | null,
    invitedByEmail: null,
    createdAt: row.created_at as string,
    expiresAt: row.expires_at as string,
    status: row.status as TeamInvite['status'],
  }
}

export async function revokeInvite(inviteId: string): Promise<void> {
  const { error } = await supabase
    .from('team_invites')
    .update({ status: 'revoked' })
    .eq('id', inviteId)

  if (error) throw new Error(`Failed to revoke invite: ${error.message}`)
}

export async function resendInvite(inviteId: string): Promise<TeamInvite> {
  const newExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from('team_invites')
    .update({ expires_at: newExpiry, status: 'pending' })
    .eq('id', inviteId)
    .select('id, team_id, email, role, token, invited_by, created_at, expires_at, status')
    .single()

  if (error) throw new Error(`Failed to resend invite: ${error.message}`)

  const row = data as Record<string, unknown>
  return {
    id: row.id as string,
    teamId: row.team_id as string,
    email: row.email as string,
    role: row.role as TeamRole,
    token: row.token as string,
    invitedBy: row.invited_by as string | null,
    invitedByEmail: null,
    createdAt: row.created_at as string,
    expiresAt: row.expires_at as string,
    status: row.status as TeamInvite['status'],
  }
}

export async function getInviteByToken(
  token: string
): Promise<(TeamInvite & { teamName: string }) | null> {
  const { data, error } = await supabase
    .from('team_invites')
    .select('id, team_id, email, role, token, invited_by, created_at, expires_at, status')
    .eq('token', token)
    .single()

  if (error || !data) return null

  const row = data as Record<string, unknown>

  // Fetch team name
  const { data: teamData } = await supabase
    .from('teams')
    .select('name')
    .eq('id', row.team_id as string)
    .single()

  const teamName = teamData ? (teamData as Record<string, unknown>).name as string : 'Unknown Team'

  return {
    id: row.id as string,
    teamId: row.team_id as string,
    email: row.email as string,
    role: row.role as TeamRole,
    token: row.token as string,
    invitedBy: row.invited_by as string | null,
    invitedByEmail: null,
    createdAt: row.created_at as string,
    expiresAt: row.expires_at as string,
    status: row.status as TeamInvite['status'],
    teamName,
  }
}

export async function acceptInvite(
  token: string,
  userId: string,
  userEmail: string
): Promise<{ teamId: string; role: TeamRole }> {
  // Get invite details
  const invite = await getInviteByToken(token)
  if (!invite) throw new Error('Invite not found')
  if (invite.status !== 'pending') throw new Error('Invite is no longer valid')

  const now = new Date()
  if (new Date(invite.expiresAt) < now) throw new Error('Invite has expired')

  // Check if already a member
  const { data: existing } = await supabase
    .from('team_members')
    .select('team_id')
    .eq('team_id', invite.teamId)
    .eq('user_id', userId)
    .single()

  if (!existing) {
    // Add to team
    const { error: memberError } = await supabase
      .from('team_members')
      .insert({ team_id: invite.teamId, user_id: userId, role: invite.role })

    if (memberError) throw new Error(`Failed to join team: ${memberError.message}`)
  }

  // Mark invite accepted
  await supabase
    .from('team_invites')
    .update({ status: 'accepted', accepted_by: userId })
    .eq('token', token)

  // Ensure profile exists
  await supabase
    .from('profiles')
    .upsert({ id: userId, email: userEmail }, { onConflict: 'id' })

  return { teamId: invite.teamId, role: invite.role }
}

export async function searchUserByEmail(
  email: string
): Promise<{ userId: string; email: string } | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email')
    .eq('email', email)
    .single()

  if (error || !data) return null
  const row = data as Record<string, unknown>
  return { userId: row.id as string, email: row.email as string }
}

export async function addMemberDirectly(
  teamId: string,
  userId: string,
  role: TeamRole
): Promise<void> {
  const { error } = await supabase
    .from('team_members')
    .insert({ team_id: teamId, user_id: userId, role })

  if (error) throw new Error(`Failed to add member: ${error.message}`)
}

export async function transferOwnership(
  teamId: string,
  currentOwnerId: string,
  newOwnerEmail: string
): Promise<void> {
  // Find new owner by email
  const newOwner = await searchUserByEmail(newOwnerEmail)
  if (!newOwner) throw new Error(`No user found with email: ${newOwnerEmail}`)

  // Set new owner's role to owner
  const { error: newOwnerErr } = await supabase
    .from('team_members')
    .update({ role: 'owner' })
    .eq('team_id', teamId)
    .eq('user_id', newOwner.userId)

  if (newOwnerErr) throw new Error(`Failed to set new owner: ${newOwnerErr.message}`)

  // Demote current owner to admin
  const { error: oldOwnerErr } = await supabase
    .from('team_members')
    .update({ role: 'admin' })
    .eq('team_id', teamId)
    .eq('user_id', currentOwnerId)

  if (oldOwnerErr) throw new Error(`Failed to update current owner role: ${oldOwnerErr.message}`)
}
