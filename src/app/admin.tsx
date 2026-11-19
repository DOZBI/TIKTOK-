import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, RefreshCw, ShieldAlert, Trash2, Users, Video, Eye, Globe } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { useVideoStore } from '../store/useVideoStore';

const ADMIN_API = '/.netlify/functions/admin';

type AdminUser = { id: string; email: string; username: string; displayName: string; createdAt: string };
type AdminVideo = {
  id: string;
  description: string;
  views_count: number;
  status: string;
  created_at: string;
  profiles?: { username?: string } | null;
};
type AdminDashboard = {
  metrics: { users: number; videos: number; views: number; uniqueVisitors: number; visits: number };
  users: AdminUser[];
  usersPage: number;
  usersHasNextPage: boolean;
  videos: AdminVideo[];
  videosPage: number;
  videosTotal: number;
};
type PendingDelete = { action: 'delete-user' | 'delete-video'; id: string; label: string };

async function readError(response: Response) {
  const body = await response.json().catch(() => ({}));
  return typeof body.error === 'string' ? body.error : 'La requête d’administration a échoué.';
}

export default function AdminPage() {
  const router = useRouter();
  const isLoggedIn = useVideoStore((state) => state.isLoggedIn);
  const setShowAuthModal = useVideoStore((state) => state.setShowAuthModal);
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [usersPage, setUsersPage] = useState(1);
  const [videosPage, setVideosPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (!supabase) throw new Error('Supabase n’est pas configuré.');
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Connecte-toi avec ton compte administrateur.');

      const query = new URLSearchParams({ usersPage: String(usersPage), videosPage: String(videosPage) });
      const response = await fetch(`${ADMIN_API}?${query}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!response.ok) throw new Error(await readError(response));
      setDashboard(await response.json());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Impossible de charger le tableau de bord.');
      setDashboard(null);
    } finally {
      setLoading(false);
    }
  }, [isLoggedIn, usersPage, videosPage]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const confirmDelete = async () => {
    if (!pendingDelete || !supabase) return;
    setWorking(true);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Ta session a expiré. Reconnecte-toi.');
      const response = await fetch(ADMIN_API, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: pendingDelete.action, id: pendingDelete.id }),
      });
      if (!response.ok) throw new Error(await readError(response));
      setPendingDelete(null);
      await loadDashboard();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'La suppression a échoué.');
    } finally {
      setWorking(false);
    }
  };

  return (
    <View className="flex-1 bg-black">
      <View className="flex-row items-center justify-between px-5 pt-14 pb-4 border-b border-zinc-800">
        <TouchableOpacity onPress={() => router.back()} className="flex-row items-center" accessibilityRole="button">
          <ArrowLeft size={20} color="#ffffff" />
          <Text className="text-white font-bold ml-2">Retour</Text>
        </TouchableOpacity>
        <Text className="text-white text-lg font-extrabold">Administration</Text>
        <TouchableOpacity onPress={() => void loadDashboard()} accessibilityRole="button" accessibilityLabel="Actualiser">
          <RefreshCw size={19} color="#ffffff" />
        </TouchableOpacity>
      </View>

      {loading && !dashboard ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#ff0050" size="large" />
          <Text className="text-zinc-400 mt-3">Chargement du tableau de bord…</Text>
        </View>
      ) : error && !dashboard ? (
        <View className="flex-1 items-center justify-center px-8">
          <ShieldAlert size={36} color="#ff0050" />
          <Text className="text-white text-center font-bold mt-4">Accès au tableau de bord impossible</Text>
          <Text className="text-zinc-400 text-center mt-2">{error}</Text>
          {(!isLoggedIn || /Connecte-toi|Session invalide/i.test(error)) ? (
            <TouchableOpacity onPress={() => setShowAuthModal(true)} className="mt-5 bg-[#ff0050] px-5 py-3 rounded-xl">
              <Text className="text-white font-bold">Ouvrir la connexion</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity onPress={() => void loadDashboard()} className="mt-5 bg-zinc-800 px-5 py-3 rounded-xl">
            <Text className="text-white font-bold">Réessayer</Text>
          </TouchableOpacity>
        </View>
      ) : dashboard ? (
        <ScrollView className="flex-1" contentContainerStyle={{ padding: 18, paddingBottom: 48 }}>
          {error ? <Text className="text-red-400 mb-4">{error}</Text> : null}

          <View className="flex-row flex-wrap gap-3 mb-5">
            <MetricCard icon={<Users size={18} color="#ffffff" />} label="Comptes" value={dashboard.metrics.users} />
            <MetricCard icon={<Video size={18} color="#ffffff" />} label="Vidéos" value={dashboard.metrics.videos} />
            <MetricCard icon={<Eye size={18} color="#ffffff" />} label="Vues totales" value={dashboard.metrics.views} />
            <MetricCard icon={<Globe size={18} color="#ffffff" />} label="Visiteurs uniques (IP hachées)" value={dashboard.metrics.uniqueVisitors} />
          </View>
          <Text className="text-zinc-500 text-xs mb-7">
            Les adresses IP brutes ne sont pas stockées. Une même IP peut représenter plusieurs personnes, et une personne peut changer d’IP. Visites enregistrées : {dashboard.metrics.visits.toLocaleString('fr-FR')}.
          </Text>

          <SectionTitle title="Utilisateurs" subtitle={`${dashboard.metrics.users.toLocaleString('fr-FR')} comptes`} />
          {dashboard.users.length === 0 ? <EmptyList text="Aucun utilisateur sur cette page." /> : dashboard.users.map((user) => (
            <View key={user.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 mb-2 flex-row items-center justify-between gap-3">
              <View className="flex-1 min-w-0">
                <Text className="text-white font-bold" numberOfLines={1}>{user.displayName || user.username || user.email || user.id}</Text>
                <Text className="text-zinc-400 text-xs mt-1" numberOfLines={1}>{user.email || user.username || user.id}</Text>
              </View>
              <TouchableOpacity onPress={() => setPendingDelete({ action: 'delete-user', id: user.id, label: user.email || user.username || user.id })} className="p-2" accessibilityRole="button" accessibilityLabel={`Supprimer ${user.email}`}>
                <Trash2 size={19} color="#fb7185" />
              </TouchableOpacity>
            </View>
          ))}
          <Pagination page={usersPage} hasNext={dashboard.usersHasNextPage} onChange={setUsersPage} />

          <View className="mt-9">
            <SectionTitle title="Vidéos" subtitle={`${dashboard.videosTotal.toLocaleString('fr-FR')} vidéos`} />
            {dashboard.videos.length === 0 ? <EmptyList text="Aucune vidéo sur cette page." /> : dashboard.videos.map((video) => (
              <View key={video.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 mb-2 flex-row items-center justify-between gap-3">
                <View className="flex-1 min-w-0">
                  <Text className="text-white font-semibold" numberOfLines={2}>{video.description || 'Vidéo sans description'}</Text>
                  <Text className="text-zinc-400 text-xs mt-1" numberOfLines={1}>
                    @{video.profiles?.username || 'utilisateur'} · {video.views_count.toLocaleString('fr-FR')} vues · {video.status}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setPendingDelete({ action: 'delete-video', id: video.id, label: video.description || video.id })} className="p-2" accessibilityRole="button" accessibilityLabel="Supprimer cette vidéo">
                  <Trash2 size={19} color="#fb7185" />
                </TouchableOpacity>
              </View>
            ))}
            <Pagination
              page={videosPage}
              hasNext={videosPage * 20 < dashboard.videosTotal}
              onChange={setVideosPage}
            />
          </View>
        </ScrollView>
      ) : null}

      <Modal transparent visible={Boolean(pendingDelete)} animationType="fade" onRequestClose={() => setPendingDelete(null)}>
        <View className="flex-1 bg-black/75 justify-center px-6">
          <View className="bg-zinc-900 border border-zinc-700 rounded-2xl p-5">
            <Text className="text-white text-lg font-extrabold">Confirmer la suppression</Text>
            <Text className="text-zinc-300 mt-3">
              {pendingDelete?.action === 'delete-user' ? 'Supprimer définitivement le compte et ses vidéos ?' : 'Supprimer définitivement cette vidéo ?'}
            </Text>
            <Text className="text-zinc-500 text-xs mt-2" numberOfLines={2}>{pendingDelete?.label}</Text>
            <View className="flex-row justify-end gap-3 mt-6">
              <TouchableOpacity disabled={working} onPress={() => setPendingDelete(null)} className="px-4 py-3 rounded-xl bg-zinc-800">
                <Text className="text-white font-bold">Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity disabled={working} onPress={() => void confirmDelete()} className="px-4 py-3 rounded-xl bg-rose-600 flex-row items-center gap-2">
                {working ? <ActivityIndicator size="small" color="#ffffff" /> : <Trash2 size={16} color="#ffffff" />}
                <Text className="text-white font-bold">Supprimer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function MetricCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <View className="w-[48%] flex-grow bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <View className="flex-row items-center gap-2">{icon}<Text className="text-zinc-300 text-xs flex-1">{label}</Text></View>
      <Text className="text-white text-2xl font-extrabold mt-3">{value.toLocaleString('fr-FR')}</Text>
    </View>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View className="flex-row items-end justify-between mb-3">
      <Text className="text-white text-lg font-extrabold">{title}</Text>
      <Text className="text-zinc-500 text-xs">{subtitle}</Text>
    </View>
  );
}

function EmptyList({ text }: { text: string }) {
  return <Text className="text-zinc-500 text-sm py-4">{text}</Text>;
}

function Pagination({ page, hasNext, onChange }: { page: number; hasNext: boolean; onChange: (page: number) => void }) {
  return (
    <View className="flex-row items-center justify-end gap-3 mt-3">
      <TouchableOpacity disabled={page <= 1} onPress={() => onChange(page - 1)} className={`px-3 py-2 rounded-lg ${page <= 1 ? 'bg-zinc-950' : 'bg-zinc-800'}`}>
        <Text className={page <= 1 ? 'text-zinc-700' : 'text-white'}>Précédent</Text>
      </TouchableOpacity>
      <Text className="text-zinc-400 text-xs">Page {page}</Text>
      <TouchableOpacity disabled={!hasNext} onPress={() => onChange(page + 1)} className={`px-3 py-2 rounded-lg ${hasNext ? 'bg-zinc-800' : 'bg-zinc-950'}`}>
        <Text className={hasNext ? 'text-white' : 'text-zinc-700'}>Suivant</Text>
      </TouchableOpacity>
    </View>
  );
}
