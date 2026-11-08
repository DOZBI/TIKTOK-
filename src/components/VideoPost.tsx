import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Image, Dimensions, TouchableOpacity, Pressable, Modal, ScrollView, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Heart, MessageCircle, Share2, Plus, Music, Send, X, Bookmark, EyeOff, AlertTriangle, Download, Columns, Camera } from 'lucide-react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withRepeat, withTiming, Easing, cancelAnimation, runOnJS } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { useVideoStore, VideoPost as VideoPostType } from '../store/useVideoStore';
import CreatorProfileOverlay from './CreatorProfileOverlay';
import SoundDetailOverlay from './SoundDetailOverlay';

const { height, width } = Dimensions.get('window');
const VIEW_HEIGHT = height - 60;

interface VideoPostItemProps {
  video: VideoPostType;
  isActive: boolean;
}

function FloatingHeart({ x, y, onComplete }: { x: number; y: number; onComplete: () => void }) {
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  const rotate = useSharedValue(Math.random() * 40 - 20);

  useEffect(() => {
    translateY.value = withTiming(-150, { duration: 800, easing: Easing.out(Easing.quad) });
    scale.value = withTiming(0.4, { duration: 800 });
    opacity.value = withTiming(0, { duration: 800 }, () => {
      runOnJS(onComplete)();
    });
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: x - 20 },
        { translateY: y - 20 + translateY.value },
        { scale: scale.value },
        { rotate: `${rotate.value}deg` },
      ],
      opacity: opacity.value,
    };
  });

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          zIndex: 50,
          pointerEvents: 'none',
        },
        animatedStyle,
      ]}
    >
      <Heart size={35} color="#ff0050" fill="#ff0050" />
    </Animated.View>
  );
}

export default function VideoPost({ video, isActive }: VideoPostItemProps) {
  const { toggleLike, toggleFollow, addComment, hideVideo, toggleCommentLike, replyToComment, isLoggedIn, setShowAuthModal } = useVideoStore();
  const [showComments, setShowComments] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [isProfileVisible, setIsProfileVisible] = useState(false);
  const [isSoundVisible, setIsSoundVisible] = useState(false);
  const [isDuetActive, setIsDuetActive] = useState(false);
  const [commentInput, setCommentInput] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [isFavorited, setIsFavorited] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const [floatingHearts, setFloatingHearts] = useState<Array<{ id: string; x: number; y: number }>>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const rotateDisk = useSharedValue(0);

  // Duet pulsing reaction wave
  const waveScale = useSharedValue(1);

  const player = useVideoPlayer(video.videoUrl, (playerInstance) => {
    playerInstance.loop = true;
    playerInstance.muted = false;
  });

  useEffect(() => {
    let timer: any;
    const shouldPlay = isActive && !showComments && !showOptions && !isDownloading;

    if (shouldPlay) {
      try {
        if (isActive && !isProfileVisible && !showComments && !showOptions && !isDownloading && !isDuetActive) {
          player.play();
        }
      } catch (e) {
        console.log('Playback prevented synchronously:', e);
      }
      rotateDisk.value = withRepeat(
        withTiming(360, { duration: 3000, easing: Easing.linear }),
        -1,
        false
      );

      timer = setInterval(() => {
        if (player) {
          setCurrentTime(player.currentTime || 0);
          setDuration(player.duration || 0);
        }
      }, 250);

      // Start duet wave animation
      if (isDuetActive) {
        waveScale.value = withRepeat(
          withTiming(1.3, { duration: 1000, easing: Easing.ease }),
          -1,
          true
        );
      }
    } else {
      player.pause();
      cancelAnimation(rotateDisk);
      cancelAnimation(waveScale);
      
      if (!isActive) {
        rotateDisk.value = 0;
        setCurrentTime(0);
        waveScale.value = 1;
      }
    }
    return () => {
      clearInterval(timer);
    };
  }, [isActive, player, isDuetActive, showComments, showOptions, isDownloading]);

  const animatedDiskStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotate: `${rotateDisk.value}deg` }],
    };
  });

  const animatedWaveStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: waveScale.value }],
    };
  });

  const handleDoubleTap = (x: number, y: number) => {
    if (!isLoggedIn) {
      setShowAuthModal(true);
      return;
    }
    if (!video.isLiked) {
      toggleLike(video.id);
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const newHeart = {
      id: `heart_${Date.now()}_${Math.random()}`,
      x,
      y,
    };
    setFloatingHearts((prev) => [...prev, newHeart]);
  };

  const handlePress = () => {
    if (player.playing) {
      player.pause();
    } else {
      player.play();
    }
  };

  const handleLongPress = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setShowOptions(true);
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
    setTimeout(() => {
      setIsDownloading(false);
      Alert.alert('Success', 'Video saved successfully to your gallery!');
    }, 1500);
  };

  const handleFavoriteToggle = () => {
    setShowOptions(false);
    setIsFavorited(!isFavorited);
    Alert.alert('Favorites', isFavorited ? 'Removed from Favorites' : 'Added to Favorites');
  };

  const handleNotInterested = () => {
    setShowOptions(false);
    Alert.alert(
      'Hiding Video',
      'We will show you fewer videos like this in the future.',
      [
        { text: 'Undo', style: 'cancel' },
        { text: 'Confirm', onPress: () => hideVideo(video.id) },
      ]
    );
  };

  const handleDuetToggle = () => {
    setShowOptions(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsDuetActive(!isDuetActive);
    Alert.alert(
      'Duet Mode',
      isDuetActive ? 'Split screen duet closed.' : 'Duet mode activated! Reaction viewfinder initialized side-by-side.'
    );
  };

  const handleScrub = (event: any) => {
    const { locationX } = event.nativeEvent;
    // Adapt seekbar scrub width based on Duet split layout
    const seekbarWidth = isDuetActive ? (width / 2) - 24 : width - 32;
    const percentage = Math.min(Math.max(locationX / seekbarWidth, 0), 1);
    const newTime = percentage * duration;
    player.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const swipeGesture = Gesture.Pan()
    .activeOffsetX([-10, 0])
    .onEnd((event) => {
      if (event.translationX < -50 || event.velocityX < -300) {
        runOnJS(setIsProfileVisible)(true);
      }
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((event) => {
      runOnJS(handleDoubleTap)(event.x, event.y);
    });

  const singleTapGesture = Gesture.Tap()
    .onEnd(() => {
      runOnJS(handlePress)();
    });

  const composedGesture = Gesture.Race(swipeGesture, doubleTapGesture, singleTapGesture);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <View style={{ height: VIEW_HEIGHT, width }} className="relative justify-end bg-black">
      {/* Duet split layout or normal layout container */}
      <View className="flex-1 flex-row">
        
        {/* Left view (Original Video player) */}
        <View style={{ flex: 1 }} className="relative bg-zinc-950 justify-center">
          <GestureDetector gesture={composedGesture}>
            <Pressable
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
              onLongPress={handleLongPress}
              delayLongPress={500}
            >
              {/* Background Video */}
              <Animated.View style={StyleSheet.absoluteFill}>
                <VideoView
                  player={player}
                  style={{ width: '100%', height: '100%' }}
                  contentFit="cover"
                  nativeControls={false}
                />
              </Animated.View>
              {floatingHearts.map((heart) => (
                <FloatingHeart
                  key={heart.id}
                  x={heart.x}
                  y={heart.y}
                  onComplete={() => {
                    setFloatingHearts((prev) => prev.filter((h) => h.id !== heart.id));
                  }}
                />
              ))}
            </Pressable>
          </GestureDetector>
        </View>

        {/* Right view (Duet react camera mock view) */}
        {isDuetActive && (
          <View style={{ width: width / 2 }} className="bg-zinc-900 border-l border-zinc-850 items-center justify-center relative">
            {/* Duet React overlay */}
            <View className="absolute top-14 left-3 bg-[#ff0050] px-2 py-0.5 rounded">
              <Text className="text-white text-[8px] font-extrabold uppercase tracking-widest">React Live</Text>
            </View>

            {/* Drifting reaction wavelengths */}
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

      {/* Downloading indicator overlay */}
      {isDownloading && (
        <View className="absolute inset-0 bg-black/60 z-40 items-center justify-center">
          <View className="bg-zinc-900/90 border border-zinc-800 p-6 rounded-2xl items-center">
            <ActivityIndicator size="large" color="#ff0050" />
            <Text className="text-white text-sm font-bold mt-4">Downloading Video...</Text>
          </View>
        </View>
      )}

      {/* Dark Gradient Overlay */}
      <View className="absolute bottom-0 left-0 right-0 h-80 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />

      {/* Caption & User Info (Bottom Left) */}
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
            <Text className="text-white text-[10px] font-bold">
              {video.isFollowing ? 'Following' : 'Follow'}
            </Text>
          </TouchableOpacity>
        </View>

        <Text className="text-gray-100 text-sm mb-3" numberOfLines={3}>
          {video.description}
        </Text>

        <TouchableOpacity onPress={() => setIsSoundVisible(true)} className="flex-row items-center">
          <Music size={14} color="#ffffff" className="mr-2" />
          <Text className="text-white text-xs font-medium mr-1 underline" numberOfLines={1}>
            {video.music}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Action Buttons (Right Panel) */}
      <View className="absolute bottom-12 right-3 items-center z-10 gap-y-5">
        {/* Profile Avatar */}
        <View className="relative mb-2">
          <TouchableOpacity onPress={() => setIsProfileVisible(true)}>
            <Image
              source={{ uri: video.userAvatar }}
              className="w-12 h-12 rounded-full border border-white"
            />
          </TouchableOpacity>
          {!video.isFollowing && (
            <TouchableOpacity 
              className="absolute -bottom-2 bg-[#ff0050] rounded-full p-0.5 border border-white"
              onPress={() => {
                if (!isLoggedIn) setShowAuthModal(true);
                else toggleFollow(video.id);
              }}
            >
              <Plus size={10} color="#ffffff" strokeWidth={3} />
            </TouchableOpacity>
          )}
        </View>

        {/* Like Button */}
        <TouchableOpacity 
          className="items-center" 
          onPress={() => {
            if (!isLoggedIn) setShowAuthModal(true);
            else {
              toggleLike(video.id);
              if (!video.isLiked) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }
            }
          }}
        >
          <View className="bg-black/40 p-2.5 rounded-full backdrop-blur-sm">
            <Heart
              size={26}
              color={video.isLiked ? '#ff0050' : '#ffffff'}
              fill={video.isLiked ? '#ff0050' : 'transparent'}
            />
          </View>
          <Text className="text-white text-xs font-semibold mt-1">
            {video.likes.toLocaleString()}
          </Text>
        </TouchableOpacity>

        {/* Comments Button */}
        <TouchableOpacity onPress={() => setShowComments(true)} className="items-center">
          <View className="bg-black/40 p-2.5 rounded-full backdrop-blur-sm">
            <MessageCircle size={26} color="#ffffff" fill="transparent" />
          </View>
          <Text className="text-white text-xs font-semibold mt-1">
            {video.commentsCount.toLocaleString()}
          </Text>
        </TouchableOpacity>

        {/* Share Button */}
        <TouchableOpacity onPress={() => setShowOptions(true)} className="items-center">
          <View className="bg-black/40 p-2.5 rounded-full backdrop-blur-sm">
            <Share2 size={26} color="#ffffff" fill="transparent" />
          </View>
          <Text className="text-white text-xs font-semibold mt-1">
            {video.shares.toLocaleString()}
          </Text>
        </TouchableOpacity>

        {/* Rotating Music Disk */}
        <Animated.View style={[animatedDiskStyle, { marginTop: 8 }]}>
          <TouchableOpacity onPress={() => setIsSoundVisible(true)}>
            <View className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-700 items-center justify-center">
              <Image
                source={{ uri: video.userAvatar }}
                className="w-6 h-6 rounded-full"
              />
            </View>
          </TouchableOpacity>
        </Animated.View>
      </View>

      {/* Draggable Progress / Timeline Scrubber Bar */}
      <View className="absolute bottom-2 left-0 right-0 px-4 z-20 flex-row items-center justify-between">
        <Pressable
          onPress={handleScrub}
          className="flex-1 h-3 justify-center mr-3"
        >
          <View className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
            <View
              className="h-full bg-zinc-200"
              style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
            />
          </View>
        </Pressable>
        <Text className="text-zinc-400 text-[9px] font-bold">
          {formatTime(currentTime)} / {formatTime(duration)}
        </Text>
      </View>

      {/* Swipe Profile Overlay */}
      <CreatorProfileOverlay
        isVisible={isProfileVisible}
        onClose={() => setIsProfileVisible(false)}
        username={video.username}
        avatar={video.userAvatar}
        isFollowing={video.isFollowing}
        onToggleFollow={() => toggleFollow(video.id)}
      />

      {/* Sound Details Overlay */}
      <SoundDetailOverlay
        isVisible={isSoundVisible}
        onClose={() => setIsSoundVisible(false)}
        musicTitle={video.music}
      />

      {/* Long Press Video Options Modal */}
      <Modal visible={showOptions} animationType="slide" transparent>
        <View className="flex-1 bg-black/60 justify-end">
          <Pressable className="flex-1" onPress={() => setShowOptions(false)} />
          <View className="bg-zinc-900 rounded-t-3xl border-t border-zinc-800 p-6 pb-10">
            <View className="items-center mb-5">
              <View className="w-10 h-1 bg-zinc-700 rounded-full mb-3" />
              <Text className="text-zinc-400 text-xs font-bold uppercase tracking-wider">Video Options</Text>
            </View>

            <View className="gap-y-4">
              <TouchableOpacity
                onPress={handleSaveVideo}
                className="bg-zinc-800 p-4 rounded-2xl flex-row items-center"
              >
                <Download size={20} color="#ffffff" className="mr-4" />
                <Text className="text-white text-sm font-bold">Save Video</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleFavoriteToggle}
                className="bg-zinc-800 p-4 rounded-2xl flex-row items-center"
              >
                <Bookmark size={20} color={isFavorited ? '#eab308' : '#ffffff'} fill={isFavorited ? '#eab308' : 'transparent'} className="mr-4" />
                <Text className="text-white text-sm font-bold">
                  {isFavorited ? 'Remove from Favorites' : 'Add to Favorites'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleDuetToggle}
                className="bg-zinc-800 p-4 rounded-2xl flex-row items-center"
              >
                <Columns size={20} color={isDuetActive ? '#ff0050' : '#ffffff'} className="mr-4" />
                <Text className="text-white text-sm font-bold">
                  {isDuetActive ? 'Close Duet split' : 'Duet split screen'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleNotInterested}
                className="bg-zinc-800 p-4 rounded-2xl flex-row items-center"
              >
                <EyeOff size={20} color="#f87171" className="mr-4" />
                <Text className="text-red-400 text-sm font-bold">Not Interested</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setShowOptions(false);
                  Alert.alert('Reported', 'Thank you. We will review this video shortly.');
                }}
                className="bg-zinc-800 p-4 rounded-2xl flex-row items-center"
              >
                <AlertTriangle size={20} color="#eab308" className="mr-4" />
                <Text className="text-yellow-400 text-sm font-bold">Report Content</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={() => setShowOptions(false)}
              className="mt-6 py-4 rounded-2xl border border-zinc-800 bg-zinc-950 items-center"
            >
              <Text className="text-white font-extrabold text-sm">Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Bottom Sheet Comments Drawer */}
      <Modal visible={showComments} animationType="slide" transparent>
        <View className="flex-1 bg-black/60 justify-end">
          <Pressable className="flex-1" onPress={() => setShowComments(false)} />
          
          <View className="bg-zinc-900 rounded-t-3xl h-[65%] border-t border-zinc-800">
            <View className="flex-row items-center justify-between px-4 py-3.5 border-b border-zinc-800">
              <Text className="font-bold text-white text-base">
                Comments ({video.comments.length})
              </Text>
              <TouchableOpacity onPress={() => setShowComments(false)}>
                <X size={22} color="#888888" />
              </TouchableOpacity>
            </View>

            <ScrollView className="flex-1 p-4">
              {video.comments.length === 0 ? (
                <View className="py-20 items-center justify-center">
                  <MessageCircle size={48} color="#555555" />
                  <Text className="text-gray-500 text-sm mt-3">No comments yet. Start the conversation!</Text>
                </View>
              ) : (
                video.comments.map((comment) => (
                  <View key={comment.id} className="flex-row mb-5">
                    <Image
                      source={{ uri: comment.avatar }}
                      className="w-8 h-8 rounded-full mr-3 border border-zinc-700"
                    />
                    <View className="flex-1 border-b border-zinc-800/50 pb-3">
                      <View className="flex-row items-center justify-between">
                        <Text className="text-zinc-400 text-xs font-bold">{comment.username}</Text>
                        <View className="flex-row items-center">
                          <Text className="text-zinc-500 text-[10px] mr-2">{comment.timestamp}</Text>
                          <TouchableOpacity onPress={() => {
                            if (!isLoggedIn) setShowAuthModal(true);
                            else toggleCommentLike(video.id, comment.id);
                          }}>
                            <Heart size={14} color={comment.isLiked ? '#ff0050' : '#888888'} fill={comment.isLiked ? '#ff0050' : 'transparent'} />
                          </TouchableOpacity>
                        </View>
                      </View>
                      <Text className="text-white text-sm mt-1">{comment.text}</Text>
                      <TouchableOpacity className="mt-1" onPress={() => setReplyingTo(comment.id)}>
                        <Text className="text-zinc-500 text-xs font-bold">Reply</Text>
                      </TouchableOpacity>

                      {/* Nested Replies */}
                      {comment.replies && comment.replies.map(reply => (
                        <View key={reply.id} className="flex-row mt-3">
                          <Image source={{ uri: reply.avatar }} className="w-6 h-6 rounded-full mr-2" />
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
              {/* Emoji quick reactions */}
              <View className="flex-row items-center justify-between px-2 mb-3">
                {['😂', '🥰', '🥺', '🔥', '👏', '✨', '💀', '💯'].map(emoji => (
                  <TouchableOpacity key={emoji} onPress={() => setCommentInput(prev => prev + emoji)}>
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
                    placeholder={replyingTo ? "Add a reply..." : "Add a comment..."}
                    placeholderTextColor="#888888"
                    value={commentInput}
                    onChangeText={setCommentInput}
                    onSubmitEditing={submitComment}
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
