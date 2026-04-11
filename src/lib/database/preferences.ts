import { supabase } from '../supabase'

export async function getPreference(userId: string, key: string): Promise<string | null> {
  const { data } = await supabase
    .from('user_preferences')
    .select('value')
    .eq('user_id', userId)
    .eq('key', key)
    .maybeSingle()
  return data ? (data as Record<string, unknown>).value as string : null
}

export async function setPreference(
  userId: string,
  key: string,
  value: string
): Promise<void> {
  const { error } = await supabase
    .from('user_preferences')
    .upsert({ user_id: userId, key, value }, { onConflict: 'user_id,key' })
  if (error) throw new Error(error.message)
}

export async function deletePreference(userId: string, key: string): Promise<void> {
  await supabase.from('user_preferences').delete().eq('user_id', userId).eq('key', key)
}
