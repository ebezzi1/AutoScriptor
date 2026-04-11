import { supabase } from '../supabase'
import type { StepTemplate } from '../stepTemplates'
import { checkError } from './mapper'

export function toTemplate(row: Record<string, unknown>): StepTemplate {
  return {
    id: row.id as string,
    name: row.name as string,
    description: (row.description as string) ?? '',
    steps: (row.steps as StepTemplate['steps']) ?? [],
    builtin: (row.is_builtin as boolean) ?? false,
    createdAt: row.created_at as string,
  }
}

function fromTemplate(t: StepTemplate, projectId: string): Record<string, unknown> {
  return {
    id: t.id,
    project_id: projectId,
    name: t.name,
    description: t.description,
    steps: t.steps,
    is_builtin: false,
    created_at: t.createdAt || new Date().toISOString(),
  }
}

export async function getTemplates(projectId: string): Promise<StepTemplate[]> {
  const { data, error } = await supabase
    .from('step_templates')
    .select('*')
    .eq('project_id', projectId)
    .eq('is_builtin', false)
  if (error) throw new Error(error.message)
  return (data ?? []).map(toTemplate)
}

export async function upsertTemplate(projectId: string, template: StepTemplate): Promise<void> {
  checkError(
    await supabase
      .from('step_templates')
      .upsert(fromTemplate(template, projectId))
  )
}

export async function removeTemplate(templateId: string): Promise<void> {
  checkError(await supabase.from('step_templates').delete().eq('id', templateId))
}
