import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from 'react';

import {
  FlatList,
  View,
  Text,
  StatusBar,
  TouchableOpacity,
  AppState,
  useWindowDimensions,
  LayoutChangeEvent,
  ActivityIndicator,
  Image,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';

import { useFocusEffect } from 'expo-router';

import { useVideoStore } from '../../store/useVideoStore';
import VideoPost from '../../components/VideoPost';
import LiveStreamModal from '../../components/LiveStreamModal';
import { pauseAll } from '../../lib/playbackManager';

import { Users, Sparkles, Tv, Compass } from 'lucide-react-native';

const TAB_BAR_HEIGHT = 60;

// Nombre de miniatures préchargées.
const PREFETCH_POSTERS = 3;

// Nombre de vidéos montées autour de la vidéo active.
const WINDOW_SIZE = 5;

export default function HomeFeed() {
  // Store Zustand : sélecteurs séparés.
  const videos = useVideoStore((s) => s.videos);
  const hiddenVideoIds = useVideoStore((s) => s.hiddenVideoIds);
  const isFeedLoading = useVideoStore((s) => s.isFeedLoading);

  const { height: windowHeight } = useWindowDimensions();

  // Dimensions du feed.
  const [feedHeight, setFeedHeight] = useState(0);

  const fallbackItemHeight = Math.max(
    windowHeight - TAB_BAR_HEIGHT,
    1
  );

  const itemHeight = feedHeight || fallbackItemHeight;

  const handleFeedLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const nextHeight = Math.round(
        event.nativeEvent.layout.height
      );

      if (nextHeight > 0) {
        setFeedHeight((current) =>
          current === nextHeight ? current : nextHeight
        );
      }
    },
    []
  );

  // Type du feed.
  const [feedType, setFeedType] = useState<'following' | 'foryou'>(
    'foryou'
  );

  // Vidéo active.
  const [activeIndex, setActiveIndex] = useState(0);

  const activeIndexRef = useRef(0);

  const listRef = useRef<FlatList<any>>(null);

  // Live.
  const [showLive, setShowLive] = useState(false);

  // État application.
  const [appActive, setAppActive] = useState(
    AppState.currentState === 'active'
  );

  // État navigation.
  const [isFocused, setIsFocused] = useState(true);

  // Détection du focus.
  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);

      return () => {
        setIsFocused(false);
        pauseAll();
      };
    }, [])
  );

  // Pause lorsque l'application passe en arrière-plan.
  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      (state) => {
        const active = state === 'active';

        setAppActive(active);

        if (!active) {
          pauseAll();
        }
      }
    );

    return () => subscription.remove();
  }, []);

  // Filtrage des vidéos.
  const filteredVideos = useMemo(() => {
    return videos.filter(
      (vid) =>
        !hiddenVideoIds.includes(vid.id) &&
        (feedType === 'following' ? vid.isFollowing : true)
    );
  }, [videos, hiddenVideoIds, feedType]);

  // Sécurisation de l'index.
  const safeIndex = Math.min(
    activeIndex,
    Math.max(filteredVideos.length - 1, 0)
  );

  // Retour en haut lors du changement d'onglet.
  useEffect(() => {
    activeIndexRef.current = 0;
    setActiveIndex(0);

    listRef.current?.scrollToOffset({
      offset: 0,
      animated: false,
    });
  }, [feedType]);

  // Détection de la vidéo active.
  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetY = Math.max(
        event.nativeEvent.contentOffset.y,
        0
      );

      const index = Math.round(offsetY / itemHeight);

      if (
        index >= 0 &&
        index < filteredVideos.length &&
        index !== activeIndexRef.current
      ) {
        activeIndexRef.current = index;
        setActiveIndex(index);
      }
    },
    [itemHeight, filteredVideos.length]
  );

  // Préchargement des miniatures suivantes.
  useEffect(() => {
    let cancelled = false;

    const preloadPosters = async () => {
      const tasks: Promise<boolean>[] = [];

      for (let i = 1; i <= PREFETCH_POSTERS; i++) {
        const video = filteredVideos[safeIndex + i];

        const uri =
          video?.thumbnailUrlMedium ||
          video?.thumbnailUrl ||
          video?.thumbnailUrlLow;

        if (uri) {
          tasks.push(Image.prefetch(uri));
        }
      }

      if (!cancelled) {
        await Promise.allSettled(tasks);
      }
    };

    preloadPosters();

    return () => {
      cancelled = true;
    };
  }, [safeIndex, filteredVideos]);

  // Rendu d'une vidéo.
  const renderItem = useCallback(
    ({ item, index }: { item: any; index: number }) => {
      const isCurrentVideo = index === safeIndex;

      const shouldPreload =
        index === safeIndex + 1;

      return (
        <View style={{ height: itemHeight }}>
          <VideoPost
            video={item}
            height={itemHeight}
            isActive={
              isCurrentVideo &&
              isFocused &&
              appActive
            }
            shouldPreload={shouldPreload}
          />
        </View>
      );
    },
    [safeIndex, isFocused, appActive, itemHeight]
  );

  // Dimensions optimisées de chaque élément.
  const getItemLayout = useCallback(
    (_: any, index: number) => ({
      length: itemHeight,
      offset: itemHeight * index,
      index,
    }),
    [itemHeight]
  );

  // Extraction des clés.
  const keyExtractor = useCallback(
    (item: any) => item.id,
    []
  );

  return (
    <View
      className="flex-1 bg-zinc-950"
      onLayout={handleFeedLayout}
    >
      <StatusBar
        barStyle="light-content"
        translucent
      />

      {/* Bouton LIVE modernisé */}
      <TouchableOpacity
        onPress={() => setShowLive(true)}
        activeOpacity={0.85}
        className="absolute top-12 left-4 z-20 bg-rose-600/95 border border-rose-400/40 px-3 py-1.5 rounded-full flex-row items-center"
      >
        <View className="w-2 h-2 rounded-full bg-white mr-1.5" />
        <Tv size={12} color="#ffffff" />
        <Text className="text-white text-[10px] font-black tracking-widest uppercase ml-1">
          LIVE
        </Text>
      </TouchableOpacity>

      {/* Navigation du feed en capsule flottante */}
      <View
        className="absolute top-12 left-0 right-0 z-10 flex-row justify-center items-center"
        pointerEvents="box-none"
      >
        <View className="flex-row items-center bg-black/55 border border-white/15 rounded-full p-1">
          <TouchableOpacity
            onPress={() => setFeedType('following')}
            activeOpacity={0.85}
            className={`px-3.5 py-1 rounded-full ${
              feedType === 'following' ? 'bg-white' : 'bg-transparent'
            }`}
          >
            <Text
              className={`text-xs font-extrabold ${
                feedType === 'following'
                  ? 'text-zinc-950'
                  : 'text-zinc-300'
              }`}
            >
              Abonnements
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setFeedType('foryou')}
            activeOpacity={0.85}
            className={`px-3.5 py-1 rounded-full ${
              feedType === 'foryou' ? 'bg-rose-500' : 'bg-transparent'
            }`}
          >
            <Text
              className={`text-xs font-extrabold ${
                feedType === 'foryou'
                  ? 'text-white'
                  : 'text-zinc-300'
              }`}
            >
              Pour toi
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Badge discret de position dans le flux */}
      {!isFeedLoading && filteredVideos.length > 0 && (
        <View
          pointerEvents="none"
          className="absolute right-3 top-24 z-10 bg-black/45 border border-white/10 px-2 py-1 rounded-full"
        >
          <Text className="text-zinc-200 text-[10px] font-bold">
            {safeIndex + 1} / {filteredVideos.length}
          </Text>
        </View>
      )}

      {/* Chargement */}
      {isFeedLoading ? (
        <View className="flex-1 items-center justify-center bg-zinc-950 px-6">
          <View className="w-full h-[70%] rounded-3xl bg-zinc-900 overflow-hidden border border-white/10 relative">
            <View className="w-44 h-44 rounded-full bg-rose-500/15 absolute -top-12 -right-12" />
            <View className="flex-1 bg-zinc-900/80 items-center justify-center px-6">
              <View className="w-14 h-14 rounded-2xl bg-rose-500/15 border border-rose-500/30 items-center justify-center">
                <ActivityIndicator
                  size="large"
                  color="#f43f5e"
                />
              </View>

              <Text className="text-white text-sm font-extrabold mt-4">
                Préparation du flux vidéo
              </Text>
              <Text className="text-zinc-400 text-xs mt-1 text-center">
                Optimisation des clips et des miniatures…
              </Text>
            </View>

            <View className="p-4 bg-zinc-950/70 border-t border-white/5 gap-y-2.5">
              <View className="w-28 h-3 rounded-full bg-zinc-800" />
              <View className="w-4/5 h-2.5 rounded-full bg-zinc-800/80" />
              <View className="w-1/2 h-2.5 rounded-full bg-zinc-800/60" />
            </View>
          </View>
        </View>
      ) : filteredVideos.length === 0 ? (

        /* Aucun contenu */
        <View className="flex-1 justify-center items-center bg-zinc-950 px-8">
          {feedType === 'following' ? (
            <View className="items-center bg-zinc-900/70 border border-zinc-800 rounded-3xl p-7 w-full">
              <View className="bg-rose-500/15 border border-rose-500/30 p-4 rounded-2xl mb-4">
                <Users size={30} color="#f43f5e" />
              </View>

              <Text className="text-white text-base font-black text-center mb-2">
                Aucun abonnement pour l'instant
              </Text>

              <Text className="text-zinc-400 text-xs text-center leading-5 mb-6">
                Les clips des créateurs que tu suis apparaîtront ici. Explore l'onglet « Pour toi » pour découvrir de nouveaux comptes.
              </Text>

              <TouchableOpacity
                onPress={() => setFeedType('foryou')}
                activeOpacity={0.85}
                className="bg-rose-500 px-6 py-3 rounded-2xl flex-row items-center"
              >
                <Compass size={15} color="#ffffff" />
                <Text className="text-white font-extrabold text-xs ml-2">
                  Découvrir « Pour toi »
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View className="items-center bg-zinc-900/70 border border-zinc-800 rounded-3xl p-7 w-full">
              <View className="bg-zinc-800 p-4 rounded-2xl mb-4">
                <Sparkles size={30} color="#a1a1aa" />
              </View>

              <Text className="text-white text-base font-black text-center mb-2">
                Aucune vidéo disponible
              </Text>

              <Text className="text-zinc-400 text-xs text-center leading-5">
                Reviens un peu plus tard ou publie une nouvelle vidéo pour animer le flux.
              </Text>
            </View>
          )}
        </View>

      ) : (

        /* Feed vidéo */
        <FlatList
          ref={listRef}
          data={filteredVideos}
          keyExtractor={keyExtractor}
          renderItem={renderItem}

          extraData={`${safeIndex}-${isFocused}-${appActive}-${itemHeight}`}

          // Défilement vertical.
          vertical
          pagingEnabled={false}
          snapToInterval={itemHeight}
          snapToAlignment="start"
          decelerationRate="fast"
          disableIntervalMomentum={false}

          // Fluidité.
          scrollEventThrottle={16}
          onScroll={onScroll}

          // Dimensions.
          getItemLayout={getItemLayout}

          // Rendu progressif.
          initialNumToRender={2}
          maxToRenderPerBatch={3}
          updateCellsBatchingPeriod={16}
          windowSize={WINDOW_SIZE}

          // Vidéos Android.
          removeClippedSubviews={false}

          // Comportement.
          showsVerticalScrollIndicator={false}
          overScrollMode="never"
          bounces={false}

          // Optimisation.
          directionalLockEnabled
          scrollEnabled={!isFeedLoading}
        />
      )}

      {/* Modal Live */}
      <LiveStreamModal
        isVisible={showLive}
        onClose={() => setShowLive(false)}
      />
    </View>
  );
}
