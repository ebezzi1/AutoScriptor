import { supabase } from '../supabase'
import type { GlobalVariable } from '../../types'
import { checkError } from './mapper'

export function toVariable(row: Record<string, unknown>): GlobalVariable {
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    key: row.key as string,
    value: (row.value as string) ?? '',
    scope: (row.scope as 'project' | 'feature') ?? 'project',
    featureId: (row.feature_id as string | null) ?? undefined,
    sensitive: (row.sensitive as boolean) ?? false,
    environmentId: (row.environment_id as string | null) ?? null,
  }
}

function fromVariable(v: GlobalVariable): Record<string, unknown> {
  return {
    id: v.id,
    project_id: v.projectId,
    key: v.key,
    value: v.value,
    scope: v.scope,
    feature_id: v.featureId ?? null,
    sensitive: v.sensitive,
    environment_id: v.environmentId ?? null,
  }
}

export async function createVariable(v: GlobalVariable): Promise<void> {
  checkError(await supabase.from('variables').insert(fromVariable(v)))
}

export async function updateVariable(v: GlobalVariable): Promise<void> {
  checkError(await supabase.from('variables').update(fromVariable(v)).eq('id', v.id))
}

export async function deleteVariable(varId: string): Promise<void> {
  checkError(await supabase.from('variables').delete().eq('id', varId))
}
