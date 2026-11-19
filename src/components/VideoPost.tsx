import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, Image, Dimensions, TouchableOpacity, Pressable, Modal, ScrollView, TextInput, Alert, ActivityIndicator, LayoutChangeEvent } from 'react-native';
import { Heart, MessageCircle, Share2, Plus, Music, Send, X, Bookmark, EyeOff, AlertTriangle, Download, Columns, Camera, Send as DirectMessageIcon } from 'lucide-react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing, cancelAnimation, runOnJS } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { useVideoStore, VideoPost as VideoPostType } from '../store/useVideoStore';
import CreatorProfileOverlay from './CreatorProfileOverlay';
import SoundDetailOverlay from './SoundDetailOverlay';
import { claimPlayback } from '../lib/playbackManager';
import { getNetworkQuality, resolveVideoSource } from '../lib/adaptiveSource';
import { useRouter } from 'expo-router';
import { getOrCreateConversation } from '../lib/messaging';
import VideoSurface from './VideoSurface';

const { width } = Dimensions.get('window');

interface VideoPostItemProps {
  video: VideoPostType;
  isActive: boolean;
  height: number;
  shouldPreload?: boolean;
}

function FloatingHeart({ x, y, onComplete }: { x: number; y: number; onComplete: () => void }) {
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  const rotate = useSharedValue(Math.random() * 40 - 20);

  useEffect(() => {
    translateY.value = withTiming(-150, { duration: 800, easing: Easing.out(Easing.quad) });
    scale.value = withTiming(0.4, { duration: 800 });
    opacity.value = withTiming(0, { duration: 800 }, (finished) => {
      if (finished) runOnJS(onComplete)();
    });
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: x - 20 },
      { translateY: y - 20 + translateY.value },
      { scale: scale.value },
      { rotate: `${rotate.value}deg` },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', zIndex: 50 }, animatedStyle]}>
      <Heart size={35} color="#ff0050" fill="#ff0050" />
    </Animated.View>
  );
}

function VideoPost({ video, isActive, height, shouldPreload = false }: VideoPostItemProps) {
  const router = useRouter();
  const toggleLike = useVideoStore((state) => state.toggleLike);
  const toggleFollow = useVideoStore((state) => state.toggleFollow);
  const addComment = useVideoStore((state) => state.addComment);
  const hideVideo = useVideoStore((state) => state.hideVideo);
  const toggleCommentLike = useVideoStore((state) => state.toggleCommentLike);
  const replyToComment = useVideoStore((state) => state.replyToComment);
  const isLoggedIn = useVideoStore((state) => state.isLoggedIn);
  const setShowAuthModal = useVideoStore((state) => state.setShowAuthModal);
  const [showComments, setShowComments] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [isProfileVisible, setIsProfileVisible] = useState(false);
  const [isSoundVisible, setIsSoundVisible] = useState(false);
  const [isDuetActive, setIsDuetActive] = useState(false);
  const [commentInput, setCommentInput] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [isFavorited, setIsFavorited] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [player, setPlayer] = useState<any | null>(null);
  const [floatingHearts, setFloatingHearts] = useState<Array<{ id: string; x: number; y: number }>>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const seekbarWidth = useRef(width - 32 - 70);
  const downloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const rotateDisk = useSharedValue(0);
  const waveScale = useSharedValue(1);

  // Format choisi au moment oÃ¹ la vidÃ©o devient active (pas de redÃ©marrage si
  // le rÃ©seau fluctue pendant la lecture). RÃ©seau faible => variante "low".
  const mounted = isActive || shouldPreload;
  const source = useMemo(() => {
    const resolvedSource = resolveVideoSource(video.videoUrl, getNetworkQuality());
    if (typeof resolvedSource === 'string') return { uri: resolvedSource, useCaching: true };
    if (resolvedSource && typeof resolvedSource === 'object') return { ...resolvedSource, useCaching: true };
    return resolvedSource;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video.videoUrl, mounted]);

  const poster = video.thumbnailUrlMedium || video.thumbnailUrl || video.thumbnailUrlLow;

  const shouldPlay =
    isActive && !showComments && !showOptions && !isDownloading && !isProfileVisible && !isSoundVisible && !isDuetActive;

  useEffect(() => {
    return () => {
      if (downloadTimer.current) clearTimeout(downloadTimer.current);
    };
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;

    if (shouldPlay && player) {
      rotateDisk.value = withRepeat(withTiming(360, { duration: 3000, easing: Easing.linear }), -1, false);
      timer = setInterval(() => {
        try {
          setCurrentTime(player.currentTime || 0);
          setDuration(player.duration || 0);
        } catch {
          // lecteur libÃ©rÃ© entre-temps
        }
      }, 500);
    } else {
      cancelAnimation(rotateDisk);
      if (!isActive) {
        rotateDisk.value = 0;
        setCurrentTime(0);
      }
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [shouldPlay, player, isActive]);

  useEffect(() => {
    if (isDuetActive) {
      waveScale.value = withRepeat(withTiming(1.3, { duration: 1000, easing: Easing.ease }), -1, true);
    } else {
      cancelAnimation(waveScale);
      waveScale.value = 1;
    }
  }, [isDuetActive]);

  // Quand la vidÃ©o n'est plus active : on referme tout ce qui Ã©tait ouvert.
  useEffect(() => {
    if (!isActive) {
      setShowComments(false);
      setShowOptions(false);
      setIsProfileVisible(false);
      setIsSoundVisible(false);
      setIsDuetActive(false);
      setPlayer(null);
    }
  }, [isActive]);

  const handlePlayerReady = useCallback((nextPlayer: any | null) => {
    setPlayer(nextPlayer);
  }, []);

  const animatedDiskStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotateDisk.value}deg` }] }));
  const animatedWaveStyle = useAnimatedStyle(() => ({ transform: [{ scale: waveScale.value }] }));

  const handleDoubleTap = (x: number, y: number) => {
    if (!isLoggedIn) {
      setShowAuthModal(true);
      return;
    }
    if (!video.isLiked) toggleLike(video.id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setFloatingHearts((prev) => [...prev, { id: `heart_${Date.now()}_${Math.random()}`, x, y }]);
  };

  const handlePress = () => {
    if (!player) return;
    try {
      if (player.playing) player.pause();
      else {
        claimPlayback(player);
        player.play();
      }
    } catch {
      // lecteur libÃ©rÃ©
    }
  };

  const handleLongPress = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setShowOptions(true);
  };

  const openDirectMessage = async () => {
    if (!isLoggedIn) {
      setShowAuthModal(true);
      return;
    }
    if (!video.authorId || video.authorId === useVideoStore.getState().currentUser.id) {
      Alert.alert('Message', 'Tu ne peux pas envoyer un message à ton propre compte.');
      return;
    }
    try {
      const conversationId = await getOrCreateConversation(video.authorId);
      router.push(`/chat/${conversationId}`);
    } catch (error) {
      Alert.alert('Messagerie indisponible', error instanceof Error ? error.message : 'Réessaie plus tard.');
    }
  };

  const submitComment = () => {
    if (!isLoggedIn) {
      setShowAuthModal(true);
      return;
    }
    if (commentInput.trim() === '') return;
    if (replyingTo) {
      replyToComment(video.id, replyingTo, commentInput);
      setReplyingTo(null);
    } else {
      addComment(video.id, commentInput);
    }
    setCommentInput('');
  };

  const handleSaveVideo = () => {
    setShowOptions(false);
    setIsDownloading(true);
    downloadTimer.current = setTimeout(() => {
      setIsDownloading(false);
      Alert.alert('Success', 'Video saved successfully to your gallery!');
    }, 1500);
  };

  const handleFavoriteToggle = () => {
    setShowOptions(false);
    const next = !isFavorited;
    setIsFavorited(next);
    Alert.alert('Favorites', next ? 'Added to Favorites' : 'Removed from Favorites');
  };

  const handleNotInterested = () => {
    setShowOptions(false);
    Alert.alert('Hiding Video', 'We will show you fewer videos like this in the future.', [
      { text: 'Undo', style: 'cancel' },
      { text: 'Confirm', onPress: () => hideVideo(video.id) },
    ]);
  };

  const handleDuetToggle = () => {
    setShowOptions(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const next = !isDuetActive;
    setIsDuetActive(next);
    Alert.alert('Duet Mode', next ? 'Duet mode activated! Reaction viewfinder initialized side-by-side.' : 'Split screen duet closed.');
  };

  const handleScrub = (event: any) => {
    if (!player || !duration) return;
    const { locationX } = event.nativeEvent;
    const percentage = Math.min(Math.max(locationX / seekbarWidth.current, 0), 1);
    const newTime = percentage * duration;
    try {
      player.currentTime = newTime;
      setCurrentTime(newTime);
    } catch {
      // lecteur libÃ©rÃ©
    }
  };

  const onSeekbarLayout = (e: LayoutChangeEvent) => {
    seekbarWidth.current = Math.max(e.nativeEvent.layout.width, 1);
  };

  // Le geste vertical reste libre pour la FlatList ; seul un balayage vers la
  // gauche ouvre le profil.
  const swipeGesture = Gesture.Pan()
    .activeOffsetX([-20, 20])
    .failOffsetY([-15, 15])
    .onEnd((event) => {
      if (event.translationX < -50 || event.velocityX < -300) {
        runOnJS(setIsProfileVisible)(true);
      }
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .maxDelay(250)
    .onEnd((event, success) => {
      if (success) runOnJS(handleDoubleTap)(event.x, event.y);
    });

  const singleTapGesture = Gesture.Tap().onEnd((_e, success) => {
    if (success) runOnJS(handlePress)();
  });

  // Exclusive : le simple tap attend que le double tap Ã©choue (sinon un double
  // tap dÃ©clenchait aussi pause/lecture).
  const composedGesture = Gesture.Race(swipeGesture, Gesture.Exclusive(doubleTapGesture, singleTapGesture));

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <View style={{ height, width }} className="relative justify-end bg-black">
      <View className="flex-1 flex-row">
        <View style={{ flex: 1 }} className="relative bg-zinc-950 justify-center">
          {/* Image d'aperÃ§u affichÃ©e instantanÃ©ment, avant la premiÃ¨re image vidÃ©o */}
          {poster ? (
            <Image source={{ uri: poster }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : null}

          <GestureDetector gesture={composedGesture} touchAction="pan-y">
            <Pressable
              style={StyleSheet.absoluteFill}
              onLongPress={handleLongPress}
              delayLongPress={500}
            >
              <Animated.View style={StyleSheet.absoluteFill}>
                {mounted && (
                  <VideoSurface
                    key={video.id}
                    source={source}
                    shouldPlay={shouldPlay}
                    isActive={isActive}
                    onReady={handlePlayerReady}
                  />
                )}
              </Animated.View>
              {floatingHearts.map((heart) => (
                <FloatingHeart
                  key={heart.id}
                  x={heart.x}
                  y={heart.y}
                  onComplete={() => setFloatingHearts((prev) => prev.filter((h) => h.id !== heart.id))}
                />
              ))}
            </Pressable>
          </GestureDetector>
        </View>

        {isDuetActive && (
          <View style={{ width: width / 2 }} className="bg-zinc-900 border-l border-zinc-800 items-center justify-center relative">
            <View className="absolute top-14 left-3 bg-[#ff0050] px-2 py-0.5 rounded">
              <Text className="text-white text-[8px] font-extrabold uppercase tracking-widest">React Live</Text>
            </View>
            <Animated.View style={animatedWaveStyle} className="w-20 h-20 rounded-full border border-pink-500/20 items-center justify-center mb-4">
              <View className="w-16 h-16 rounded-full bg-zinc-950 items-center justify-center border border-zinc-800">
                <Camera size={26} color="#db2777" />
              </View>
            </Animated.View>
            <Text className="text-white font-extrabold text-[11px] text-center px-4">Your React Feed</Text>
            <Text className="text-zinc-500 text-[9px] text-center mt-1">Recording reaction synced...</Text>
          </View>
        )}
      </View>

      {isDownloading && (
        <View className="absolute inset-0 bg-black/60 z-40 items-center justify-center">
          <View className="bg-zinc-900/90 border border-zinc-800 p-6 rounded-2xl items-center">
            <ActivityIndicator size="large" color="#ff0050" />
            <Text className="text-white text-sm font-bold mt-4">Downloading Video...</Text>
          </View>
        </View>
      )}

      {/* Voile sombre en bas (les dÃ©gradÃ©s Tailwind ne marchent pas en natif) */}
      <View pointerEvents="none" className="absolute bottom-0 left-0 right-0 h-72 bg-black/30" />

      <View className="absolute bottom-10 left-4 right-24 z-10">
        <View className="flex-row items-center mb-2">
          <TouchableOpacity onPress={() => setIsProfileVisible(true)} className="flex-row items-center">
            <Text className="text-white font-extrabold text-base">@{video.username}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              if (!isLoggedIn) setShowAuthModal(true);
              else toggleFollow(video.id);
            }}
            className={`ml-3 px-2 py-0.5 rounded ${video.isFollowing ? 'bg-zinc-800' : 'bg-[#ff0050]'}`}
          >
            <Text className="text-white text-[10px] font-bold">{video.isFollowing ? 'Following' : 'Follow'}</Text>
          </TouchableOpacity>
        </View>

        <Text className="text-gray-100 text-sm mb-3" numberOfLines={3}>
          {video.description}
        </Text>

        <TouchableOpacity onPress={() => setIsSoundVisible(true)} className="flex-row items-center">
          <Music size={14} color="#ffffff" />
          <Text className="text-white text-xs font-medium ml-2 underline" numberOfLines={1}>
            {video.music}
          </Text>
        </TouchableOpacity>
      </View>

      <View className="absolute bottom-12 right-3 items-center z-10 gap-y-5">
        <View className="relative mb-2">
          <TouchableOpacity onPress={() => setIsProfileVisible(true)}>
            <Image source={{ uri: video.userAvatar || undefined }} className="w-12 h-12 rounded-full border border-white bg-zinc-800" />
          </TouchableOpacity>
          {!video.isFollowing && (
            <TouchableOpacity
              className="absolute -bottom-2 self-center bg-[#ff0050] rounded-full p-0.5 border border-white"
              onPress={() => {
                if (!isLoggedIn) setShowAuthModal(true);
                else toggleFollow(video.id);
              }}
            >
              <Plus size={10} color="#ffffff" strokeWidth={3} />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          className="items-center"
          onPress={() => {
            if (!isLoggedIn) setShowAuthModal(true);
            else {
              toggleLike(video.id);
              if (!video.isLiked) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
          }}
        >
          <View className="bg-black/40 p-2.5 rounded-full">
            <Heart size={26} color={video.isLiked ? '#ff0050' : '#ffffff'} fill={video.isLiked ? '#ff0050' : 'transparent'} />
          </View>
          <Text className="text-white text-xs font-semibold mt-1">{video.likes.toLocaleString()}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setShowComments(true)} className="items-center">
          <View className="bg-black/40 p-2.5 rounded-full">
            <MessageCircle size={26} color="#ffffff" fill="transparent" />
          </View>
          <Text className="text-white text-xs font-semibold mt-1">{video.commentsCount.toLocaleString()}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => void openDirectMessage()} className="items-center" accessibilityRole="button" accessibilityLabel={`Envoyer un message à ${video.username}`}>
          <View className="bg-black/40 p-2.5 rounded-full">
            <DirectMessageIcon size={24} color="#ffffff" />
          </View>
          <Text className="text-white text-[10px] font-semibold mt-1">Message</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setShowOptions(true)} className="items-center">
          <View className="bg-black/40 p-2.5 rounded-full">
            <Share2 size={26} color="#ffffff" fill="transparent" />
          </View>
          <Text className="text-white text-xs font-semibold mt-1">{video.shares.toLocaleString()}</Text>
        </TouchableOpacity>

        <Animated.View style={[animatedDiskStyle, { marginTop: 8 }]}>
          <TouchableOpacity onPress={() => setIsSoundVisible(true)}>
            <View className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-700 items-center justify-center">
              <Image source={{ uri: video.userAvatar || undefined }} className="w-6 h-6 rounded-full" />
            </View>
          </TouchableOpacity>
        </Animated.View>
      </View>

      <View className="absolute bottom-2 left-0 right-0 px-4 z-20 flex-row items-center justify-between">
        <Pressable onPress={handleScrub} onLayout={onSeekbarLayout} className="flex-1 h-4 justify-center mr-3">
          <View className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
            <View
              className="h-full bg-zinc-200"
              style={{ width: `${duration > 0 ? Math.min((currentTime / duration) * 100, 100) : 0}%` }}
            />
          </View>
        </Pressable>
        <Text className="text-zinc-400 text-[9px] font-bold">
          {formatTime(currentTime)} / {formatTime(duration)}
        </Text>
      </View>

      <CreatorProfileOverlay
        isVisible={isProfileVisible}
        onClose={() => setIsProfileVisible(false)}
        username={video.username}
        avatar={video.userAvatar}
        isFollowing={video.isFollowing}
        onToggleFollow={() => toggleFollow(video.id)}
      />

      <SoundDetailOverlay isVisible={isSoundVisible} onClose={() => setIsSoundVisible(false)} musicTitle={video.music} />

      <Modal visible={showOptions} animationType="slide" transparent onRequestClose={() => setShowOptions(false)}>
        <View className="flex-1 bg-black/60 justify-end">
          <Pressable className="flex-1" onPress={() => setShowOptions(false)} />
          <View className="bg-zinc-900 rounded-t-3xl border-t border-zinc-800 p-6 pb-10">
            <View className="items-center mb-5">
              <View className="w-10 h-1 bg-zinc-700 rounded-full mb-3" />
              <Text className="text-zinc-400 text-xs font-bold uppercase tracking-wider">Video Options</Text>
            </View>

            <View className="gap-y-4">
              <TouchableOpacity onPress={handleSaveVideo} className="bg-zinc-800 p-4 rounded-2xl flex-row items-center">
                <Download size={20} color="#ffffff" />
                <Text className="text-white text-sm font-bold ml-4">Save Video</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={handleFavoriteToggle} className="bg-zinc-800 p-4 rounded-2xl flex-row items-center">
                <Bookmark size={20} color={isFavorited ? '#eab308' : '#ffffff'} fill={isFavorited ? '#eab308' : 'transparent'} />
                <Text className="text-white text-sm font-bold ml-4">{isFavorited ? 'Remove from Favorites' : 'Add to Favorites'}</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={handleDuetToggle} className="bg-zinc-800 p-4 rounded-2xl flex-row items-center">
                <Columns size={20} color={isDuetActive ? '#ff0050' : '#ffffff'} />
                <Text className="text-white text-sm font-bold ml-4">{isDuetActive ? 'Close Duet split' : 'Duet split screen'}</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={handleNotInterested} className="bg-zinc-800 p-4 rounded-2xl flex-row items-center">
                <EyeOff size={20} color="#f87171" />
                <Text className="text-red-400 text-sm font-bold ml-4">Not Interested</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setShowOptions(false);
                  Alert.alert('Reported', 'Thank you. We will review this video shortly.');
                }}
                className="bg-zinc-800 p-4 rounded-2xl flex-row items-center"
              >
                <AlertTriangle size={20} color="#eab308" />
                <Text className="text-yellow-400 text-sm font-bold ml-4">Report Content</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity onPress={() => setShowOptions(false)} className="mt-6 py-4 rounded-2xl border border-zinc-800 bg-zinc-950 items-center">
              <Text className="text-white font-extrabold text-sm">Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showComments} animationType="slide" transparent onRequestClose={() => setShowComments(false)}>
        <View className="flex-1 bg-black/60 justify-end">
          <Pressable className="flex-1" onPress={() => setShowComments(false)} />

          <View className="bg-zinc-900 rounded-t-3xl h-[65%] border-t border-zinc-800">
            <View className="flex-row items-center justify-between px-4 py-3.5 border-b border-zinc-800">
              <Text className="font-bold text-white text-base">Comments ({video.comments.length})</Text>
              <TouchableOpacity onPress={() => setShowComments(false)}>
                <X size={22} color="#888888" />
              </TouchableOpacity>
            </View>

            <ScrollView className="flex-1 p-4" keyboardShouldPersistTaps="handled">
              {video.comments.length === 0 ? (
                <View className="py-20 items-center justify-center">
                  <MessageCircle size={48} color="#555555" />
                  <Text className="text-gray-500 text-sm mt-3">No comments yet. Start the conversation!</Text>
                </View>
              ) : (
                video.comments.map((comment) => (
                  <View key={comment.id} className="flex-row mb-5">
                    <Image source={{ uri: comment.avatar || undefined }} className="w-8 h-8 rounded-full mr-3 border border-zinc-700 bg-zinc-800" />
                    <View className="flex-1 border-b border-zinc-800/50 pb-3">
                      <View className="flex-row items-center justify-between">
                        <Text className="text-zinc-400 text-xs font-bold">{comment.username}</Text>
                        <View className="flex-row items-center">
                          <Text className="text-zinc-500 text-[10px] mr-2">{comment.timestamp}</Text>
                          <TouchableOpacity
                            onPress={() => {
                              if (!isLoggedIn) setShowAuthModal(true);
                              else toggleCommentLike(video.id, comment.id);
                            }}
                          >
                            <Heart size={14} color={comment.isLiked ? '#ff0050' : '#888888'} fill={comment.isLiked ? '#ff0050' : 'transparent'} />
                          </TouchableOpacity>
                        </View>
                      </View>
                      <Text className="text-white text-sm mt-1">{comment.text}</Text>
                      <TouchableOpacity className="mt-1" onPress={() => setReplyingTo(comment.id)}>
                        <Text className="text-zinc-500 text-xs font-bold">Reply</Text>
                      </TouchableOpacity>

                      {comment.replies &&
                        comment.replies.map((reply) => (
                          <View key={reply.id} className="flex-row mt-3">
                            <Image source={{ uri: reply.avatar || undefined }} className="w-6 h-6 rounded-full mr-2 bg-zinc-800" />
                            <View className="flex-1">
                              <View className="flex-row items-center justify-between">
                                <Text className="text-zinc-400 text-[10px] font-bold">{reply.username}</Text>
                                <Text className="text-zinc-500 text-[9px]">{reply.timestamp}</Text>
                              </View>
                              <Text className="text-white text-xs mt-0.5">{reply.text}</Text>
                            </View>
                          </View>
                        ))}
                    </View>
                  </View>
                ))
              )}
            </ScrollView>

            <View className="p-4 border-t border-zinc-800 bg-zinc-900 pb-8">
              <View className="flex-row items-center justify-between px-2 mb-3">
                {['ðŸ˜‚', 'ðŸ¥°', 'ðŸ¥º', 'ðŸ”¥', 'ðŸ‘', 'âœ¨', 'ðŸ’€', 'ðŸ’¯'].map((emoji) => (
                  <TouchableOpacity key={emoji} onPress={() => setCommentInput((prev) => prev + emoji)}>
                    <Text className="text-2xl">{emoji}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {replyingTo && (
                <View className="flex-row justify-between mb-2 px-1">
                  <Text className="text-zinc-400 text-xs">Replying to comment...</Text>
                  <TouchableOpacity onPress={() => setReplyingTo(null)}>
                    <Text className="text-zinc-500 text-xs">Cancel</Text>
                  </TouchableOpacity>
                </View>
              )}
              <View className="flex-row items-center">
                <View className="flex-1 bg-zinc-800 rounded-full px-4 py-2.5 flex-row items-center">
                  <TextInput
                    className="flex-1 text-white text-sm h-6"
                    placeholder={replyingTo ? 'Add a reply...' : 'Add a comment...'}
                    placeholderTextColor="#888888"
                    value={commentInput}
                    onChangeText={setCommentInput}
                    onSubmitEditing={submitComment}
                    returnKeyType="send"
                  />
                  <TouchableOpacity onPress={submitComment}>
                    <Send size={18} color={commentInput.trim() ? '#ff0050' : '#888888'} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

export default React.memo(VideoPost);
