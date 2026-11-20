
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

import { Users, Sparkles, Tv } from 'lucide-react-native';

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
      className="flex-1 bg-black"
      onLayout={handleFeedLayout}
    >
      <StatusBar
        barStyle="light-content"
        translucent
      />

      {/* Bouton LIVE */}
      <TouchableOpacity
        onPress={() => setShowLive(true)}
        activeOpacity={0.8}
        className="absolute top-12 left-4 z-20 bg-red-600 border border-red-500 px-2.5 py-1 rounded-full flex-row items-center"
      >
        <Tv size={12} color="#ffffff" />

        <Text className="text-white text-[9px] font-extrabold tracking-widest uppercase ml-1">
          LIVE
        </Text>
      </TouchableOpacity>

      {/* Navigation du feed */}
      <View
        className="absolute top-12 left-0 right-0 z-10 flex-row justify-center items-center gap-x-6"
        pointerEvents="box-none"
      >
        <TouchableOpacity
          onPress={() => setFeedType('following')}
          activeOpacity={0.8}
          className="items-center py-1"
        >
          <Text
            className={`text-sm font-bold ${
              feedType === 'following'
                ? 'text-white text-[15px]'
                : 'text-zinc-400'
            }`}
          >
            Following
          </Text>

          {feedType === 'following' && (
            <View className="w-6 h-0.5 bg-white rounded-full mt-1" />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setFeedType('foryou')}
          activeOpacity={0.8}
          className="items-center py-1"
        >
          <Text
            className={`text-sm font-bold ${
              feedType === 'foryou'
                ? 'text-white text-[15px]'
                : 'text-zinc-400'
            }`}
          >
            For You
          </Text>

          {feedType === 'foryou' && (
            <View className="w-6 h-0.5 bg-white rounded-full mt-1" />
          )}
        </TouchableOpacity>
      </View>

      {/* Chargement */}
      {isFeedLoading ? (
        <View className="flex-1 items-center justify-center bg-black px-8">
          <View className="w-full h-[68%] rounded-2xl bg-zinc-900 overflow-hidden border border-zinc-800">
            <View className="flex-1 bg-zinc-800/80 items-center justify-center">
              <ActivityIndicator
                size="large"
                color="#ff0050"
              />

              <Text className="text-zinc-300 text-xs font-semibold mt-4">
                Préparation de la vidéo…
              </Text>
            </View>

            <View className="p-4 gap-y-3">
              <View className="w-32 h-3 rounded-full bg-zinc-700" />
              <View className="w-4/5 h-3 rounded-full bg-zinc-800" />
              <View className="w-1/2 h-3 rounded-full bg-zinc-800" />
            </View>
          </View>
        </View>
      ) : filteredVideos.length === 0 ? (

        /* Aucun contenu */
        <View className="flex-1 justify-center items-center bg-black px-8">
          {feedType === 'following' ? (
            <View className="items-center">
              <View className="bg-zinc-900 p-5 rounded-full mb-4 border border-zinc-800">
                <Users size={36} color="#888888" />
              </View>

              <Text className="text-white text-base font-extrabold text-center mb-2">
                Follow creators to see their videos
              </Text>

              <Text className="text-zinc-500 text-xs text-center leading-5 mb-6">
                Trending videos from creators you follow will appear here. Go to the "For You" tab to find creators.
              </Text>

              <TouchableOpacity
                onPress={() => setFeedType('foryou')}
                activeOpacity={0.8}
                className="bg-[#ff0050] px-6 py-3 rounded-full"
              >
                <Text className="text-white font-extrabold text-sm">
                  Explore For You
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View className="items-center">
              <View className="bg-zinc-900 p-5 rounded-full mb-4 border border-zinc-800">
                <Sparkles size={36} color="#888888" />
              </View>

              <Text className="text-white text-base font-extrabold text-center mb-2">
                No videos available
              </Text>

              <Text className="text-zinc-500 text-xs text-center">
                Check back later or upload a new creation!
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
