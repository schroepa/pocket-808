/*
 * iOS vor 17 kennt audioSession nicht: Web Audio folgt dort dem Stumm-Schalter. Ein lautloses,
 * endlos laufendes Audio-Element schaltet die Sitzung auf Medienwiedergabe (Legacy unlockIOS).
 */

/** 8-kHz-8-Bit-Mono-WAV mit 800 Samples Stille */
export function silentWav(): Uint8Array<ArrayBuffer> {
  const n = 800;
  const b = new Uint8Array(44 + n);
  const v = new DataView(b.buffer);
  const w = (o: number, t: string): void => {
    for (let i = 0; i < t.length; i++) b[o + i] = t.charCodeAt(i);
  };
  w(0, 'RIFF');
  v.setUint32(4, 36 + n, true);
  w(8, 'WAVEfmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, 8000, true);
  v.setUint32(28, 8000, true);
  v.setUint16(32, 1, true);
  v.setUint16(34, 8, true);
  w(36, 'data');
  v.setUint32(40, n, true);
  b.fill(128, 44);
  return b;
}

export interface IosEnv {
  navigator: {
    userAgent: string;
    platform: string;
    maxTouchPoints: number;
    audioSession?: { type: string };
  };
  createAudio(src: string): { loop: boolean; volume: number; play(): Promise<void> };
  createObjectURL(blob: Blob): string;
}

/** Liefert die Entsperr-Funktion für jede Bedien-Geste (engine onGesture). */
export function createIosUnlock(env: IosEnv): () => void {
  let el: ReturnType<IosEnv['createAudio']> | null = null;
  return () => {
    const nav = env.navigator;
    try {
      if (nav.audioSession) nav.audioSession.type = 'playback';
    } catch {
      /* ältere Safari-Versionen */
    }
    if (el || nav.audioSession) return;
    const ios =
      /iP(hone|ad|od)/.test(nav.userAgent) ||
      (nav.platform.includes('Mac') && nav.maxTouchPoints > 1);
    if (!ios) return;
    try {
      const audio = env.createAudio(
        env.createObjectURL(new Blob([silentWav()], { type: 'audio/wav' })),
      );
      audio.loop = true;
      audio.volume = 0.01;
      el = audio;
      audio.play().catch(() => {
        el = null;
      });
    } catch {
      el = null;
    }
  };
}
