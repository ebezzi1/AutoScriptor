// Test dependencies are managed inline in testCases.ts upsertChildren.
// This file exposes standalone fetch if needed.
import { supabase } from '../supabase'

export async function getDependencies(testCaseId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('test_dependencies')
    .select('depends_on_id')
    .eq('test_case_id', testCaseId)
  if (error) throw new Error(error.message)
  return (data ?? []).map((r: Record<string, unknown>) => r.depends_on_id as string)
}

export async function setDependencies(
  testCaseId: string,
  dependsOnIds: string[]
): Promise<void> {
  await supabase.from('test_dependencies').delete().eq('test_case_id', testCaseId)
  if (dependsOnIds.length > 0) {
    const { error } = await supabase.from('test_dependencies').insert(
      dependsOnIds.map((id) => ({ test_case_id: testCaseId, depends_on_id: id }))
    )
    if (error) throw new Error(error.message)
  }
}
