import React, { useState } from 'react';
import { View, Text, TextInput, ScrollView, Image, TouchableOpacity, Dimensions, FlatList } from 'react-native';
import Animated from 'react-native-reanimated';
import { Search, Flame, Play } from 'lucide-react-native';
import { useVideoStore } from '../../store/useVideoStore';
import { useRouter } from 'expo-router';

const { width } = Dimensions.get('window');
const GRID_ITEM_WIDTH = (width - 36) / 3; // 3 columns grid with margins

export default function DiscoverScreen() {
  const { videos, loadFeed } = useVideoStore();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'Top' | 'Users' | 'Videos'>('Top');

  React.useEffect(() => { void loadFeed(); }, [loadFeed]);
  const trendingHashtags = React.useMemo(() => {
    const tags = new Map<string, number>();
    videos.forEach((video) => {
      (video.description.match(/#[\p{L}\d_]+/gu) ?? []).forEach((tag) => {
        const key = tag.slice(1).toLowerCase();
        tags.set(key, (tags.get(key) ?? 0) + video.views);
      });
    });
    return [...tags.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([tag, views], index) => ({ id: `${tag}-${index}`, tag, count: `${views.toLocaleString()} vues` }));
  }, [videos]);

  const filteredVideos = videos.filter((video) =>
    video.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    video.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <View className="flex-1 bg-zinc-950 px-4 pt-14">
      {/* Search Input */}
      <View className="flex-row items-center bg-zinc-800 rounded-full px-4 py-2 mb-6">
        <Search size={18} color="#888888" className="mr-2.5" />
        <TextInput
          className="flex-1 text-white text-sm"
          placeholder="Search creators, hashtags, or sounds"
          placeholderTextColor="#888888"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Tabs */}
      {searchQuery.length > 0 && (
        <View className="flex-row border-b border-zinc-900 mb-4 pb-2 gap-x-6">
          {['Top', 'Users', 'Videos'].map((tab) => (
            <TouchableOpacity key={tab} onPress={() => setActiveTab(tab as any)}>
              <Text className={`font-bold text-sm ${activeTab === tab ? 'text-white' : 'text-zinc-500'}`}>
                {tab}
              </Text>
              {activeTab === tab && <View className="h-0.5 bg-white w-full absolute -bottom-2.5" />}
            </TouchableOpacity>
          ))}
        </View>
      )}

      <ScrollView showsVerticalScrollIndicator={false}>
        {searchQuery.length === 0 ? (
          /* Trending Section when not searching */
          <>
            <View className="mb-6">
              <View className="flex-row items-center mb-3">
                <Flame size={18} color="#ff0050" className="mr-1.5" />
                <Text className="text-white font-extrabold text-base">Hashtags tendance</Text>
              </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
            {trendingHashtags.map((item) => (
              <TouchableOpacity
                key={item.id}
                className="bg-zinc-850 border border-zinc-800 px-4 py-2.5 rounded-2xl mr-3"
              >
                <Text className="text-white font-bold text-sm">#{item.tag}</Text>
                <Text className="text-zinc-500 text-[10px] mt-0.5">{item.count}</Text>
              </TouchableOpacity>
            ))}
              </ScrollView>
            </View>

            {/* Popular Videos Grid */}
            <View className="mb-8">
              <Text className="text-white font-extrabold text-base mb-4">Popular Clips</Text>
              <View className="flex-row flex-wrap gap-2.5">
                {videos.map((video) => (
                  <TouchableOpacity
                    key={video.id}
                    onPress={() => router.push(`/video/${video.id}` as any)}
                    style={{ width: GRID_ITEM_WIDTH, height: GRID_ITEM_WIDTH * 1.4 }}
                    className="relative rounded-lg overflow-hidden bg-zinc-900"
                  >
                    <Image source={{ uri: video.thumbnailUrl || video.thumbnailUrlMedium || video.userAvatar || undefined }} className="w-full h-full object-cover" />
                    <View className="absolute bottom-1.5 left-1.5 right-1.5 flex-row items-center justify-between">
                      <View className="flex-row items-center">
                        <Play size={10} color="#ffffff" fill="#ffffff" className="mr-1" />
                        <Text className="text-white font-bold text-[9px] shadow-sm">
                          {video.views.toLocaleString()}
                        </Text>
                      </View>
                    </View>
                    <View className="absolute top-1.5 left-1.5 bg-black/40 px-1.5 py-0.5 rounded">
                      <Text className="text-white font-bold text-[8px]">@{video.username}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </>
        ) : (
          /* Search Results */
          <View className="mb-8">
            {activeTab === 'Users' && (
              <View className="gap-y-4">
                {filteredVideos.map((video) => (
                  <TouchableOpacity key={`user-${video.id}`} className="flex-row items-center bg-zinc-900/50 p-3 rounded-xl border border-zinc-900">
                    <Image source={{ uri: video.userAvatar }} className="w-12 h-12 rounded-full mr-4 border border-zinc-800" />
                    <View>
                      <Text className="text-white font-bold text-sm">{video.username}</Text>
                      <Text className="text-zinc-500 text-xs mt-0.5">{video.likes.toLocaleString()} Likes</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {(activeTab === 'Top' || activeTab === 'Videos') && (
              <View className="flex-row flex-wrap gap-2.5">
                {filteredVideos.length === 0 ? (
                  <Text className="text-zinc-500 text-sm mt-10 w-full text-center">No results found.</Text>
                ) : (
                  filteredVideos.map((video) => (
                    <TouchableOpacity
                      key={video.id}
                      onPress={() => router.push(`/video/${video.id}` as any)}
                      style={{ width: GRID_ITEM_WIDTH, height: GRID_ITEM_WIDTH * 1.4 }}
                      className="relative rounded-lg overflow-hidden bg-zinc-900"
                    >
                      <Animated.Image 
                        source={{ uri: video.thumbnailUrlMedium || video.thumbnailUrl || video.thumbnailUrlLow || video.userAvatar || undefined }}
                        className="w-full h-full object-cover" 
                        sharedTransitionTag={`thumbnail-${video.id}`}
                      />
                      <View className="absolute bottom-1.5 left-1.5 right-1.5 flex-row items-center justify-between">
                        <View className="flex-row items-center">
                          <Play size={10} color="#ffffff" fill="#ffffff" className="mr-1" />
                          <Text className="text-white font-bold text-[9px] shadow-sm">
                            {video.views.toLocaleString()}
                          </Text>
                        </View>
                      </View>
                      <View className="absolute top-1.5 left-1.5 bg-black/40 px-1.5 py-0.5 rounded">
                        <Text className="text-white font-bold text-[8px]">@{video.username}</Text>
                      </View>
                    </TouchableOpacity>
                  ))
                )}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
