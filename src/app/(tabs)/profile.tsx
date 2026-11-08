import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView, Dimensions, Modal, TextInput } from 'react-native';
import Animated from 'react-native-reanimated';
import { Grid, Lock, Heart, Edit2, Play, Check, User } from 'lucide-react-native';
import { useVideoStore } from '../../store/useVideoStore';
import { useRouter } from 'expo-router';

const { width } = Dimensions.get('window');
const GRID_ITEM_WIDTH = (width - 32) / 3;

export default function ProfileScreen() {
  const { videos, currentUser, updateProfile, isLoggedIn, setShowAuthModal } = useVideoStore();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'public' | 'private' | 'liked'>('public');
  const [showEditModal, setShowEditModal] = useState(false);
  
  // Local state for modal inputs
  const [bio, setBio] = useState(currentUser.bio);
  const [name, setName] = useState(currentUser.name);

  const userStats = {
    following: '184',
    followers: '25.6K',
    likes: '452.8K',
    avatar: currentUser.avatar,
  };

  // Group videos for tabs
  const publicVideos = videos; // For mockup, show all videos in public tab
  const privateVideos = videos.slice(2); // Show subset in private
  const likedVideos = videos.filter((vid) => vid.isLiked); // Filter by liked videos

  const getActiveTabVideos = () => {
    switch (activeTab) {
      case 'public': return publicVideos;
      case 'private': return privateVideos;
      case 'liked': return likedVideos;
    }
  };

  if (!isLoggedIn) {
    return (
      <View className="flex-1 bg-[#09090b] justify-center items-center px-8 pt-10">
        <User size={64} color="#333333" className="mb-6" />
        <Text className="text-white text-xl font-extrabold mb-2 text-center">Sign up for an account</Text>
        <Text className="text-zinc-400 text-sm text-center mb-8">
          Create a profile, follow other accounts, make your own videos, and more.
        </Text>
        <TouchableOpacity 
          onPress={() => setShowAuthModal(true)}
          className="bg-[#ff0050] w-full py-4 rounded-xl items-center"
        >
          <Text className="text-white font-bold text-[15px]">Sign up</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#09090b] pt-12">
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* User Info Header */}
        <View className="items-center px-4 mb-6">
          <Image
            source={{ uri: userStats.avatar }}
            className="w-24 h-24 rounded-full border-2 border-zinc-800 mb-3"
          />
          <Text className="text-white text-lg font-extrabold">{currentUser.name}</Text>
          <Text className="text-zinc-500 text-sm mt-0.5">@{currentUser.username}</Text>

          {/* Stats Bar */}
          <View className="flex-row justify-center items-center gap-x-8 mt-5">
            <View className="items-center">
              <Text className="text-white font-extrabold text-base">{userStats.following}</Text>
              <Text className="text-zinc-500 text-xs mt-0.5">Following</Text>
            </View>
            <View className="items-center">
              <Text className="text-white font-extrabold text-base">{userStats.followers}</Text>
              <Text className="text-zinc-500 text-xs mt-0.5">Followers</Text>
            </View>
            <View className="items-center">
              <Text className="text-white font-extrabold text-base">{userStats.likes}</Text>
              <Text className="text-zinc-500 text-xs mt-0.5">Likes</Text>
            </View>
          </View>

          {/* Action buttons */}
          <View className="flex-row gap-x-3 mt-6 w-full">
            <TouchableOpacity
              onPress={() => setShowEditModal(true)}
              className="flex-1 bg-zinc-900 border border-zinc-800 py-2.5 rounded-xl flex-row items-center justify-center gap-x-2"
            >
              <Edit2 size={14} color="#ffffff" />
              <Text className="text-white font-bold text-xs">Edit Profile</Text>
            </TouchableOpacity>
          </View>

          {/* Bio Description */}
          <Text className="text-zinc-350 text-xs mt-5 text-center leading-5 px-6">
            {currentUser.bio}
          </Text>
        </View>

        {/* Tab Grid Selector */}
        <View className="flex-row border-t border-b border-zinc-900 bg-zinc-950/80">
          <TouchableOpacity
            onPress={() => setActiveTab('public')}
            className="flex-1 items-center py-3 border-b-2"
            style={{ borderBottomColor: activeTab === 'public' ? '#ffffff' : 'transparent' }}
          >
            <Grid size={18} color={activeTab === 'public' ? '#ffffff' : '#555555'} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab('private')}
            className="flex-1 items-center py-3 border-b-2"
            style={{ borderBottomColor: activeTab === 'private' ? '#ffffff' : 'transparent' }}
          >
            <Lock size={18} color={activeTab === 'private' ? '#ffffff' : '#555555'} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab('liked')}
            className="flex-1 items-center py-3 border-b-2"
            style={{ borderBottomColor: activeTab === 'liked' ? '#ffffff' : 'transparent' }}
          >
            <Heart size={18} color={activeTab === 'liked' ? '#ffffff' : '#555555'} />
          </TouchableOpacity>
        </View>

        {/* Video Thumbnail Grid */}
        <View className="flex-row flex-wrap gap-[1px] p-2 bg-zinc-950">
          {getActiveTabVideos().length === 0 ? (
            <View className="w-full py-20 items-center justify-center">
              <Play size={36} color="#444444" />
              <Text className="text-zinc-500 text-xs mt-3">No videos found</Text>
            </View>
          ) : (
            getActiveTabVideos().map((video) => (
              <TouchableOpacity
                key={video.id}
                onPress={() => router.push(`/video/${video.id}` as any)}
                style={{ width: GRID_ITEM_WIDTH, height: GRID_ITEM_WIDTH * 1.4 }}
                className="relative bg-zinc-900"
              >
                <Animated.Image
                  source={{ uri: video.userAvatar }}
                  className="w-full h-full object-cover"
                  sharedTransitionTag={`thumbnail-${video.id}`}
                />
                <View className="absolute bottom-1.5 left-1.5 flex-row items-center">
                  <Play size={10} color="#ffffff" fill="#ffffff" className="mr-1" />
                  <Text className="text-white text-[9px] font-bold">{(video.likes / 10).toFixed(0)}</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal visible={showEditModal} animationType="slide" transparent>
        <View className="flex-1 bg-black/60 justify-end">
          <View className="bg-zinc-900 border-t border-zinc-800 rounded-t-3xl p-6 pb-10">
            <View className="flex-row items-center justify-between mb-6">
              <Text className="text-white font-extrabold text-base">Edit Profile</Text>
              <TouchableOpacity
                onPress={() => setShowEditModal(false)}
                className="bg-zinc-800 p-1.5 rounded-full"
              >
                <Check size={18} color="#ffffff" />
              </TouchableOpacity>
            </View>

            <View className="gap-y-4 mb-6">
              <View>
                <Text className="text-zinc-500 text-xs font-bold mb-2">DISPLAY NAME</Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  className="bg-zinc-800 text-white rounded-xl px-4 py-3 text-sm border border-zinc-750"
                  placeholder="Enter name"
                  placeholderTextColor="#666666"
                />
              </View>
              <View>
                <Text className="text-zinc-500 text-xs font-bold mb-2">BIO DESCRIPTION</Text>
                <TextInput
                  value={bio}
                  onChangeText={setBio}
                  multiline
                  numberOfLines={3}
                  className="bg-zinc-800 text-white rounded-xl px-4 py-3 text-sm border border-zinc-750 h-20"
                  placeholder="Enter bio"
                  placeholderTextColor="#666666"
                />
              </View>
            </View>
            <TouchableOpacity
              onPress={() => {
                updateProfile({ name, bio });
                setShowEditModal(false);
              }}
              className="bg-[#ff0050] py-3.5 rounded-xl items-center"
            >
              <Text className="text-white font-extrabold text-sm">Save Changes</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
