import '../global.css';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AuthModal from '../components/AuthModal';
import { useEffect } from 'react';
import { useVideoStore } from '../store/useVideoStore';

export default function RootLayout() {
  const hydrateSession = useVideoStore((state) => state.hydrateSession);

  useEffect(() => {
    void hydrateSession();
  }, [hydrateSession]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="camera" options={{ presentation: 'modal' }} />
      </Stack>
      <AuthModal />
    </GestureHandlerRootView>
  );
}
