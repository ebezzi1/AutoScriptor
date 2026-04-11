// Environments are managed as part of project updates (see projects.ts).
// This file exposes standalone fetch if needed by other parts of the app.
import { supabase } from '../supabase'
import type { EnvProfile } from '../../types'
import { toEnvProfile } from './projects'

export { toEnvProfile }

export async function getEnvironments(projectId: string): Promise<EnvProfile[]> {
  const { data, error } = await supabase
    .from('environments')
    .select('*')
    .eq('project_id', projectId)
  if (error) throw new Error(error.message)
  return (data ?? []).map(toEnvProfile)
}
