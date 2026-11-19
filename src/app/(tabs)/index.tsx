import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StatusBar,
  TouchableOpacity,
  AppState,
  useWindowDimensions,
  LayoutChangeEvent,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedReaction,
  withSpring,
  cancelAnimation,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useVideoStore } from '../../store/useVideoStore';
import VideoPost from '../../components/VideoPost';
import LiveStreamModal from '../../components/LiveStreamModal';
import { pauseAll } from '../../lib/playbackManager';
import { Users, Sparkles, Tv } from 'lucide-react-native';

const TAB_BAR_HEIGHT = 60;
const PREFETCH_POSTERS = 3;

// Réglages du "feeling" Shorts : à ajuster si besoin.
const SWIPE_DISTANCE_RATIO = 0.15; // % de la hauteur à dépasser pour changer de vidéo
const SWIPE_VELOCITY = 500; // px/s : un petit geste rapide suffit aussi
const EDGE_RESISTANCE = 0.3; // effet élastique sur la première/dernière vidéo

/**
 * Une page du pager. Sa position dépend uniquement de `position` (index continu,
 * ex. 1.4 = entre la vidéo 1 et la vidéo 2) : tout est animé sur le thread UI,
 * sans re-render React pendant le geste.
 */
function PagerItem({
  index,
  position,
  height,
  children,
}: {
  index: number;
  position: Animated.SharedValue<number>;
  height: number;
  children: React.ReactNode;
}) {
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (index - position.value) * height }],
  }));

  return (
    <Animated.View
      style={[{ position: 'absolute', top: 0, left: 0, right: 0, height }, animatedStyle]}
    >
      {children}
    </Animated.View>
  );
}

export default function HomeFeed() {
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
      setFeedHeight((currentHeight) => (currentHeight === nextHeight ? currentHeight : nextHeight));
    }
  }, []);

  const [feedType, setFeedType] = useState<'following' | 'foryou'>('foryou');
  const [activeIndex, setActiveIndex] = useState(0);
  const [showLive, setShowLive] = useState<boolean>(false);
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const [isFocused, setIsFocused] = useState(true);

  // Index continu du pager (thread UI) et position au début du geste.
  const position = useSharedValue(0);
  const startPosition = useSharedValue(0);

  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      return () => {
        setIsFocused(false);
        pauseAll();
      };
    }, [])
  );

  // Pause quand l'app passe en arrière-plan.
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

  const count = filteredVideos.length;
  const safeIndex = Math.min(activeIndex, Math.max(count - 1, 0));

  // Retour en haut quand on change d'onglet.
  useEffect(() => {
    cancelAnimation(position);
    position.value = 0;
    setActiveIndex(0);
  }, [feedType, position]);

  // Si la liste raccourcit (vidéo masquée en fin de liste), on reste dans les bornes.
  useEffect(() => {
    const max = Math.max(count - 1, 0);
    if (activeIndex > max) {
      cancelAnimation(position);
      position.value = max;
      setActiveIndex(max);
    }
  }, [count, activeIndex, position]);

  // La vidéo active change dès que l'on passe 50 % : lecture immédiate.
  useAnimatedReaction(
    () => Math.round(position.value),
    (current, previous) => {
      if (current !== previous) runOnJS(setActiveIndex)(current);
    }
  );

  // Pan vertical : un geste = au plus UNE vidéo (précédente ou suivante).
  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY([-12, 12])
        .failOffsetX([-20, 20]) // le swipe horizontal (profil) reste géré par VideoPost
        .onStart(() => {
          cancelAnimation(position);
          startPosition.value = position.value;
        })
        .onUpdate((event) => {
          const maxIndex = Math.max(count - 1, 0);
          let next = startPosition.value - event.translationY / itemHeight;
          if (next < 0) next = next * EDGE_RESISTANCE;
          else if (next > maxIndex) next = maxIndex + (next - maxIndex) * EDGE_RESISTANCE;
          position.value = next;
        })
        .onEnd((event) => {
          const maxIndex = Math.max(count - 1, 0);
          const base = Math.round(startPosition.value);
          let target = base;
          if (event.translationY < -itemHeight * SWIPE_DISTANCE_RATIO || event.velocityY < -SWIPE_VELOCITY) {
            target = base + 1;
          } else if (event.translationY > itemHeight * SWIPE_DISTANCE_RATIO || event.velocityY > SWIPE_VELOCITY) {
            target = base - 1;
          }
          target = Math.min(Math.max(target, 0), maxIndex);

          position.value = withSpring(target, {
            damping: 28,
            stiffness: 260,
            mass: 1,
            overshootClamping: true,
            velocity: -event.velocityY / itemHeight,
          });
        }),
    [count, itemHeight, position, startPosition]
  );

  // Précharge les miniatures des prochaines vidéos.
  useEffect(() => {
    for (let offset = 1; offset <= PREFETCH_POSTERS; offset += 1) {
      const nextVideo = filteredVideos[safeIndex + offset];
      const poster = nextVideo?.thumbnailUrlMedium || nextVideo?.thumbnailUrl || nextVideo?.thumbnailUrlLow;
      if (poster) void Image.prefetch(poster).catch(() => {});
    }
  }, [filteredVideos, safeIndex]);

  // Fenêtre de 3 pages montées : précédente, courante, suivante.
  const windowIndexes: number[] = [];
  for (let i = Math.max(safeIndex - 1, 0); i <= Math.min(safeIndex + 1, count - 1); i += 1) {
    windowIndexes.push(i);
  }

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
      ) : count === 0 ? (
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
        <GestureDetector gesture={panGesture}>
          <Animated.View style={{ flex: 1, overflow: 'hidden' }} collapsable={false}>
            {windowIndexes.map((index) => {
              const video = filteredVideos[index];
              return (
                <PagerItem key={video.id} index={index} position={position} height={itemHeight}>
                  <VideoPost
                    video={video}
                    height={itemHeight}
                    isActive={index === safeIndex && isFocused && appActive}
                    shouldPreload={index === safeIndex + 1 && isFocused && appActive}
                  />
                </PagerItem>
              );
            })}
          </Animated.View>
        </GestureDetector>
      )}

      <LiveStreamModal isVisible={showLive} onClose={() => setShowLive(false)} />
    </View>
  );
}
