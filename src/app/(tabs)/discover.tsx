import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Image,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { Search, Flame, Play, X, Sparkles, Hash, TrendingUp } from 'lucide-react-native';
import { useVideoStore } from '../../store/useVideoStore';
import { useRouter } from 'expo-router';

const { width } = Dimensions.get('window');
const CONTAINER_PADDING = 16;
const COLUMN_GAP = 12;
const CARD_WIDTH = (width - CONTAINER_PADDING * 2 - COLUMN_GAP) / 2;

// Palettes dynamiques générées selon le contenu de la vidéo
const COVER_THEMES = [
  { bg: '#1e1b4b', accent: '#6366f1', orb: '#4338ca' }, // Indigo / Tech / Nuit
  { bg: '#3b0764', accent: '#d946ef', orb: '#86198f' }, // Violet / Musique / Créatif
  { bg: '#4c0519', accent: '#f43f5e', orb: '#be123c' }, // Rose / Lifestyle / Tendance
  { bg: '#064e3b', accent: '#10b981', orb: '#047857' }, // Émeraude / Sport / Nature
  { bg: '#451a03', accent: '#f59e0b', orb: '#b45309' }, // Ambre / Food / Humour
  { bg: '#0f172a', accent: '#38bdf8', orb: '#0284c7' }, // Cyan / Vlog / Voyage
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

interface VideoCoverProps {
  video: any;
  sharedTransitionTag?: string;
  isFeatured?: boolean;
}

/**
 * Affiche la miniature de la vidéo si disponible et valide.
 * Sinon, génère automatiquement une cover graphique basée sur le titre/hashtag de la vidéo.
 */
function VideoCover({ video, sharedTransitionTag, isFeatured = false }: VideoCoverProps) {
  const [hasError, setHasError] = useState(false);

  // On ignore userAvatar pour ne pas utiliser la photo de profil comme cover
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
    () => (video.description || '').replace(/#[\p{L}\d_]+/gu, '').trim() || `Vidéo de @${video.username}`,
    [video.description, video.username]
  );

  if (coverUri && !hasError) {
    const ImageComponent = sharedTransitionTag ? Animated.Image : Image;
    return (
      <ImageComponent
        source={{ uri: coverUri }}
        onError={() => setHasError(true)}
        className="w-full h-full"
        resizeMode="cover"
        {...(sharedTransitionTag ? { sharedTransitionTag } : {})}
      />
    );
  }

  // Cover dynamique générée selon le contenu de la vidéo
  return (
    <View
      style={{ backgroundColor: theme.bg }}
      className="w-full h-full justify-center items-center p-3.5 overflow-hidden relative"
    >
      {/* Formes lumineuses d'arrière-plan */}
      <View
        style={{ backgroundColor: theme.orb }}
        className="w-36 h-36 rounded-full absolute -top-10 -right-10 opacity-45"
      />
      <View
        style={{ backgroundColor: theme.accent }}
        className="w-28 h-28 rounded-full absolute -bottom-10 -left-8 opacity-25"
      />

      {/* Badge Hashtag / Catégorie de la vidéo */}
      <View
        style={{ borderColor: theme.accent }}
        className="bg-black/35 border px-2.5 py-1 rounded-full mb-2.5 flex-row items-center"
      >
        <Sparkles size={10} color={theme.accent} />
        <Text
          style={{ color: theme.accent }}
          className="font-extrabold text-[10px] uppercase tracking-wider ml-1"
          numberOfLines={1}
        >
          {mainTag}
        </Text>
      </View>

      {/* Extrait du sujet de la vidéo */}
      <Text
        numberOfLines={isFeatured ? 3 : 3}
        className={`text-white font-extrabold text-center leading-snug ${
          isFeatured ? 'text-base px-4' : 'text-xs'
        }`}
      >
        {cleanTitle}
      </Text>
    </View>
  );
}

export default function DiscoverScreen() {
  const { videos, loadFeed } = useVideoStore();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'Top' | 'Users' | 'Videos'>('Top');

  useEffect(() => {
    void loadFeed();
  }, [loadFeed]);

  const trendingHashtags = useMemo(() => {
    const tags = new Map<string, number>();
    videos.forEach((video) => {
      (video.description.match(/#[\p{L}\d_]+/gu) ?? []).forEach((tag) => {
        const key = tag.slice(1).toLowerCase();
        tags.set(key, (tags.get(key) ?? 0) + video.views);
      });
    });
    return [...tags.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag, views], index) => ({
        id: `${tag}-${index}`,
        tag,
        count: `${views.toLocaleString()} vues`,
      }));
  }, [videos]);

  const filteredVideos = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return videos;
    return videos.filter(
      (video) =>
        video.username.toLowerCase().includes(q) ||
        video.description.toLowerCase().includes(q)
    );
  }, [videos, searchQuery]);

  // Créateurs uniques pour l'onglet Users
  const uniqueCreators = useMemo(() => {
    const seen = new Set<string>();
    return filteredVideos.filter((v) => {
      if (seen.has(v.username)) return false;
      seen.add(v.username);
      return true;
    });
  }, [filteredVideos]);

  const featuredVideo = videos[0];
  const gridVideos = videos.slice(1);

  const renderVideoCard = (video: any, withTransition = false) => (
    <TouchableOpacity
      key={video.id}
      activeOpacity={0.88}
      onPress={() => router.push(`/video/${video.id}` as any)}
      style={{ width: CARD_WIDTH, height: CARD_WIDTH * 1.48 }}
      className="relative rounded-2xl overflow-hidden bg-zinc-900 border border-white/10"
    >
      <VideoCover
        video={video}
        sharedTransitionTag={withTransition ? `thumbnail-${video.id}` : undefined}
      />

      {/* Voile d'assombrissement supérieur pour lisibilité */}
      <View className="absolute top-0 left-0 right-0 h-14 bg-black/30" />

      {/* Header créateur avec avatar */}
      <View className="absolute top-2.5 left-2.5 right-2.5 flex-row items-center">
        {video.userAvatar ? (
          <Image
            source={{ uri: video.userAvatar }}
            className="w-5 h-5 rounded-full border border-white/60 mr-1.5"
          />
        ) : (
          <View className="w-5 h-5 rounded-full bg-rose-500 items-center justify-center mr-1.5">
            <Text className="text-white text-[9px] font-bold">
              {video.username?.[0]?.toUpperCase() || 'U'}
            </Text>
          </View>
        )}
        <Text className="text-white font-semibold text-[11px] flex-1" numberOfLines={1}>
          @{video.username}
        </Text>
      </View>

      {/* Footer avec description courte + compteur de vues */}
      <View className="absolute bottom-0 left-0 right-0 bg-black/65 pt-3 pb-2.5 px-2.5">
        <Text className="text-zinc-100 text-[11px] font-medium mb-1.5" numberOfLines={1}>
          {video.description}
        </Text>
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center bg-white/15 px-2 py-0.5 rounded-full">
            <Play size={9} color="#ffffff" fill="#ffffff" />
            <Text className="text-white font-bold text-[10px] ml-1">
              {video.views.toLocaleString()}
            </Text>
          </View>
          <Text className="text-rose-400 font-bold text-[10px]">
            ♥ {video.likes.toLocaleString()}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View className="flex-1 bg-zinc-950 pt-14">
      {/* Header & Barre de recherche */}
      <View className="px-4 mb-4">
        <Text className="text-white text-2xl font-black tracking-tight mb-3">
          Explorer
        </Text>
        <View className="flex-row items-center bg-zinc-900 border border-zinc-800 rounded-2xl px-3.5 py-2.5">
          <Search size={18} color="#a1a1aa" />
          <TextInput
            className="flex-1 text-white text-sm ml-2.5"
            placeholder="Créateurs, #hashtags, sujets..."
            placeholderTextColor="#71717a"
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              className="bg-zinc-800 p-1 rounded-full"
            >
              <X size={14} color="#e4e4e7" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Onglets de recherche */}
      {searchQuery.length > 0 && (
        <View className="flex-row px-4 mb-4 gap-x-2">
          {(['Top', 'Videos', 'Users'] as const).map((tab) => {
            const isActive = activeTab === tab;
            return (
              <TouchableOpacity
                key={tab}
                onPress={() => setActiveTab(tab)}
                className={`px-4 py-1.5 rounded-full border ${
                  isActive
                    ? 'bg-rose-500 border-rose-500'
                    : 'bg-zinc-900 border-zinc-800'
                }`}
              >
                <Text
                  className={`font-bold text-xs ${
                    isActive ? 'text-white' : 'text-zinc-400'
                  }`}
                >
                  {tab === 'Top' ? 'Tout' : tab === 'Videos' ? 'Vidéos' : 'Créateurs'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <ScrollView showsVerticalScrollIndicator={false} className="px-4">
        {searchQuery.length === 0 ? (
          <>
            {/* Hashtags tendance interactifs */}
            {trendingHashtags.length > 0 && (
              <View className="mb-6">
                <View className="flex-row items-center justify-between mb-3">
                  <View className="flex-row items-center">
                    <Flame size={18} color="#f43f5e" fill="#f43f5e" />
                    <Text className="text-white font-extrabold text-base ml-1.5">
                      Tendances
                    </Text>
                  </View>
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  className="flex-row"
                >
                  {trendingHashtags.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      onPress={() => setSearchQuery(`#${item.tag}`)}
                      className="bg-zinc-900 border border-zinc-800 px-3.5 py-2 rounded-2xl mr-2.5 flex-row items-center"
                    >
                      <View className="w-7 h-7 rounded-xl bg-rose-500/15 items-center justify-center mr-2.5">
                        <Hash size={14} color="#f43f5e" />
                      </View>
                      <View>
                        <Text className="text-white font-bold text-xs">#{item.tag}</Text>
                        <Text className="text-zinc-400 text-[10px] mt-0.5">{item.count}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Vidéo mise en avant (Hero Card) */}
            {featuredVideo && (
              <View className="mb-6">
                <View className="flex-row items-center mb-3">
                  <TrendingUp size={16} color="#38bdf8" />
                  <Text className="text-white font-extrabold text-base ml-1.5">
                    À la une
                  </Text>
                </View>

                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => router.push(`/video/${featuredVideo.id}` as any)}
                  className="w-full h-52 rounded-3xl overflow-hidden bg-zinc-900 border border-white/15 relative"
                >
                  <VideoCover video={featuredVideo} isFeatured />
                  <View className="absolute top-3 left-3 bg-rose-500 px-2.5 py-1 rounded-full flex-row items-center">
                    <Flame size={11} color="#ffffff" fill="#ffffff" />
                    <Text className="text-white font-black text-[10px] ml-1 uppercase">
                      Top Clip
                    </Text>
                  </View>

                  <View className="absolute bottom-0 left-0 right-0 bg-black/70 p-3.5 flex-row items-center justify-between">
                    <View className="flex-1 mr-3">
                      <Text className="text-white font-bold text-sm" numberOfLines={1}>
                        {featuredVideo.description}
                      </Text>
                      <Text className="text-zinc-300 text-xs mt-0.5">
                        @{featuredVideo.username} • {featuredVideo.views.toLocaleString()} vues
                      </Text>
                    </View>
                    <View className="w-10 h-10 rounded-full bg-white items-center justify-center">
                      <Play size={16} color="#09090b" fill="#09090b" />
                    </View>
                  </View>
                </TouchableOpacity>
              </View>
            )}

            {/* Grille principale 2 colonnes */}
            <View className="mb-10">
              <Text className="text-white font-extrabold text-base mb-3.5">
                Clips populaires
              </Text>
              <View className="flex-row flex-wrap justify-between gap-y-3">
                {gridVideos.map((video) => renderVideoCard(video, false))}
              </View>
            </View>
          </>
        ) : (
          /* Résultats de recherche */
          <View className="mb-10">
            {activeTab === 'Users' && (
              <View className="gap-y-3">
                {uniqueCreators.length === 0 ? (
                  <Text className="text-zinc-500 text-sm mt-10 text-center">
                    Aucun créateur trouvé.
                  </Text>
                ) : (
                  uniqueCreators.map((video) => (
                    <TouchableOpacity
                      key={`user-${video.username}`}
                      onPress={() => setSearchQuery(video.username)}
                      className="flex-row items-center justify-between bg-zinc-900 p-3.5 rounded-2xl border border-zinc-800"
                    >
                      <View className="flex-row items-center">
                        <Image
                          source={{ uri: video.userAvatar }}
                          className="w-12 h-12 rounded-full mr-3.5 border border-zinc-700 bg-zinc-800"
                        />
                        <View>
                          <Text className="text-white font-bold text-sm">
                            @{video.username}
                          </Text>
                          <Text className="text-zinc-400 text-xs mt-0.5">
                            {video.likes.toLocaleString()} J'aime
                          </Text>
                        </View>
                      </View>
                      <View className="bg-zinc-800 px-3 py-1.5 rounded-full">
                        <Text className="text-white text-xs font-semibold">Voir</Text>
                      </View>
                    </TouchableOpacity>
                  ))
                )}
              </View>
            )}

            {(activeTab === 'Top' || activeTab === 'Videos') && (
              <View className="flex-row flex-wrap justify-between gap-y-3">
                {filteredVideos.length === 0 ? (
                  <Text className="text-zinc-500 text-sm mt-10 w-full text-center">
                    Aucune vidéo trouvée pour « {searchQuery} ».
                  </Text>
                ) : (
                  filteredVideos.map((video) => renderVideoCard(video, true))
                )}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
