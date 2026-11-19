import '../global.css';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Platform } from 'react-native';
import AuthModal from '../components/AuthModal';
import { useEffect } from 'react';
import { useVideoStore } from '../store/useVideoStore';

export default function RootLayout() {
  const hydrateSession = useVideoStore((state) => state.hydrateSession);

  useEffect(() => {
    void hydrateSession();
  }, [hydrateSession]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    if (['1', 'yes'].includes(window.navigator.doNotTrack?.toLowerCase() || '')) return;

    const sessionKey = 'platform-visit-recorded';
    try {
      if (window.sessionStorage.getItem(sessionKey)) return;
      window.sessionStorage.setItem(sessionKey, '1');
    } catch {
      // Avoid counting repeatedly when session storage is unavailable.
      return;
    }

    void fetch('/.netlify/functions/track-visit', { method: 'POST', keepalive: true }).then((response) => {
      if (!response.ok) {
        try { window.sessionStorage.removeItem(sessionKey); } catch { /* storage unavailable */ }
      }
    }).catch(() => {
      try { window.sessionStorage.removeItem(sessionKey); } catch { /* storage unavailable */ }
    });
  }, []);

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
