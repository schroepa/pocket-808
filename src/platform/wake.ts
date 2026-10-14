export interface WakeEnv {
  navigator: { wakeLock?: { request(type: 'screen'): Promise<{ release(): Promise<void> }> } };
  document: Pick<Document, 'visibilityState' | 'addEventListener' | 'removeEventListener'>;
}

/** Bildschirm wach halten, solange gespielt wird; nach Rückkehr in den Vordergrund neu anfordern. */
export function createWakeLock(env: WakeEnv): { hold(): void; release(): void; dispose(): void } {
  let wanted = false;
  let sentinel: { release(): Promise<void> } | null = null;
  const request = async (): Promise<void> => {
    const api = env.navigator.wakeLock;
    if (!api) return;
    try {
      const s = await api.request('screen');
      // nur eine Sperre halten: überzählige (Wettlauf halten/freigeben/halten) gleich zurückgeben
      if (wanted && !sentinel) sentinel = s;
      else await s.release();
    } catch {
      /* verweigert (z. B. Energiesparmodus) */
    }
  };
  const onVisible = (): void => {
    if (!wanted || env.document.visibilityState !== 'visible') return;
    // im Hintergrund gibt der Browser die Sperre selbst frei: neu anfordern
    sentinel = null;
    void request();
  };
  env.document.addEventListener('visibilitychange', onVisible);
  return {
    hold() {
      wanted = true;
      void request();
    },
    release() {
      wanted = false;
      sentinel?.release().catch(() => undefined);
      sentinel = null;
    },
    dispose() {
      env.document.removeEventListener('visibilitychange', onVisible);
    },
  };
}
