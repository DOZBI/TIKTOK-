import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { FlatList, View, Text, StatusBar, TouchableOpacity, AppState, useWindowDimensions, LayoutChangeEvent, ActivityIndicator, Image, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useVideoStore } from '../../store/useVideoStore';
import VideoPost from '../../components/VideoPost';
import LiveStreamModal from '../../components/LiveStreamModal';
import { pauseAll } from '../../lib/playbackManager';
import { Users, Sparkles, Tv, Shield } from 'lucide-react-native';

const TAB_BAR_HEIGHT = 60;
const PREFETCH_POSTERS = 3;

export default function HomeFeed() {
  const router = useRouter();
  const videos = useVideoStore((state) => state.videos);
  const hiddenVideoIds = useVideoStore((state) => state.hiddenVideoIds);
  const isFeedLoading = useVideoStore((state) => state.isFeedLoading);
  const { height: windowHeight } = useWindowDimensions();
  const [feedHeight, setFeedHeight] = useState(0);
  const fallbackItemHeight = Math.max(windowHeight - TAB_BAR_HEIGHT, 1);
  const itemHeight = feedHeight || fallbackItemHeight;

  const handleFeedLayout = useCallback((event: LayoutChangeEvent) => {
    const nextHeight = Math.round(event.nativeEvent.layout.height);
    if (nextHeight > 0) {
      setFeedHeight((currentHeight) => currentHeight === nextHeight ? currentHeight : nextHeight);
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

  // Pause quand l'app passe en arriÃ¨re-plan.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      const active = state === 'active';
      setAppActive(active);
      if (!active) pauseAll();
    });
    return () => sub.remove();
  }, []);

  // Pause quand on quitte l'onglet.
  useEffect(() => {
    if (!isFocused) pauseAll();
  }, [isFocused]);

  const filteredVideos = useMemo(
    () =>
      videos.filter(
        (vid) => !hiddenVideoIds.includes(vid.id) && (feedType === 'following' ? vid.isFollowing : true)
      ),
    [videos, hiddenVideoIds, feedType]
  );

  // Une seule vidÃ©o active : celle visible, sinon la premiÃ¨re de la liste.
  const safeIndex = Math.min(activeIndex, Math.max(filteredVideos.length - 1, 0));

  // Retour en haut quand on change d'onglet.
  useEffect(() => {
    activeIndexRef.current = 0;
    setActiveIndex(0);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [feedType]);

  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const nextIndex = Math.round(event.nativeEvent.contentOffset.y / itemHeight);
    if (nextIndex >= 0 && nextIndex !== activeIndexRef.current) {
      activeIndexRef.current = nextIndex;
      setActiveIndex(nextIndex);
    }
  }, [itemHeight]);

  useEffect(() => {
    for (let offset = 1; offset <= PREFETCH_POSTERS; offset += 1) {
      const nextVideo = filteredVideos[safeIndex + offset];
      const poster = nextVideo?.thumbnailUrlMedium || nextVideo?.thumbnailUrl || nextVideo?.thumbnailUrlLow;
      if (poster) void Image.prefetch(poster).catch(() => {});
    }
  }, [filteredVideos, safeIndex]);


  const renderItem = useCallback(
    ({ item, index }: { item: any; index: number }) => (
      <VideoPost
        video={item}
        height={itemHeight}
        isActive={index === safeIndex && isFocused && appActive}
        shouldPreload={index === safeIndex + 1 && isFocused && appActive}
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

      <TouchableOpacity
        onPress={() => router.push('/privacy')}
        className="absolute top-12 right-4 z-20 flex-row items-center rounded-full bg-black/50 px-2.5 py-1"
        accessibilityRole="button"
        accessibilityLabel="Informations de confidentialité"
      >
        <Shield size={13} color="#a1a1aa" />
        <Text className="text-zinc-400 text-[9px] ml-1">Confidentialité</Text>
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
          snapToInterval={itemHeight}
          snapToAlignment="start"
          disableIntervalMomentum
          decelerationRate="fast"
          initialNumToRender={2}
          maxToRenderPerBatch={2}
          updateCellsBatchingPeriod={30}
          windowSize={5}
          // removeClippedSubviews provoque des Ã©crans noirs avec les vidÃ©os sur Android.
          removeClippedSubviews={false}
          getItemLayout={getItemLayout}
          overScrollMode="never"
          bounces={false}
        />
      )}

      <LiveStreamModal isVisible={showLive} onClose={() => setShowLive(false)} />
    </View>
  );
}
