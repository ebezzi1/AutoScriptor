import { supabase } from '../supabase'

/**
 * Ensures the authenticated user belongs to a team.
 * If no membership exists, creates a team + adds the user as owner.
 * Returns the team_id.
 *
 * Required Supabase RLS policies (run in SQL editor if team creation fails):
 *
 *   -- Anyone authenticated can create a team (breaks the chicken-and-egg)
 *   CREATE POLICY "Anyone can create a team"
 *     ON teams FOR INSERT
 *     TO authenticated
 *     WITH CHECK (true);
 *
 *   -- Users can read teams they belong to
 *   CREATE POLICY "Members can view their team"
 *     ON teams FOR SELECT
 *     TO authenticated
 *     USING (id IN (
 *       SELECT team_id FROM team_members WHERE user_id = auth.uid()
 *     ));
 *
 *   -- Users can add themselves to a team
 *   CREATE POLICY "Users can add themselves as members"
 *     ON team_members FOR INSERT
 *     TO authenticated
 *     WITH CHECK (user_id = auth.uid());
 *
 *   -- Users can read their own memberships
 *   CREATE POLICY "Users can view own memberships"
 *     ON team_members FOR SELECT
 *     TO authenticated
 *     USING (user_id = auth.uid());
 */
export async function ensureTeam(userId: string): Promise<string> {
  console.log('[ensureTeam] Checking team membership for user:', userId)

  // ── 1. Check for existing membership ──────────────────────────────────────
  const { data: memberships, error: memberErr } = await supabase
    .from('team_members')
    .select('team_id')
    .eq('user_id', userId)
    .limit(1)

  if (memberErr) {
    console.error('[ensureTeam] ❌ Failed to query team_members:', memberErr.message, memberErr)
    throw new Error(`team_members query failed: ${memberErr.message}`)
  }

  if (memberships && memberships.length > 0) {
    const teamId = (memberships[0] as Record<string, unknown>).team_id as string
    console.log('[ensureTeam] ✅ Found existing team:', teamId)
    return teamId
  }

  // ── 2. No team — create one ───────────────────────────────────────────────
  console.log('[ensureTeam] No team found — creating new workspace for user:', userId)

  const { data: team, error: teamErr } = await supabase
    .from('teams')
    .insert({ name: 'My Workspace' })
    .select('id')
    .single()

  if (teamErr) {
    console.error(
      '[ensureTeam] ❌ Failed to create team — check RLS policy "Anyone can create a team" on teams table:',
      teamErr.message,
      teamErr
    )
    throw new Error(`Failed to create team: ${teamErr.message}`)
  }

  const teamId = (team as Record<string, unknown>).id as string
  console.log('[ensureTeam] ✅ Created team:', teamId)

  // ── 3. Add user as owner ──────────────────────────────────────────────────
  const { error: ownerErr } = await supabase
    .from('team_members')
    .insert({ team_id: teamId, user_id: userId, role: 'owner' })

  if (ownerErr) {
    console.error(
      '[ensureTeam] ❌ Failed to add user to team_members — check RLS policy "Users can add themselves as members":',
      ownerErr.message,
      ownerErr
    )
    throw new Error(`Failed to add user to team: ${ownerErr.message}`)
  }

  console.log('[ensureTeam] ✅ Added user as owner of team:', teamId)
  return teamId
}
