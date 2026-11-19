import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Send, Users, X, ChevronLeft, Radio } from 'lucide-react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { supabase } from '../lib/supabase';

type LiveStream = { id: string; host_id: string; title: string; playback_url: string | null; viewer_count: number; profiles?: { username: string; avatar_url: string | null } | null };
type LiveComment = { id: string; author_id: string; body: string; created_at: string; username: string; avatar_url: string | null };

interface LiveStreamModalProps { isVisible: boolean; onClose: () => void }

export default function LiveStreamModal({ isVisible, onClose }: LiveStreamModalProps) {
  const [streams, setStreams] = useState<LiveStream[]>([]);
  const [selected, setSelected] = useState<LiveStream | null>(null);
  const [comments, setComments] = useState<LiveComment[]>([]);
  const [input, setInput] = useState('');
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const commentsRef = useRef<ScrollView>(null);
  const player = useVideoPlayer(null);

  const loadStreams = useCallback(async () => {
    if (!supabase) { setError('Les lives nécessitent une configuration Supabase.'); return; }
    setLoading(true);
    setError('');
    const [{ data: auth }, { data, error: queryError }] = await Promise.all([
      supabase.auth.getUser(),
      supabase.from('live_streams').select('id,host_id,title,playback_url,viewer_count,profiles:host_id(username,avatar_url)').eq('status', 'live').order('started_at', { ascending: false }),
    ]);
    if (queryError) setError(queryError.message);
    setUserId(auth.user?.id ?? '');
    const actualStreams = (data ?? []) as unknown as LiveStream[];
    setStreams(actualStreams);
    setSelected((current) => current ? actualStreams.find((stream) => stream.id === current.id) ?? null : null);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!isVisible) return;
    void loadStreams();
    if (!supabase) return;
    const channel = supabase.channel('live-stream-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_streams' }, () => { void loadStreams(); })
      .subscribe();
    return () => { void supabase?.removeChannel(channel); };
  }, [isVisible, loadStreams]);

  useEffect(() => {
    let cancelled = false;
    if (!selected?.playback_url || !isVisible) { player.pause(); return; }
    void player.replaceAsync(selected.playback_url).then(() => { if (!cancelled) player.play(); }).catch(() => setError('Le lecteur ne peut pas ouvrir le flux de ce live.'));
    return () => { cancelled = true; player.pause(); };
  }, [isVisible, player, selected?.id, selected?.playback_url]);

  useEffect(() => {
    if (!supabase || !selected) { setComments([]); return; }
    let cancelled = false;
    const loadComments = async () => {
      const { data } = await supabase!.from('live_messages').select('id,author_id,body,created_at').eq('stream_id', selected.id).order('created_at', { ascending: true }).limit(100);
      const rows = data ?? [];
      const authorIds = [...new Set(rows.map((row) => row.author_id))];
      const { data: profiles } = authorIds.length ? await supabase!.from('profiles').select('id,username,avatar_url').in('id', authorIds) : { data: [] };
      const byId = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
      if (!cancelled) setComments(rows.map((row) => ({ ...row, username: byId.get(row.author_id)?.username ?? 'Utilisateur', avatar_url: byId.get(row.author_id)?.avatar_url ?? null })));
    };
    void loadComments();
    const channel = supabase.channel(`live-chat:${selected.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'live_messages', filter: `stream_id=eq.${selected.id}` }, async (payload) => {
        const row = payload.new as { id: string; author_id: string; body: string; created_at: string };
        const { data: profile } = await supabase!.from('profiles').select('username,avatar_url').eq('id', row.author_id).maybeSingle();
        setComments((current) => current.some((comment) => comment.id === row.id) ? current : [...current, { ...row, username: profile?.username ?? 'Utilisateur', avatar_url: profile?.avatar_url ?? null }]);
        requestAnimationFrame(() => commentsRef.current?.scrollToEnd({ animated: true }));
      }).subscribe();
    return () => { cancelled = true; void supabase?.removeChannel(channel); };
  }, [selected?.id]);

  const sendComment = async () => {
    const body = input.trim();
    if (!supabase || !selected || !userId || !body) return;
    const { error: sendError } = await supabase.from('live_messages').insert({ stream_id: selected.id, author_id: userId, body });
    if (sendError) setError(sendError.message);
    else setInput('');
  };

  const close = () => { player.pause(); setSelected(null); setError(''); onClose(); };

  return (
    <Modal visible={isVisible} animationType="slide" onRequestClose={close}>
      <View className="flex-1 bg-black">
        <View className="pt-14 pb-3 px-4 flex-row items-center justify-between border-b border-zinc-800">
          {selected ? <TouchableOpacity onPress={() => { player.pause(); setSelected(null); }} className="flex-row items-center"><ChevronLeft size={22} color="#fff" /><Text className="text-white ml-1">Lives en cours</Text></TouchableOpacity> : <View className="flex-row items-center"><Radio size={18} color="#ff315b" /><Text className="text-white font-extrabold text-lg ml-2">Lives en cours</Text></View>}
          <TouchableOpacity onPress={close} className="p-2"><X size={24} color="#fff" /></TouchableOpacity>
        </View>

        {loading ? <View className="flex-1 items-center justify-center"><ActivityIndicator color="#ff0050" /></View> : selected ? (
          <View className="flex-1">
            {selected.playback_url ? <VideoView player={player} style={{ width: '100%', height: '57%' }} contentFit="cover" nativeControls={false} surfaceType="textureView" /> : <View className="h-[57%] bg-zinc-900 items-center justify-center px-8"><Radio size={34} color="#ff315b" /><Text className="text-zinc-200 text-center mt-3">Le flux vidéo n’est pas disponible pour ce live.</Text></View>}
            <View className="px-4 py-3 border-b border-zinc-800 flex-row items-center justify-between">
              <View className="flex-1 mr-3"><Text className="text-white font-bold" numberOfLines={1}>{selected.title}</Text><Text className="text-zinc-400 text-xs mt-1">@{selected.profiles?.username ?? 'Utilisateur'}</Text></View>
              <View className="flex-row items-center"><Users size={14} color="#bbb" /><Text className="text-zinc-300 text-xs ml-1">{selected.viewer_count}</Text></View>
            </View>
            {error ? <Text className="text-red-300 px-4 py-2 text-xs">{error}</Text> : null}
            <ScrollView ref={commentsRef} className="flex-1 px-4 py-3" keyboardShouldPersistTaps="handled">
              {comments.map((comment) => <View key={comment.id} className="flex-row items-start mb-3"><Image source={comment.avatar_url ? { uri: comment.avatar_url } : undefined} className="w-7 h-7 rounded-full mr-2 bg-zinc-800" /><Text className="flex-1 text-white text-sm"><Text className="text-zinc-400 font-bold">{comment.username} </Text>{comment.body}</Text></View>)}
            </ScrollView>
            <View className="px-3 py-3 border-t border-zinc-800 flex-row items-center"><TextInput value={input} onChangeText={setInput} maxLength={500} placeholder={userId ? 'Écrire un commentaire…' : 'Connecte-toi pour commenter'} placeholderTextColor="#777" editable={Boolean(userId)} onSubmitEditing={() => void sendComment()} className="flex-1 rounded-full bg-zinc-900 text-white px-4 py-3 mr-2" /><TouchableOpacity onPress={() => void sendComment()} disabled={!input.trim() || !userId} className="p-3"><Send size={20} color={input.trim() && userId ? '#ff315b' : '#666'} /></TouchableOpacity></View>
          </View>
        ) : (
          <ScrollView className="flex-1 px-4 pt-4" contentContainerStyle={{ paddingBottom: 30 }}>
            {error ? <Text className="text-red-300 text-center mt-8">{error}</Text> : null}
            {!error && streams.length === 0 ? <View className="flex-1 items-center justify-center pt-36"><Radio size={36} color="#555" /><Text className="text-white font-bold mt-4">Aucun live pour le moment</Text><Text className="text-zinc-500 text-xs text-center mt-2">Les diffusions en direct apparaîtront ici.</Text></View> : null}
            {streams.map((stream) => <TouchableOpacity key={stream.id} onPress={() => setSelected(stream)} className="flex-row items-center rounded-2xl bg-zinc-900 border border-zinc-800 p-4 mb-3"><View className="w-12 h-12 rounded-full bg-red-950 items-center justify-center mr-3"><Radio size={22} color="#ff315b" /></View><View className="flex-1"><Text className="text-white font-bold" numberOfLines={1}>{stream.title}</Text><Text className="text-zinc-400 text-xs mt-1">@{stream.profiles?.username ?? 'Utilisateur'}</Text></View><View className="bg-red-600 rounded-full px-2.5 py-1"><Text className="text-white text-[10px] font-extrabold">LIVE</Text></View></TouchableOpacity>)}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}
