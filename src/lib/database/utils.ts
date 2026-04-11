import { supabase } from '../supabase'
import type { ReusableUtil, UtilParameter } from '../../types'
import { toTestStep, fromTestStep, checkError } from './mapper'

export function toUtil(
  row: Record<string, unknown>,
  steps: ReturnType<typeof toTestStep>[]
): ReusableUtil {
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    name: row.name as string,
    description: (row.description as string) ?? '',
    parameters: (row.parameters as UtilParameter[]) ?? [],
    steps,
    environmentId: (row.environment_id as string | null) ?? null,
  }
}

function fromUtil(u: ReusableUtil): Record<string, unknown> {
  return {
    id: u.id,
    project_id: u.projectId,
    name: u.name,
    description: u.description,
    parameters: u.parameters,
    environment_id: u.environmentId ?? null,
  }
}

export async function createUtil(u: ReusableUtil): Promise<void> {
  checkError(await supabase.from('utils').insert(fromUtil(u)))
  await upsertUtilSteps(u)
}

export async function updateUtil(u: ReusableUtil): Promise<void> {
  checkError(await supabase.from('utils').update(fromUtil(u)).eq('id', u.id))
  await upsertUtilSteps(u)
}

export async function deleteUtil(utilId: string): Promise<void> {
  checkError(await supabase.from('utils').delete().eq('id', utilId))
}

async function upsertUtilSteps(u: ReusableUtil): Promise<void> {
  await supabase.from('util_steps').delete().eq('util_id', u.id)
  if (u.steps.length > 0) {
    checkError(
      await supabase
        .from('util_steps')
        .insert(u.steps.map((s) => fromTestStep(s, 'util_id', u.id)))
    )
  }
}
