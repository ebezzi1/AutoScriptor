import { supabase } from '../supabase'
import type { AppState } from '../../types'
import { checkError } from './mapper'

export interface Snapshot {
  id: string
  projectId: string
  name: string
  state: Omit<AppState, 'currentView'>
  createdAt: string
}

function toSnapshot(row: Record<string, unknown>): Snapshot {
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    name: row.name as string,
    state: row.state as Omit<AppState, 'currentView'>,
    createdAt: row.created_at as string,
  }
}

export async function getSnapshots(projectId: string): Promise<Snapshot[]> {
  const { data, error } = await supabase
    .from('snapshots')
    .select('id, project_id, name, created_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map(toSnapshot)
}

export async function getSnapshot(snapshotId: string): Promise<Snapshot | null> {
  const { data, error } = await supabase
    .from('snapshots')
    .select('*')
    .eq('id', snapshotId)
    .single()
  if (error) return null
  return toSnapshot(data)
}

export async function createSnapshot(
  projectId: string,
  name: string,
  state: Omit<AppState, 'currentView'>
): Promise<Snapshot> {
  const { data, error } = await supabase
    .from('snapshots')
    .insert({ project_id: projectId, name, state })
    .select()
    .single()
  checkError({ error })
  return toSnapshot(data)
}

export async function deleteSnapshot(snapshotId: string): Promise<void> {
  checkError(await supabase.from('snapshots').delete().eq('id', snapshotId))
}
