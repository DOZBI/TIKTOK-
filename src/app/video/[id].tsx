import React, { useState, useRef, useEffect } from 'react';
import { FlatList, View, TouchableOpacity, Dimensions, StatusBar, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useVideoStore } from '../../store/useVideoStore';
import VideoPost from '../../components/VideoPost';

const { height } = Dimensions.get('window');

export default function VideoDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { videos, incrementView } = useVideoStore();
  const [activeId, setActiveId] = useState<string>(id || '');

  useEffect(() => {
    if (id) void incrementView(id);
  }, [id, incrementView]);

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;
  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) setActiveId(viewableItems[0].item.id);
  }).current;

  // Ensure the clicked video is first in the list so we don't need getItemLayout / initialScrollIndex
  const [feedVideos, setFeedVideos] = useState([...videos]);
  
  useEffect(() => {
    if (id) {
      const targetIndex = videos.findIndex(v => v.id === id);
      if (targetIndex > -1) {
        // Reorder the array so the clicked video is first, followed by the rest
        const reordered = [
          ...videos.slice(targetIndex),
          ...videos.slice(0, targetIndex)
        ];
        setFeedVideos(reordered);
        setActiveId(id);
      }
    } else {
      setFeedVideos(videos);
    }
  }, [id, videos]);

  return (
    <View className="flex-1 bg-black">
      <StatusBar barStyle="light-content" translucent />
      
      {/* Back Button */}
      <TouchableOpacity 
        onPress={() => router.back()} 
        className="absolute top-14 left-4 z-50 bg-black/50 p-2.5 rounded-full"
      >
        <ChevronLeft size={24} color="#ffffff" />
      </TouchableOpacity>

      <FlatList
        data={feedVideos}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <VideoPost video={item} height={height} isActive={item.id === activeId} />
        )}
        pagingEnabled
        initialNumToRender={2}
        maxToRenderPerBatch={2}
        windowSize={3}
        removeClippedSubviews={false}
        showsVerticalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        initialNumToRender={1}
        maxToRenderPerBatch={2}
        windowSize={3}
        decelerationRate="fast"
        snapToInterval={height - 60}
        snapToAlignment="start"
      />
    </View>
  );
}
