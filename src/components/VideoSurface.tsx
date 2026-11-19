import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { claimPlayback, releasePlayback } from '../lib/playbackManager';

type VideoSurfaceProps = {
  source: any;
  shouldPlay: boolean;
  isActive: boolean;
  onReady: (player: any | null) => void;
};

export default function VideoSurface({ source, shouldPlay, isActive, onReady }: VideoSurfaceProps) {
  const [hasFrame, setHasFrame] = useState(false);
  const [buffering, setBuffering] = useState(true);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  const player = useVideoPlayer(source, (videoPlayer) => {
    videoPlayer.loop = true;
    videoPlayer.muted = false;
    try {
      videoPlayer.bufferOptions = {
        preferredForwardBufferDuration: 6,
        waitsToMinimizeStalling: false,
        minBufferForPlayback: 0.5,
      };
    } catch {
      // Buffer options are not supported on every platform.
    }
  });

  useEffect(() => () => {
    try {
      player.pause();
    } catch {
      // The player may already have been released.
    }
    releasePlayback(player);
  }, [player]);

  useEffect(() => {
    if (!isActive) return;
    onReadyRef.current(player);
    return () => onReadyRef.current(null);
  }, [isActive, player]);

  useEffect(() => {
    const subscription = player.addListener('statusChange', ({ status }: any) => {
      setBuffering(status === 'loading');
    });
    return () => subscription.remove();
  }, [player]);

  useEffect(() => {
    if (shouldPlay) {
      claimPlayback(player);
      player.play();
    } else {
      player.pause();
    }
  }, [player, shouldPlay]);

  return (
    <>
      <VideoView
        player={player}
        style={{ width: '100%', height: '100%', opacity: hasFrame ? 1 : 0 }}
        contentFit="cover"
        surfaceType="textureView"
        nativeControls={false}
        onFirstFrameRender={() => setHasFrame(true)}
      />
      {isActive && buffering && (
        <View style={styles.centerLoader} pointerEvents="none">
          <ActivityIndicator color="#ffffff" />
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  centerLoader: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
