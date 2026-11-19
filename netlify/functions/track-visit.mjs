import { createHmac } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

export default async (request, context) => {
  if (request.method !== 'POST') return new Response(null, { status: 405 });
  const ipAddress = context.ip;
  const hashSecret = process.env.VISITOR_HASH_SECRET;
  const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

  if (!ipAddress || !hashSecret || !supabaseUrl || !serviceKey) {
    return new Response(null, { status: 204 });
  }

  const ipHash = createHmac('sha256', hashSecret).update(ipAddress).digest('hex');
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const { error } = await supabase.rpc('record_platform_visit', { visitor_hash_input: ipHash });

  if (error) {
    console.error('Visitor counter update failed:', error.message);
    return new Response(null, { status: 204 });
  }

  return new Response(null, { status: 204 });
};
