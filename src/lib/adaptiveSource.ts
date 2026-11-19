// lib/adaptiveSource.ts
// Choisit le bon format vidéo selon la qualité de la connexion.
//
// - Connexion correcte/bonne : on donne le master.m3u8, le lecteur natif
//   (AVPlayer sur iPhone, ExoPlayer sur Android) bascule automatiquement
//   entre low / medium / high selon le débit mesuré.
// - Connexion mauvaise (2G/3G, hors ligne, "internet non joignable") : on
//   force directement la variante "low" pour démarrer vite sans saccades.
//
// Dépendance : npx expo install @react-native-community/netinfo

import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { useSyncExternalStore } from 'react';

export type NetworkQuality = 'poor' | 'normal';

function evaluate(state: NetInfoState): NetworkQuality {
  if (state.isConnected === false || state.isInternetReachable === false) return 'poor';
  if (state.type === 'cellular') {
    const generation = (state.details as any)?.cellularGeneration;
    if (generation === '2g' || generation === '3g') return 'poor';
  }
  if (state.type === 'none' || state.type === 'unknown') return 'normal';
  return 'normal';
}

let quality: NetworkQuality = 'normal';
const listeners = new Set<() => void>();
let started = false;

function start() {
  if (started) return;
  started = true;
  NetInfo.addEventListener((state) => {
    const next = evaluate(state);
    if (next !== quality) {
      quality = next;
      listeners.forEach((l) => l());
    }
  });
  NetInfo.fetch().then((state) => {
    quality = evaluate(state);
    listeners.forEach((l) => l());
  });
}

export function getNetworkQuality(): NetworkQuality {
  start();
  return quality;
}

export function useNetworkQuality(): NetworkQuality {
  start();
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => quality,
    () => quality
  );
}

/**
 * Transforme l'URL stockée en base (hls_url ou video_url) en source jouable.
 * Pour une URL HLS master + mauvaise connexion => variante low directement.
 */
export function resolveVideoSource(url: any, networkQuality: NetworkQuality): any {
  if (typeof url !== 'string') return url; // require('...') local
  if (networkQuality === 'poor' && /master\.m3u8(\?.*)?$/i.test(url)) {
    return url.replace(/master\.m3u8/i, 'low/index.m3u8');
  }
  return url;
}