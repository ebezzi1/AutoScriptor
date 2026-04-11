import { supabase } from '../supabase'
import type { Feature } from '../../types'
import { toTestStep, fromTestStep, checkError } from './mapper'

// ── DB → App ─────────────────────────────────────────────────────────────────

export function toFeature(
  row: Record<string, unknown>,
  beforeEachSteps: ReturnType<typeof toTestStep>[],
  afterEachSteps: ReturnType<typeof toTestStep>[]
): Feature {
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    name: row.name as string,
    description: (row.description as string) ?? '',
    tags: (row.tags as string[]) ?? [],
    beforeEachSteps,
    afterEachSteps,
  }
}

function fromFeature(feature: Feature): Record<string, unknown> {
  return {
    id: feature.id,
    project_id: feature.projectId,
    name: feature.name,
    description: feature.description,
    tags: feature.tags,
  }
}

// ── CRUD ─────────────────────────────────────────────────────────────────────

export async function createFeature(feature: Feature): Promise<void> {
  checkError(await supabase.from('features').insert(fromFeature(feature)))
  await upsertSetupSteps(feature)
}

export async function updateFeature(feature: Feature): Promise<void> {
  const { error } = await supabase
    .from('features')
    .update(fromFeature(feature))
    .eq('id', feature.id)
  checkError({ error })
  await upsertSetupSteps(feature)
}

export async function deleteFeature(featureId: string): Promise<void> {
  checkError(await supabase.from('features').delete().eq('id', featureId))
}

async function upsertSetupSteps(feature: Feature): Promise<void> {
  await supabase.from('feature_setup_steps').delete().eq('feature_id', feature.id)

  const rows = [
    ...feature.beforeEachSteps.map((s) =>
      fromTestStep(s, 'feature_id', feature.id, { hook: 'before_each' })
    ),
    ...feature.afterEachSteps.map((s) =>
      fromTestStep(s, 'feature_id', feature.id, { hook: 'after_each' })
    ),
  ]

  if (rows.length > 0) {
    checkError(await supabase.from('feature_setup_steps').insert(rows))
  }
}
