import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Image, TouchableOpacity } from 'react-native';
import { MessageSquare, Heart, UserPlus, Bell, ChevronRight } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';

type InboxMessage = { id: string; user: string; avatar: string; lastMessage: string; time: string; unread: boolean };
type InboxNotification = { id: string; type: string; user: string; avatar: string; message: string; time: string };

export default function InboxScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'notifications' | 'messages'>('notifications');
  const [notifications, setNotifications] = useState<InboxNotification[]>([]);
  const [messages, setMessages] = useState<InboxMessage[]>([]);

  const loadInbox = useCallback(async () => {
    if (!supabase) { setNotifications([]); setMessages([]); return; }
    const { data: session } = await supabase.auth.getSession();
    const userId = session.session?.user.id;
    if (!userId) { setNotifications([]); setMessages([]); return; }

    const [{ data: notificationRows }, { data: memberships }] = await Promise.all([
      supabase.from('notifications').select('id,type,created_at,profiles:actor_id(username,avatar_url),comments(body)').eq('recipient_id', userId).order('created_at', { ascending: false }).limit(50),
      supabase.from('conversation_members').select('conversation_id,user_id').eq('user_id', userId),
    ]);
    const conversationIds = (memberships ?? []).map((row) => row.conversation_id);
    const [{ data: allMembers }, { data: messageRows }] = await Promise.all([
      conversationIds.length ? supabase.from('conversation_members').select('conversation_id,user_id').in('conversation_id', conversationIds) : Promise.resolve({ data: [] }),
      conversationIds.length ? supabase.from('messages').select('id,conversation_id,body,read_at,created_at,sender_id').in('conversation_id', conversationIds).order('created_at', { ascending: false }) : Promise.resolve({ data: [] }),
    ]);
    const otherIds = [...new Set((allMembers ?? []).filter((row) => row.user_id !== userId).map((row) => row.user_id))];
    const { data: profiles } = otherIds.length ? await supabase.from('profiles').select('id,username,avatar_url').in('id', otherIds) : { data: [] };
    const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
    const latest = new Map<string, any>();
    (messageRows ?? []).forEach((message) => { if (!latest.has(message.conversation_id)) latest.set(message.conversation_id, message); });
    setMessages([...latest.entries()].map(([conversationId, message]) => {
      const otherId = (allMembers ?? []).find((member) => member.conversation_id === conversationId && member.user_id !== userId)?.user_id;
      const profile = otherId ? profileMap.get(otherId) : undefined;
      return { id: conversationId, user: profile?.username ?? 'Utilisateur', avatar: profile?.avatar_url ?? '', lastMessage: message.body, time: new Date(message.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }), unread: !message.read_at && message.sender_id !== userId };
    }));
    setNotifications((notificationRows ?? []).map((item) => {
      const actor = Array.isArray(item.profiles) ? item.profiles[0] : item.profiles;
      const comment = Array.isArray(item.comments) ? item.comments[0] : item.comments;
      return { id: item.id, type: item.type, user: actor?.username ?? 'Utilisateur', avatar: actor?.avatar_url ?? '', message: comment?.body ? `a commenté : « ${comment.body} »` : item.type === 'like' ? 'a aimé votre vidéo.' : item.type === 'follow' ? 'vous suit désormais.' : 'vous a envoyé une notification.', time: new Date(item.created_at).toLocaleDateString('fr-FR') };
    }));
  }, []);

  useEffect(() => {
    void loadInbox();
    const channel = supabase?.channel('inbox-updates')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => { void loadInbox(); })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, () => { void loadInbox(); })
      .subscribe();
    return () => { if (channel) void supabase?.removeChannel(channel); };
  }, [loadInbox]);

  const getIcon = (type: string) => {
    if (type === 'like') return <View className="bg-red-500/10 p-1.5 rounded-full border border-red-500/20"><Heart size={14} color="#ff0050" fill="#ff0050" /></View>;
    if (type === 'follow') return <View className="bg-blue-500/10 p-1.5 rounded-full border border-blue-500/20"><UserPlus size={14} color="#3b82f6" /></View>;
    if (type === 'comment') return <View className="bg-green-500/10 p-1.5 rounded-full border border-green-500/20"><MessageSquare size={14} color="#22c55e" /></View>;
    return <View className="bg-purple-500/10 p-1.5 rounded-full border border-purple-500/20"><Bell size={14} color="#a855f7" /></View>;
  };

  return (
    <View className="flex-1 bg-zinc-950 pt-14 px-4">
      <View className="flex-row justify-center bg-zinc-900/60 p-1 rounded-2xl mb-6 border border-zinc-800">
        <TouchableOpacity onPress={() => setActiveTab('notifications')} className={`flex-1 py-2 rounded-xl items-center ${activeTab === 'notifications' ? 'bg-zinc-800' : ''}`}><Text className={`font-bold text-sm ${activeTab === 'notifications' ? 'text-white' : 'text-zinc-500'}`}>Activité</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => setActiveTab('messages')} className={`flex-1 py-2 rounded-xl items-center ${activeTab === 'messages' ? 'bg-zinc-800' : ''}`}><Text className={`font-bold text-sm ${activeTab === 'messages' ? 'text-white' : 'text-zinc-500'}`}>Messages privés</Text></TouchableOpacity>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        {activeTab === 'notifications' ? <View className="gap-y-4">
          {notifications.length === 0 ? <Text className="text-zinc-500 text-sm text-center mt-12">Aucune activité pour le moment.</Text> : null}
          {notifications.map((item) => <View key={item.id} className="flex-row items-center justify-between bg-zinc-900/40 p-3 rounded-2xl border border-zinc-900"><View className="flex-row items-center flex-1 pr-3"><Image source={item.avatar ? { uri: item.avatar } : undefined} className="w-11 h-11 rounded-full mr-3 border border-zinc-800 bg-zinc-800" /><View className="flex-1"><Text className="text-white text-xs font-bold">{item.user} <Text className="text-zinc-400 font-normal">{item.message}</Text></Text><Text className="text-zinc-500 text-[10px] mt-1">{item.time}</Text></View></View>{getIcon(item.type)}</View>)}
        </View> : <View className="gap-y-4">
          {messages.length === 0 ? <Text className="text-zinc-500 text-sm text-center mt-12">Aucune conversation. Envoie un message depuis une publication.</Text> : null}
          {messages.map((message) => <TouchableOpacity key={message.id} onPress={() => router.push(`/chat/${message.id}`)} className="flex-row items-center bg-zinc-900/40 p-3.5 rounded-2xl border border-zinc-900"><Image source={message.avatar ? { uri: message.avatar } : undefined} className="w-12 h-12 rounded-full mr-3.5 border border-zinc-800 bg-zinc-800" /><View className="flex-1"><View className="flex-row items-center justify-between"><Text className="text-white font-bold text-sm">{message.user}</Text><Text className="text-zinc-600 text-[10px]">{message.time}</Text></View><Text className={`text-xs mt-1.5 ${message.unread ? 'text-zinc-200 font-semibold' : 'text-zinc-500'}`} numberOfLines={1}>{message.lastMessage}</Text></View>{message.unread ? <View className="bg-[#ff0050] w-2.5 h-2.5 rounded-full ml-2" /> : <ChevronRight size={16} color="#444" className="ml-1" />}</TouchableOpacity>)}
        </View>}
      </ScrollView>
    </View>
  );
}
