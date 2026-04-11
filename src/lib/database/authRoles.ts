// Auth roles are managed as part of project updates (see projects.ts).
// This file exposes standalone fetch if needed by other parts of the app.
import { supabase } from '../supabase'
import type { AuthRole } from '../../types'
import { toTestStep } from './mapper'
import { toAuthRole } from './projects'

export { toAuthRole }

export async function getAuthRoles(projectId: string): Promise<AuthRole[]> {
  const { data: roleRows, error: roleErr } = await supabase
    .from('auth_roles')
    .select('*')
    .eq('project_id', projectId)
  if (roleErr) throw new Error(roleErr.message)

  const roleIds = (roleRows ?? []).map((r: Record<string, unknown>) => r.id as string)
  if (roleIds.length === 0) return []

  const { data: stepRows, error: stepErr } = await supabase
    .from('auth_role_steps')
    .select('*')
    .in('auth_role_id', roleIds)
    .order('sort_order')
  if (stepErr) throw new Error(stepErr.message)

  return (roleRows ?? []).map((r: Record<string, unknown>) => {
    const loginSteps = (stepRows ?? [])
      .filter((s: Record<string, unknown>) => s.role_id === r.id)
      .map(toTestStep)
    return toAuthRole(r, loginSteps)
  })
}
