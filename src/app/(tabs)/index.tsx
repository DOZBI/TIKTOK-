import React, { useState, useRef } from 'react';
import { FlatList, View, Text, StatusBar, TouchableOpacity, Dimensions } from 'react-native';
import { useVideoStore } from '../../store/useVideoStore';
import VideoPost from '../../components/VideoPost';
import LiveStreamModal from '../../components/LiveStreamModal';
import { Users, Sparkles, Tv } from 'lucide-react-native';

export default function HomeFeed() {
  const { videos, hiddenVideoIds } = useVideoStore();
  const [feedType, setFeedType] = useState<'following' | 'foryou'>('foryou');
  const [activeId, setActiveId] = useState<string>('');
  const [showLive, setShowLive] = useState<boolean>(false);

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 60,
  }).current;

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setActiveId(viewableItems[0].item.id);
    }
  }).current;

  // Filter videos: exclude hidden videos, and optionally filter by follow state
  const visibleVideos = videos.filter((vid) => !hiddenVideoIds.includes(vid.id));
  
  const filteredVideos = visibleVideos.filter((vid) => {
    if (feedType === 'following') {
      return vid.isFollowing;
    }
    return true;
  });

  // Automatically select the first video if the active ID is not in the list
  React.useEffect(() => {
    if (filteredVideos.length > 0) {
      const ids = filteredVideos.map(v => v.id);
      if (!ids.includes(activeId)) {
        setActiveId(filteredVideos[0].id);
      }
    } else {
      setActiveId('');
    }
  }, [feedType, videos, hiddenVideoIds]);

  return (
    <View className="flex-1 bg-black">
      <StatusBar barStyle="light-content" translucent />

      {/* Flashing Live broadcast badge (Top Left) */}
      <TouchableOpacity
        onPress={() => setShowLive(true)}
        className="absolute top-12 left-4 z-20 bg-red-600 border border-red-500 px-2.5 py-1 rounded-full flex-row items-center"
      >
        <Tv size={12} color="#ffffff" className="mr-1" />
        <Text className="text-white text-[9px] font-extrabold tracking-widest uppercase">LIVE</Text>
      </TouchableOpacity>
      
      {/* Top Header Selector */}
      <View className="absolute top-12 left-0 right-0 z-20 flex-row justify-center items-center gap-x-6">
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

      {filteredVideos.length === 0 ? (
        <View className="flex-1 justify-center items-center bg-black px-8">
          {feedType === 'following' ? (
            <View className="items-center">
              <View className="bg-zinc-900 p-5 rounded-full mb-4 border border-zinc-850">
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
                className="bg-[#ff0050] px-6 py-3 rounded-full"
              >
                <Text className="text-white font-extrabold text-sm">Explore For You</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View className="items-center">
              <View className="bg-zinc-900 p-5 rounded-full mb-4 border border-zinc-850">
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
        <FlatList
          data={filteredVideos}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <VideoPost video={item} isActive={item.id === activeId} />
          )}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          initialNumToRender={1}
          maxToRenderPerBatch={2}
          windowSize={3}
          decelerationRate="fast"
          snapToInterval={Dimensions.get('window').height - 60}
          snapToAlignment="start"
        />
      )}

      {/* Simulated LIVE Broadcast modal */}
      <LiveStreamModal isVisible={showLive} onClose={() => setShowLive(false)} />
    </View>
  );
}
