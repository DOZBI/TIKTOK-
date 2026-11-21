import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Modal,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Animated from 'react-native-reanimated';
import {
  Grid,
  Lock,
  Heart,
  Edit2,
  Play,
  X,
  User,
  LogOut,
  MessageCircle,
  Send,
  Sparkles,
  Plus,
} from 'lucide-react-native';
import { useVideoStore } from '../../store/useVideoStore';
import { useRouter } from 'expo-router';

const { width } = Dimensions.get('window');
const CONTAINER_PADDING = 16;
const COLUMN_GAP = 10;
const GRID_ITEM_WIDTH = (width - CONTAINER_PADDING * 2 - COLUMN_GAP) / 2;

// Palettes dynamiques pour les covers générées selon le contenu de la vidéo
const COVER_THEMES = [
  { bg: '#1e1b4b', accent: '#6366f1', orb: '#4338ca' },
  { bg: '#3b0764', accent: '#d946ef', orb: '#86198f' },
  { bg: '#4c0519', accent: '#f43f5e', orb: '#be123c' },
  { bg: '#064e3b', accent: '#10b981', orb: '#047857' },
  { bg: '#451a03', accent: '#f59e0b', orb: '#b45309' },
  { bg: '#0f172a', accent: '#38bdf8', orb: '#0284c7' },
];

function getVideoTheme(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COVER_THEMES[Math.abs(hash) % COVER_THEMES.length];
}

function extractMainTag(description: string): string {
  const match = description.match(/#[\p{L}\d_]+/u);
  return match ? match[0] : 'CLIP';
}

interface ConversationMessage {
  id: string;
  senderName: string;
  senderUsername: string;
  senderAvatar?: string;
  text: string;
  createdAt: string;
  isMine: boolean;
}

/**
 * Cover unique par vidéo (miniature réelle ou couverture générée selon le sujet)
 */
function VideoCover({ video }: { video: any }) {
  const [hasError, setHasError] = useState(false);

  const coverUri = useMemo(() => {
    const candidates = [
      video.thumbnailUrl,
      video.thumbnailUrlMedium,
      video.thumbnailUrlLow,
      video.coverUrl,
    ];
    return candidates.find((url) => url && url !== video.userAvatar) || null;
  }, [video]);

  const theme = useMemo(
    () => getVideoTheme(`${video.id}-${video.description}`),
    [video.id, video.description]
  );

  const mainTag = useMemo(() => extractMainTag(video.description || ''), [video.description]);
  const cleanTitle = useMemo(
    () =>
      (video.description || '').replace(/#[\p{L}\d_]+/gu, '').trim() ||
      `Clip de @${video.username}`,
    [video.description, video.username]
  );

  if (coverUri && !hasError) {
    return (
      <Animated.Image
        source={{ uri: coverUri }}
        onError={() => setHasError(true)}
        className="w-full h-full"
        resizeMode="cover"
        sharedTransitionTag={`thumbnail-${video.id}`}
      />
    );
  }

  return (
    <View
      style={{ backgroundColor: theme.bg }}
      className="w-full h-full justify-center items-center p-3 overflow-hidden relative"
    >
      <View
        style={{ backgroundColor: theme.orb }}
        className="w-32 h-32 rounded-full absolute -top-8 -right-8 opacity-45"
      />
      <View
        style={{ backgroundColor: theme.accent }}
        className="w-24 h-24 rounded-full absolute -bottom-8 -left-6 opacity-25"
      />
      <View
        style={{ borderColor: theme.accent }}
        className="bg-black/35 border px-2.5 py-0.5 rounded-full mb-2 flex-row items-center"
      >
        <Sparkles size={9} color={theme.accent} />
        <Text
          style={{ color: theme.accent }}
          className="font-extrabold text-[9px] uppercase tracking-wider ml-1"
          numberOfLines={1}
        >
          {mainTag}
        </Text>
      </View>
      <Text
        numberOfLines={3}
        className="text-white font-extrabold text-xs text-center leading-snug"
      >
        {cleanTitle}
      </Text>
    </View>
  );
}

export default function ProfileScreen() {
  const store = useVideoStore() as any;
  const {
    videos = [],
    currentUser,
    updateProfile,
    isLoggedIn,
    setShowAuthModal,
    logout,
    loadFeed,
  } = store;

  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'public' | 'private' | 'liked'>('public');
  const [showEditModal, setShowEditModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // État pour l'édition du profil
  const [bio, setBio] = useState(currentUser?.bio || '');
  const [name, setName] = useState(currentUser?.name || '');

  // État pour les conversations par vidéo : Record<videoId, ConversationMessage[]>
  const [conversations, setConversations] = useState<Record<string, ConversationMessage[]>>({});
  const [selectedVideoForChat, setSelectedVideoForChat] = useState<any | null>(null);
  const [messageInput, setMessageInput] = useState('');

  // Chargement initial des vidéos
  useEffect(() => {
    let mounted = true;
    const init = async () => {
      try {
        if (typeof loadFeed === 'function') {
          await loadFeed();
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    };
    void init();
    return () => {
      mounted = false;
    };
  }, [loadFeed]);

  // Synchroniser les champs du modal avec currentUser
  useEffect(() => {
    if (currentUser) {
      setName(currentUser.name || '');
      setBio(currentUser.bio || '');
    }
  }, [currentUser]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (typeof loadFeed === 'function') {
        await loadFeed();
      }
    } finally {
      setRefreshing(false);
    }
  }, [loadFeed]);

  // Ouvrir ou initialiser automatiquement une conversation pour une vidéo
  const openVideoConversation = (video: any) => {
    setSelectedVideoForChat(video);
    setConversations((prev) => {
      if (prev[video.id]) return prev;

      // Récupération des commentaires existants si présents sur l'objet vidéo
      const existingComments: ConversationMessage[] = Array.isArray(video.comments)
        ? video.comments.map((c: any, idx: number) => ({
            id: c.id || `${video.id}-init-${idx}`,
            senderName: c.name || c.username || 'Membre',
            senderUsername: c.username || 'user',
            senderAvatar: c.avatar,
            text: c.text || c.content || '',
            createdAt: c.createdAt || 'Récemment',
            isMine: c.userId === currentUser?.id,
          }))
        : [
            {
              id: `${video.id}-welcome`,
              senderName: video.username || 'Créateur',
              senderUsername: video.username || 'createur',
              senderAvatar: video.userAvatar,
              text: `Bienvenue dans la discussion autour de « ${video.description || 'cette vidéo'} » !`,
              createdAt: 'À l’instant',
              isMine: video.authorId === currentUser?.id,
            },
          ];

      return { ...prev, [video.id]: existingComments };
    });
  };

  // Envoyer un message dans la conversation de la vidéo
  const handleSendMessage = () => {
    const trimmed = messageInput.trim();
    if (!trimmed || !selectedVideoForChat) return;

    const videoId = selectedVideoForChat.id;
    const newMessage: ConversationMessage = {
      id: `${Date.now()}`,
      senderName: currentUser?.name || 'Moi',
      senderUsername: currentUser?.username || 'moi',
      senderAvatar: currentUser?.avatar,
      text: trimmed,
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isMine: true,
    };

    setConversations((prev) => ({
      ...prev,
      [videoId]: [...(prev[videoId] || []), newMessage],
    }));

    // Synchronisation optionnelle avec le store global si disponible
    if (typeof store.addComment === 'function') {
      void store.addComment(videoId, trimmed);
    }

    setMessageInput('');
  };

  const userStats = {
    following: (currentUser?.followingCount ?? 0).toLocaleString(),
    followers: (currentUser?.followersCount ?? 0).toLocaleString(),
    likes: (currentUser?.likesCount ?? 0).toLocaleString(),
    avatar: currentUser?.avatar,
  };

  const publicVideos = videos.filter(
    (video: any) => video.authorId === currentUser?.id && video.visibility !== 'private'
  );
  const privateVideos = videos.filter(
    (video: any) => video.authorId === currentUser?.id && video.visibility === 'private'
  );
  const likedVideos = videos.filter((vid: any) => vid.isLiked);

  const getActiveTabVideos = () => {
    switch (activeTab) {
      case 'public':
        return publicVideos;
      case 'private':
        return privateVideos;
      case 'liked':
        return likedVideos;
    }
  };

  if (!isLoggedIn) {
    return (
      <View className="flex-1 bg-zinc-950 justify-center items-center px-8 pt-10">
        <View className="w-20 h-20 rounded-3xl bg-zinc-900 border border-zinc-800 items-center justify-center mb-6">
          <User size={38} color="#f43f5e" />
        </View>
        <Text className="text-white text-2xl font-black mb-2 text-center">
          Crée ton espace créateur
        </Text>
        <Text className="text-zinc-400 text-sm text-center mb-8 leading-5">
          Publie tes clips, gère tes vidéos privées et lance des conversations autour de tes contenus.
        </Text>
        <TouchableOpacity
          onPress={() => setShowAuthModal(true)}
          className="bg-rose-500 w-full py-4 rounded-2xl items-center"
        >
          <Text className="text-white font-extrabold text-sm">Se connecter / S'inscrire</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const activeVideos = getActiveTabVideos();
  const currentChatMessages = selectedVideoForChat
    ? conversations[selectedVideoForChat.id] || []
    : [];

  return (
    <View className="flex-1 bg-zinc-950">
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#f43f5e"
            colors={['#f43f5e']}
          />
        }
      >
        {/* Bannière supérieure décorative */}
        <View className="h-32 bg-indigo-950 relative overflow-hidden">
          <View className="w-56 h-56 rounded-full bg-rose-500/20 absolute -top-20 -right-12" />
          <View className="w-44 h-44 rounded-full bg-indigo-500/25 absolute -bottom-24 left-6" />

          <TouchableOpacity
            onPress={async () => {
              await logout();
              router.replace('/');
            }}
            className="absolute top-12 right-4 bg-black/45 border border-white/10 p-2.5 rounded-full"
          >
            <LogOut size={16} color="#fca5a5" />
          </TouchableOpacity>
        </View>

        {/* Informations utilisateur */}
        <View className="items-center px-4 -mt-12 mb-6">
          <View className="p-1 rounded-full bg-zinc-950 border-2 border-rose-500 mb-3">
            {userStats.avatar ? (
              <Image
                source={{ uri: userStats.avatar }}
                className="w-24 h-24 rounded-full bg-zinc-900"
              />
            ) : (
              <View className="w-24 h-24 rounded-full bg-zinc-900 items-center justify-center">
                <Text className="text-white text-2xl font-black">
                  {currentUser.name?.[0]?.toUpperCase() || 'U'}
                </Text>
              </View>
            )}
          </View>

          <Text className="text-white text-xl font-black tracking-tight">
            {currentUser.name}
          </Text>
          <Text className="text-zinc-400 text-xs font-medium mt-0.5">
            @{currentUser.username}
          </Text>

          {currentUser.bio ? (
            <Text className="text-zinc-300 text-xs mt-3 text-center leading-5 px-4">
              {currentUser.bio}
            </Text>
          ) : null}

          {/* Carte des statistiques */}
          <View className="flex-row items-center bg-zinc-900/90 border border-zinc-800 rounded-2xl py-3.5 px-4 mt-5 w-full">
            <View className="flex-1 items-center border-r border-zinc-800">
              <Text className="text-white font-black text-base">{userStats.following}</Text>
              <Text className="text-zinc-400 text-[11px] mt-0.5">Abonnements</Text>
            </View>
            <View className="flex-1 items-center border-r border-zinc-800">
              <Text className="text-white font-black text-base">{userStats.followers}</Text>
              <Text className="text-zinc-400 text-[11px] mt-0.5">Abonnés</Text>
            </View>
            <View className="flex-1 items-center">
              <Text className="text-white font-black text-base">{userStats.likes}</Text>
              <Text className="text-zinc-400 text-[11px] mt-0.5">J'aime</Text>
            </View>
          </View>

          {/* Boutons d'action */}
          <View className="flex-row gap-x-2.5 mt-4 w-full">
            <TouchableOpacity
              onPress={() => setShowEditModal(true)}
              className="flex-1 bg-zinc-900 border border-zinc-800 py-3 rounded-2xl flex-row items-center justify-center gap-x-2"
            >
              <Edit2 size={14} color="#ffffff" />
              <Text className="text-white font-bold text-xs">Modifier le profil</Text>
            </TouchableOpacity>

            {videos.length > 0 && (
              <TouchableOpacity
                onPress={() => openVideoConversation(activeVideos[0] || videos[0])}
                className="flex-1 bg-rose-500 py-3 rounded-2xl flex-row items-center justify-center gap-x-2"
              >
                <MessageCircle size={14} color="#ffffff" />
                <Text className="text-white font-bold text-xs">Conversations</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Sélecteur d'onglets en pilules */}
        <View className="flex-row px-4 mb-4 gap-x-2">
          {[
            { key: 'public', label: 'Publics', count: publicVideos.length, Icon: Grid },
            { key: 'private', label: 'Privés', count: privateVideos.length, Icon: Lock },
            { key: 'liked', label: 'Aimés', count: likedVideos.length, Icon: Heart },
          ].map(({ key, label, count, Icon }) => {
            const isActive = activeTab === key;
            return (
              <TouchableOpacity
                key={key}
                onPress={() => setActiveTab(key as any)}
                className={`flex-1 py-2.5 px-2 rounded-2xl border flex-row items-center justify-center gap-x-1.5 ${
                  isActive
                    ? 'bg-white border-white'
                    : 'bg-zinc-900 border-zinc-800'
                }`}
              >
                <Icon size={14} color={isActive ? '#09090b' : '#a1a1aa'} />
                <Text
                  className={`font-bold text-xs ${
                    isActive ? 'text-zinc-950' : 'text-zinc-400'
                  }`}
                >
                  {label}
                </Text>
                <View
                  className={`px-1.5 py-0.5 rounded-full ${
                    isActive ? 'bg-zinc-950/15' : 'bg-zinc-800'
                  }`}
                >
                  <Text
                    className={`text-[10px] font-extrabold ${
                      isActive ? 'text-zinc-950' : 'text-zinc-400'
                    }`}
                  >
                    {count}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Grille des vidéos (2 colonnes avec covers + accès conversation) */}
        <View className="px-4 pb-12">
          {isLoading ? (
            <View className="w-full py-20 items-center justify-center">
              <ActivityIndicator size="large" color="#f43f5e" />
              <Text className="text-zinc-400 text-xs mt-3 font-medium">
                Chargement de vos vidéos...
              </Text>
            </View>
          ) : activeVideos.length === 0 ? (
            <View className="w-full py-16 px-6 bg-zinc-900/50 border border-zinc-800/80 rounded-3xl items-center justify-center">
              <View className="w-12 h-12 rounded-2xl bg-zinc-800 items-center justify-center mb-3">
                <Play size={22} color="#a1a1aa" />
              </View>
              <Text className="text-white font-bold text-sm">Aucune vidéo ici</Text>
              <Text className="text-zinc-500 text-xs text-center mt-1">
                {activeTab === 'public'
                  ? 'Tes clips publics apparaîtront ici avec leur cover.'
                  : activeTab === 'private'
                  ? 'Tes brouillons et vidéos privées sont rangés ici.'
                  : 'Les vidéos que tu aimes s’afficheront dans cet onglet.'}
              </Text>
            </View>
          ) : (
            <View className="flex-row flex-wrap justify-between gap-y-3">
              {activeVideos.map((video: any) => {
                const msgCount =
                  conversations[video.id]?.length ??
                  (Array.isArray(video.comments) ? video.comments.length : 0);

                return (
                  <View
                    key={video.id}
                    style={{ width: GRID_ITEM_WIDTH, height: GRID_ITEM_WIDTH * 1.48 }}
                    className="relative rounded-2xl overflow-hidden bg-zinc-900 border border-white/10"
                  >
                    <TouchableOpacity
                      activeOpacity={0.9}
                      onPress={() => router.push(`/video/${video.id}` as any)}
                      className="w-full h-full"
                    >
                      <VideoCover video={video} />
                    </TouchableOpacity>

                    {/* Bouton rapide pour créer / ouvrir la conversation de cette vidéo */}
                    <TouchableOpacity
                      onPress={() => openVideoConversation(video)}
                      className="absolute top-2.5 right-2.5 bg-black/65 border border-white/15 px-2.5 py-1 rounded-full flex-row items-center"
                    >
                      <MessageCircle size={11} color="#f43f5e" />
                      <Text className="text-white text-[10px] font-bold ml-1">
                        {msgCount > 0 ? msgCount : <Plus size={10} color="#ffffff" />}
                      </Text>
                    </TouchableOpacity>

                    {/* Barre inférieure : titre + vues */}
                    <View className="absolute bottom-0 left-0 right-0 bg-black/70 px-2.5 py-2">
                      <Text className="text-white text-[11px] font-semibold mb-1" numberOfLines={1}>
                        {video.description || 'Sans description'}
                      </Text>
                      <View className="flex-row items-center justify-between">
                        <View className="flex-row items-center">
                          <Play size={10} color="#ffffff" fill="#ffffff" />
                          <Text className="text-zinc-200 text-[10px] font-bold ml-1">
                            {video.views.toLocaleString()}
                          </Text>
                        </View>
                        <TouchableOpacity onPress={() => openVideoConversation(video)}>
                          <Text className="text-rose-400 text-[10px] font-bold">
                            Discuter →
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Modale d'édition du profil */}
      <Modal visible={showEditModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="flex-1 bg-black/70 justify-end"
        >
          <View className="bg-zinc-900 border-t border-zinc-800 rounded-t-3xl p-6 pb-10">
            <View className="flex-row items-center justify-between mb-6">
              <Text className="text-white font-black text-base">Modifier le profil</Text>
              <TouchableOpacity
                onPress={() => setShowEditModal(false)}
                className="bg-zinc-800 p-2 rounded-full"
              >
                <X size={16} color="#ffffff" />
              </TouchableOpacity>
            </View>

            <View className="gap-y-4 mb-6">
              <View>
                <Text className="text-zinc-400 text-[11px] font-bold mb-2 uppercase">
                  Nom affiché
                </Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  className="bg-zinc-950 text-white rounded-2xl px-4 py-3 text-sm border border-zinc-800"
                  placeholder="Votre nom"
                  placeholderTextColor="#71717a"
                />
              </View>
              <View>
                <Text className="text-zinc-400 text-[11px] font-bold mb-2 uppercase">
                  Biographie
                </Text>
                <TextInput
                  value={bio}
                  onChangeText={setBio}
                  multiline
                  numberOfLines={3}
                  className="bg-zinc-950 text-white rounded-2xl px-4 py-3 text-sm border border-zinc-800 h-24"
                  placeholder="Parlez un peu de vous..."
                  placeholderTextColor="#71717a"
                  textAlignVertical="top"
                />
              </View>
            </View>

            <TouchableOpacity
              onPress={() => {
                updateProfile({ name, bio });
                setShowEditModal(false);
              }}
              className="bg-rose-500 py-3.5 rounded-2xl items-center"
            >
              <Text className="text-white font-extrabold text-sm">Enregistrer</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modale de Conversation liée à une vidéo */}
      <Modal
        visible={!!selectedVideoForChat}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedVideoForChat(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="flex-1 bg-black/75 justify-end"
        >
          <View className="bg-zinc-900 border-t border-zinc-800 rounded-t-3xl h-[75%] p-5">
            {/* Header conversation */}
            <View className="flex-row items-center justify-between pb-3.5 border-b border-zinc-800">
              <View className="flex-1 mr-3">
                <View className="flex-row items-center">
                  <MessageCircle size={15} color="#f43f5e" />
                  <Text className="text-white font-black text-sm ml-1.5">
                    Conversation vidéo
                  </Text>
                </View>
                <Text className="text-zinc-400 text-xs mt-0.5" numberOfLines={1}>
                  {selectedVideoForChat?.description || `Clip de @${selectedVideoForChat?.username}`}
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => setSelectedVideoForChat(null)}
                className="bg-zinc-800 p-2 rounded-full"
              >
                <X size={16} color="#ffffff" />
              </TouchableOpacity>
            </View>

            {/* Sélecteur rapide pour basculer entre les conversations des vidéos */}
            {videos.length > 1 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                className="max-h-11 my-2.5"
              >
                {videos.map((v: any) => {
                  const active = v.id === selectedVideoForChat?.id;
                  return (
                    <TouchableOpacity
                      key={`chat-pill-${v.id}`}
                      onPress={() => openVideoConversation(v)}
                      className={`px-3 py-1.5 rounded-full mr-2 border self-center ${
                        active
                          ? 'bg-rose-500 border-rose-500'
                          : 'bg-zinc-950 border-zinc-800'
                      }`}
                    >
                      <Text
                        className={`text-[11px] font-bold ${
                          active ? 'text-white' : 'text-zinc-400'
                        }`}
                        numberOfLines={1}
                      >
                        @{v.username} • {(v.description || 'Clip').slice(0, 18)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            {/* Fil des messages */}
            <ScrollView
              className="flex-1 my-2"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ gap: 10, paddingBottom: 12 }}
            >
              {currentChatMessages.map((msg) => (
                <View
                  key={msg.id}
                  className={`max-w-[82%] rounded-2xl p-3 ${
                    msg.isMine
                      ? 'self-end bg-rose-500'
                      : 'self-start bg-zinc-950 border border-zinc-800'
                  }`}
                >
                  <Text
                    className={`text-[10px] font-bold mb-1 ${
                      msg.isMine ? 'text-rose-100' : 'text-zinc-400'
                    }`}
                  >
                    {msg.senderName} • {msg.createdAt}
                  </Text>
                  <Text className="text-white text-xs leading-relaxed">{msg.text}</Text>
                </View>
              ))}
            </ScrollView>

            {/* Zone de saisie d'un nouveau message */}
            <View className="flex-row items-center bg-zinc-950 border border-zinc-800 rounded-2xl px-3.5 py-2 mt-2">
              <TextInput
                value={messageInput}
                onChangeText={setMessageInput}
                placeholder="Écrire dans la conversation..."
                placeholderTextColor="#71717a"
                className="flex-1 text-white text-xs py-1.5"
                onSubmitEditing={handleSendMessage}
                returnKeyType="send"
              />
              <TouchableOpacity
                onPress={handleSendMessage}
                disabled={!messageInput.trim()}
                className={`p-2 rounded-xl ml-2 ${
                  messageInput.trim() ? 'bg-rose-500' : 'bg-zinc-800'
                }`}
              >
                <Send size={15} color="#ffffff" />
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
