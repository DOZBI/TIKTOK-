import { createClient } from '@supabase/supabase-js';

const PAGE_SIZE = 20;
const json = (body, status = 200) => Response.json(body, { status });

function getBackend() {
  const url = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('La configuration serveur Supabase est incomplète.');
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

function getAdminIds() {
  return new Set((process.env.ADMIN_USER_IDS || '').split(',').map((id) => id.trim()).filter(Boolean));
}

async function listStorageFiles(supabase, bucket, prefix) {
  const storage = supabase.storage.from(bucket);
  const files = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await storage.list(prefix, { limit: 1000, offset });
    if (error) throw error;
    for (const item of data || []) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id) files.push(path);
      else files.push(...await listStorageFiles(supabase, bucket, path));
    }
    if (!data || data.length < 1000) break;
  }
  return files;
}

async function removeStorageFiles(supabase, bucket, paths) {
  const uniquePaths = [...new Set(paths.filter(Boolean))];
  const storage = supabase.storage.from(bucket);
  for (let offset = 0; offset < uniquePaths.length; offset += 100) {
    const { error } = await storage.remove(uniquePaths.slice(offset, offset + 100));
    if (error) throw error;
  }
}

async function requireAdmin(request, supabase) {
  const adminIds = getAdminIds();
  if (adminIds.size === 0) return { error: 'ADMIN_USER_IDS n’est pas configuré.', status: 503 };

  const token = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return { error: 'Connecte-toi avec un compte administrateur.', status: 401 };

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return { error: 'Session invalide. Reconnecte-toi.', status: 401 };
  if (!adminIds.has(data.user.id)) return { error: 'Accès réservé aux administrateurs.', status: 403 };

  return { user: data.user, adminIds };
}

async function getDashboard(supabase, url) {
  const usersPage = Math.max(1, Number.parseInt(url.searchParams.get('usersPage') || '1', 10) || 1);
  const videosPage = Math.max(1, Number.parseInt(url.searchParams.get('videosPage') || '1', 10) || 1);
  const [metricsResult, usersResult, videosResult] = await Promise.all([
    supabase.rpc('admin_metrics'),
    supabase.auth.admin.listUsers({ page: usersPage, perPage: PAGE_SIZE }),
    supabase.from('videos')
      .select('id,author_id,description,views_count,status,created_at,storage_path,hls_url,profiles:author_id(username)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((videosPage - 1) * PAGE_SIZE, videosPage * PAGE_SIZE - 1),
  ]);

  if (metricsResult.error || usersResult.error || videosResult.error) {
    const error = metricsResult.error || usersResult.error || videosResult.error;
    return json({ error: error.message }, 500);
  }

  const authUsers = usersResult.data.users || [];
  const profileIds = authUsers.map((user) => user.id);
  const profilesResult = profileIds.length
    ? await supabase.from('profiles').select('id,username,display_name').in('id', profileIds)
    : { data: [], error: null };
  if (profilesResult.error) return json({ error: profilesResult.error.message }, 500);

  const profiles = new Map((profilesResult.data || []).map((profile) => [profile.id, profile]));
  return json({
    metrics: metricsResult.data,
    users: authUsers.map((user) => ({
      id: user.id,
      email: user.email || '',
      createdAt: user.created_at,
      username: profiles.get(user.id)?.username || user.user_metadata?.username || '',
      displayName: profiles.get(user.id)?.display_name || user.user_metadata?.display_name || '',
    })),
    usersPage,
    usersHasNextPage: usersPage * PAGE_SIZE < Number(metricsResult.data.users || 0),
    videos: videosResult.data || [],
    videosPage,
    videosTotal: videosResult.count || 0,
  });
}

async function deleteUser(supabase, targetId, actingAdminId, adminIds) {
  if (!targetId) return json({ error: 'Identifiant utilisateur manquant.' }, 400);
  if (targetId === actingAdminId || adminIds.has(targetId)) {
    return json({ error: 'La suppression d’un compte administrateur est bloquée ici.' }, 400);
  }

  const [{ data: videos, error: videosError }, { data: profile, error: profileError }] = await Promise.all([
    supabase.from('videos').select('id,storage_path,hls_url').eq('author_id', targetId),
    supabase.from('profiles').select('avatar_url').eq('id', targetId).maybeSingle(),
  ]);
  if (videosError || profileError) return json({ error: (videosError || profileError).message }, 500);

  try {
    const videoFiles = await listStorageFiles(supabase, 'videos', targetId);
    const avatarFiles = await listStorageFiles(supabase, 'avatars', targetId);
    const hlsFiles = (await Promise.all((videos || []).filter((video) => video.hls_url).map((video) => listStorageFiles(supabase, 'videos', `hls/${video.id}`)))).flat();
    await removeStorageFiles(supabase, 'videos', [
      ...videoFiles,
      ...hlsFiles,
      ...(videos || []).map((video) => video.storage_path),
    ]);
    await removeStorageFiles(supabase, 'avatars', [
      ...avatarFiles,
      profile?.avatar_url?.match(/\/storage\/v1\/object\/public\/avatars\/(.+?)(?:\?|$)/)?.[1],
    ]);
  } catch (error) {
    return json({ error: `Les fichiers Storage n’ont pas pu être supprimés : ${error.message}` }, 500);
  }

  const { error } = await supabase.auth.admin.deleteUser(targetId);
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
}

async function deleteVideo(supabase, targetId) {
  if (!targetId) return json({ error: 'Identifiant vidéo manquant.' }, 400);
  const { data: video, error: selectError } = await supabase
    .from('videos').select('id,storage_path,hls_url').eq('id', targetId).maybeSingle();
  if (selectError) return json({ error: selectError.message }, 500);
  if (!video) return json({ error: 'Vidéo introuvable.' }, 404);

  try {
    const hlsFiles = video.hls_url ? await listStorageFiles(supabase, 'videos', `hls/${video.id}`) : [];
    await removeStorageFiles(supabase, 'videos', [video.storage_path, ...hlsFiles]);
  } catch (error) {
    return json({ error: `Les fichiers de la vidéo n’ont pas pu être supprimés : ${error.message}` }, 500);
  }

  const { error } = await supabase.from('videos').delete().eq('id', targetId);
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
}

export default async (request) => {
  let supabase;
  try {
    supabase = getBackend();
  } catch (error) {
    return json({ error: error.message }, 503);
  }

  const access = await requireAdmin(request, supabase);
  if (access.error) return json({ error: access.error }, access.status);

  if (request.method === 'GET') return getDashboard(supabase, new URL(request.url));
  if (request.method !== 'POST') return json({ error: 'Méthode non prise en charge.' }, 405);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Corps de requête invalide.' }, 400);
  }

  if (body?.action === 'delete-user') {
    return deleteUser(supabase, body.id, access.user.id, access.adminIds);
  }
  if (body?.action === 'delete-video') return deleteVideo(supabase, body.id);
  return json({ error: 'Action inconnue.' }, 400);
};
