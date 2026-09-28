import { supabase } from './supabase';

export async function deleteMemberAccount(): Promise<void> {
  if (!supabase) throw new Error('Member services are not configured.');
  const { data, error } = await supabase.functions.invoke<{ ok: boolean; error?: string }>('delete-account', { body: { confirm: true } });
  if (error) throw new Error(error.message || 'Account deletion failed.');
  if (!data?.ok) throw new Error(data?.error || 'Account deletion failed.');
  await supabase.auth.signOut({ scope: 'local' });
}