// lib/playbackManager.ts
// Garantit qu'une seule vidéo joue à la fois dans toute l'application.

type Pausable = { pause: () => void };

let current: Pausable | null = null;

/** À appeler juste avant player.play() : met en pause le lecteur précédent. */
export function claimPlayback(player: Pausable) {
  if (current && current !== player) {
    try {
      current.pause();
    } catch {
      // le lecteur précédent a peut-être déjà été libéré
    }
  }
  current = player;
}

/** À appeler quand un lecteur est détruit ou mis en pause volontairement. */
export function releasePlayback(player: Pausable) {
  if (current === player) current = null;
}

/** Met tout en pause (ex. app en arrière-plan, écran quitté). */
export function pauseAll() {
  try {
    current?.pause();
  } catch {
    // ignore
  }
}