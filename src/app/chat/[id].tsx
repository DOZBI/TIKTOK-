import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Send } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';

type ChatMessage = { id: string; body: string; sender_id: string; created_at: string };

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<ScrollView>(null);
  const [userId, setUserId] = useState('');
  const [partner, setPartner] = useState<{ username: string; avatar_url: string | null } | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!supabase || !id) { setError('La messagerie Supabase n’est pas configurée.'); setLoading(false); return; }
    const { data: auth } = await supabase.auth.getUser();
    const currentUserId = auth.user?.id;
    if (!currentUserId) { setError('Connecte-toi pour consulter tes messages.'); setLoading(false); return; }
    setUserId(currentUserId);
    const { data: members, error: membersError } = await supabase.from('conversation_members').select('user_id').eq('conversation_id', id);
    if (membersError) { setError(membersError.message); setLoading(false); return; }
    const otherId = members?.find((member) => member.user_id !== currentUserId)?.user_id;
    if (!otherId) { setError('Conversation introuvable ou inaccessible.'); setLoading(false); return; }
    const [{ data: profile }, { data: rows, error: messagesError }] = await Promise.all([
      supabase.from('profiles').select('username,avatar_url').eq('id', otherId).maybeSingle(),
      supabase.from('messages').select('id,body,sender_id,created_at').eq('conversation_id', id).order('created_at', { ascending: true }).limit(200),
    ]);
    if (messagesError) setError(messagesError.message);
    setPartner(profile ?? { username: 'Utilisateur', avatar_url: null });
    setMessages((rows ?? []) as ChatMessage[]);
    setLoading(false);
    await supabase.from('messages').update({ read_at: new Date().toISOString() }).eq('conversation_id', id).neq('sender_id', currentUserId).is('read_at', null);
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!supabase || !id) return;
    const channel = supabase.channel(`conversation:${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${id}` }, (payload) => {
        const message = payload.new as ChatMessage;
        setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]);
        if (message.sender_id !== userId) void supabase?.from('messages').update({ read_at: new Date().toISOString() }).eq('id', message.id);
        requestAnimationFrame(() => scrollViewRef.current?.scrollToEnd({ animated: true }));
      }).subscribe();
    return () => { void supabase?.removeChannel(channel); };
  }, [id, userId]);

  const sendMessage = async () => {
    const body = input.trim();
    if (!body || !supabase || !id || sending) return;
    setSending(true);
    const { data, error: sendError } = await supabase.from('messages').insert({ conversation_id: id, sender_id: userId, body }).select('id,body,sender_id,created_at').single();
    setSending(false);
    if (sendError) { Alert.alert('Message non envoyé', sendError.message); return; }
    setInput('');
    if (data) setMessages((current) => current.some((message) => message.id === data.id) ? current : [...current, data as ChatMessage]);
    requestAnimationFrame(() => scrollViewRef.current?.scrollToEnd({ animated: true }));
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#09090b' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ paddingTop: insets.top }} className="bg-zinc-900 border-b border-zinc-800">
        <View className="flex-row items-center px-4 pb-3 h-14">
          <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2"><ChevronLeft size={28} color="#fff" /></TouchableOpacity>
          <View className="flex-1 items-center mr-8"><Text className="text-white font-extrabold text-base">{partner?.username ?? 'Messages'}</Text><Text className="text-zinc-500 text-xs mt-0.5">Message privé</Text></View>
        </View>
      </View>

      {loading ? <View className="flex-1 items-center justify-center"><ActivityIndicator color="#ff0050" /></View> : (
        <ScrollView ref={scrollViewRef} className="flex-1 px-4 py-4" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }} onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: false })}>
          {error ? <Text className="text-red-300 text-center mt-8">{error}</Text> : null}
          {messages.length === 0 && !error ? <Text className="text-zinc-500 text-center mt-10">Aucun message. Commence la conversation.</Text> : null}
          {messages.map((message) => {
            const mine = message.sender_id === userId;
            return <View key={message.id} className={`mb-3 flex-row ${mine ? 'justify-end' : 'justify-start'}`}>
              {!mine ? <Image source={partner?.avatar_url ? { uri: partner.avatar_url } : undefined} className="w-8 h-8 rounded-full mr-2 mt-1 bg-zinc-800" /> : null}
              <View className={`max-w-[78%] rounded-2xl px-4 py-3 ${mine ? 'bg-[#ff0050] rounded-tr-sm' : 'bg-zinc-800 rounded-tl-sm'}`}>
                <Text className="text-white text-[15px] leading-5">{message.body}</Text>
                <Text className={`text-[10px] mt-1 ${mine ? 'text-white/70' : 'text-zinc-500'}`}>{new Date(message.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</Text>
              </View>
            </View>;
          })}
        </ScrollView>
      )}

      <View style={{ paddingBottom: insets.bottom || 16 }} className="px-4 py-3 border-t border-zinc-800 bg-zinc-950 flex-row items-center gap-x-3">
        <View className="flex-1 bg-zinc-800 rounded-full flex-row items-center px-4 py-1 min-h-11 border border-zinc-700">
          <TextInput value={input} onChangeText={setInput} placeholder="Écrire un message…" placeholderTextColor="#888" className="flex-1 text-white text-[15px]" multiline maxLength={5000} onSubmitEditing={() => void sendMessage()} />
        </View>
        <TouchableOpacity disabled={!input.trim() || sending || !userId} onPress={() => void sendMessage()} className={`p-2.5 rounded-full ${input.trim() ? 'bg-[#ff0050]' : 'bg-zinc-800'}`}><Send size={20} color="#fff" /></TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
