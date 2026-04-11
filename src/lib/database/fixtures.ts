import { supabase } from '../supabase'
import type { Fixture } from '../../types'
import { checkError } from './mapper'

export function toFixture(row: Record<string, unknown>): Fixture {
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    name: row.name as string,
    data: (row.data as Record<string, unknown>[]) ?? [],
    environmentId: (row.environment_id as string | null) ?? null,
  }
}

function fromFixture(fx: Fixture): Record<string, unknown> {
  return {
    id: fx.id,
    project_id: fx.projectId,
    name: fx.name,
    data: fx.data,
    environment_id: fx.environmentId ?? null,
  }
}

export async function createFixture(fx: Fixture): Promise<void> {
  checkError(await supabase.from('fixtures').insert(fromFixture(fx)))
}

export async function updateFixture(fx: Fixture): Promise<void> {
  checkError(await supabase.from('fixtures').update(fromFixture(fx)).eq('id', fx.id))
}

export async function deleteFixture(fixtureId: string): Promise<void> {
  checkError(await supabase.from('fixtures').delete().eq('id', fixtureId))
}
