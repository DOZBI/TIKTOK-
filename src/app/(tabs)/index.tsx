import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
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
// Nombre de miniatures préchargées devant l'utilisateur.
const PREFETCH_POSTERS = 3;

export default function HomeFeed() {
  // Sélecteurs séparés : le feed ne se re-render plus à chaque changement du store.
  const videos = useVideoStore((s) => s.videos);
  const hiddenVideoIds = useVideoStore((s) => s.hiddenVideoIds);
  const isFeedLoading = useVideoStore((s) => s.isFeedLoading);

  const { height: windowHeight } = useWindowDimensions();
  const [feedHeight, setFeedHeight] = useState(0);
  const fallbackItemHeight = Math.max(windowHeight - TAB_BAR_HEIGHT, 1);
  const itemHeight = feedHeight || fallbackItemHeight;

  const handleFeedLayout = useCallback((event: LayoutChangeEvent) => {
    const nextHeight = Math.round(event.nativeEvent.layout.height);
    if (nextHeight > 0) {
      setFeedHeight((currentHeight) => (currentHeight === nextHeight ? currentHeight : nextHeight));
    }
  }, []);

  const [feedType, setFeedType] = useState<'following' | 'foryou'>('foryou');
  const [activeIndex, setActiveIndex] = useState(0);
  const activeIndexRef = useRef(0);
  const [showLive, setShowLive] = useState<boolean>(false);
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const [isFocused, setIsFocused] = useState(true);

  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      return () => {
        setIsFocused(false);
        pauseAll();
      };
    }, [])
  );
  const listRef = useRef<FlatList<any>>(null);

  // Pause quand l'app passe en arrière-plan.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      const active = state === 'active';
      setAppActive(active);
      if (!active) pauseAll();
    });
    return () => sub.remove();
  }, []);

  const filteredVideos = useMemo(
    () =>
      videos.filter(
        (vid) => !hiddenVideoIds.includes(vid.id) && (feedType === 'following' ? vid.isFollowing : true)
      ),
    [videos, hiddenVideoIds, feedType]
  );

  const safeIndex = Math.min(activeIndex, Math.max(filteredVideos.length - 1, 0));

  // Retour en haut quand on change d'onglet.
  useEffect(() => {
    activeIndexRef.current = 0;
    setActiveIndex(0);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [feedType]);

  // La vidéo active change dès que l'on dépasse 50 % de l'écran (au lieu
  // d'attendre 80 % + 80 ms avec onViewableItemsChanged) : lecture plus réactive.
  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const index = Math.round(e.nativeEvent.contentOffset.y / itemHeight);
      if (index >= 0 && index !== activeIndexRef.current) {
        activeIndexRef.current = index;
        setActiveIndex(index);
      }
    },
    [itemHeight]
  );

  // Précharge les miniatures des prochaines vidéos.
  useEffect(() => {
    for (let i = 1; i <= PREFETCH_POSTERS; i++) {
      const v = filteredVideos[safeIndex + i];
      const uri = v?.thumbnailUrlMedium || v?.thumbnailUrl || v?.thumbnailUrlLow;
      if (uri) Image.prefetch(uri).catch(() => {});
    }
  }, [safeIndex, filteredVideos]);

  const renderItem = useCallback(
    ({ item, index }: { item: any; index: number }) => (
      <VideoPost
        video={item}
        height={itemHeight}
        isActive={index === safeIndex && isFocused && appActive}
        // La vidéo suivante est montée en pause : elle se charge pendant que
        // l'on regarde la vidéo courante, donc elle démarre instantanément.
        shouldPreload={index === safeIndex + 1}
      />
    ),
    [safeIndex, isFocused, appActive, itemHeight]
  );

  const getItemLayout = useCallback(
    (_: any, index: number) => ({ length: itemHeight, offset: itemHeight * index, index }),
    [itemHeight]
  );

  return (
    <View className="flex-1 bg-black" onLayout={handleFeedLayout}>
      <StatusBar barStyle="light-content" translucent />

      <TouchableOpacity
        onPress={() => setShowLive(true)}
        className="absolute top-12 left-4 z-20 bg-red-600 border border-red-500 px-2.5 py-1 rounded-full flex-row items-center"
      >
        <Tv size={12} color="#ffffff" />
        <Text className="text-white text-[9px] font-extrabold tracking-widest uppercase ml-1">LIVE</Text>
      </TouchableOpacity>

      <View className="absolute top-12 left-0 right-0 z-10 flex-row justify-center items-center gap-x-6" pointerEvents="box-none">
        <TouchableOpacity onPress={() => setFeedType('following')} className="items-center py-1">
          <Text className={`text-sm font-bold ${feedType === 'following' ? 'text-white text-[15px]' : 'text-zinc-400'}`}>
            Following
          </Text>
          {feedType === 'following' && <View className="w-6 h-0.5 bg-white rounded-full mt-1" />}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setFeedType('foryou')} className="items-center py-1">
          <Text className={`text-sm font-bold ${feedType === 'foryou' ? 'text-white text-[15px]' : 'text-zinc-400'}`}>
            For You
          </Text>
          {feedType === 'foryou' && <View className="w-6 h-0.5 bg-white rounded-full mt-1" />}
        </TouchableOpacity>
      </View>

      {isFeedLoading ? (
        <View className="flex-1 items-center justify-center bg-black px-8">
          <View className="w-full h-[68%] rounded-2xl bg-zinc-900 overflow-hidden border border-zinc-800">
            <View className="flex-1 bg-zinc-800/80 items-center justify-center">
              <ActivityIndicator size="large" color="#ff0050" />
              <Text className="text-zinc-300 text-xs font-semibold mt-4">Préparation de la vidéo…</Text>
            </View>
            <View className="p-4 gap-y-3">
              <View className="w-32 h-3 rounded-full bg-zinc-700" />
              <View className="w-4/5 h-3 rounded-full bg-zinc-800" />
              <View className="w-1/2 h-3 rounded-full bg-zinc-800" />
            </View>
          </View>
        </View>
      ) : filteredVideos.length === 0 ? (
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
              <TouchableOpacity onPress={() => setFeedType('foryou')} className="bg-[#ff0050] px-6 py-3 rounded-full">
                <Text className="text-white font-extrabold text-sm">Explore For You</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View className="items-center">
              <View className="bg-zinc-900 p-5 rounded-full mb-4 border border-zinc-800">
                <Sparkles size={36} color="#888888" />
              </View>
              <Text className="text-white text-base font-extrabold text-center mb-2">No videos available</Text>
              <Text className="text-zinc-500 text-xs text-center">Check back later or upload a new creation!</Text>
            </View>
          )}
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={filteredVideos}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          extraData={`${safeIndex}-${isFocused}-${appActive}-${itemHeight}`}
          showsVerticalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          // Un swipe = une seule vidéo, même si le geste est très rapide :
          // disableIntervalMomentum empêche l'élan de dépasser le cran suivant.
          snapToInterval={itemHeight}
          snapToAlignment="start"
          disableIntervalMomentum
          decelerationRate="fast"
          getItemLayout={getItemLayout}
          initialNumToRender={2}
          maxToRenderPerBatch={2}
          updateCellsBatchingPeriod={30}
          windowSize={5}
          // removeClippedSubviews provoque des écrans noirs avec les vidéos sur Android.
          removeClippedSubviews={false}
          overScrollMode="never"
          bounces={false}
        />
      )}

      <LiveStreamModal isVisible={showLive} onClose={() => setShowLive(false)} />
    </View>
  );
}
