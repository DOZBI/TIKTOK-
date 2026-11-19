import { supabase } from './supabase';

export async function getOrCreateConversation(recipientId: string): Promise<string> {
  if (!supabase) throw new Error('La messagerie nécessite une configuration Supabase.');
  const { data, error } = await supabase.rpc('get_or_create_direct_conversation', {
    target_user_id: recipientId,
  });
  if (error) throw error;
  if (!data) throw new Error('Impossible de créer la conversation.');
  return data as string;
}
