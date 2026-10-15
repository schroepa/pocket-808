import type { Rng } from '../core/random.ts';
import type { DrumSample } from '../core/samples.ts';
import type { State, VoiceId } from '../core/types.ts';
import { createStore } from '../store/store.ts';
import { createEngine, type ScheduledStep } from './engine.ts';
import type { EngineTimer } from './timer.ts';
import type { OfflineFactory } from './voices.ts';

/*
 * WAV-Export: eine eigene Engine-Instanz rendert offline (Verfahren der Referenztests). Der Scheduler
 * läuft mit manueller Uhr in 25-ms-Schritten bis playFor; die laufende Wiedergabe bleibt unberührt.
 */

export interface RenderOptions {
  /** Zustand des Exports; der Modus (Pattern/Song) ist schon gesetzt */
  state: State;
  pads: readonly (Float32Array | null)[];
  drums: Partial<Record<VoiceId, DrumSample>>;
  /** bis hierhin werden Steps geplant (Sekunden) */
  playFor: number;
  /** Länge der Aufnahme inklusive Ausklang (Sekunden) */
  seconds: number;
  sampleRate?: number;
  createContext: (channels: number, length: number, sampleRate: number) => OfflineAudioContext;
  createOffline?: OfflineFactory;
  random?: (tag: string) => Rng;
  onProgress?: (fraction: number) => void;
  onScheduled?: (s: ScheduledStep) => void;
  signal?: AbortSignal;
  /** nach so vielen Scheduler-Takten der Oberfläche Zeit geben (Standard 40 = 1 s Musik) */
  yieldEvery?: number;
  pause?: () => Promise<void>;
}

const TICK = 0.025;
/** Vorlauf des Schedulers (engine.ts HORIZON_S) */
const HORIZON = 0.2;

const nextTask = (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

/** Rendert den Export; null, wenn abgebrochen. */
export async function renderOffline(o: RenderOptions): Promise<AudioBuffer | null> {
  if (o.signal?.aborted) return null;
  const sr = o.sampleRate ?? 44100;
  const ctx = o.createContext(2, Math.ceil(o.seconds * sr), sr);
  let now = 0;
  let pump: (() => void) | null = null;
  const timer: EngineTimer = {
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (h) => {
      clearTimeout(h as ReturnType<typeof setTimeout>);
    },
    setInterval: (fn) => {
      pump = fn;
      return 1;
    },
    clearInterval: () => {
      pump = null;
    },
  };
  const engine = createEngine({
    store: createStore(o.state, { freeze: false }),
    createContext: () => ctx,
    timer,
    clock: () => now,
    prerender: false,
    pads: o.pads,
    drums: o.drums,
    ...(o.createOffline ? { createOffline: o.createOffline } : {}),
    ...(o.random ? { random: o.random } : {}),
    ...(o.onScheduled ? { onScheduled: o.onScheduled } : {}),
  });
  const pause = o.pause ?? nextTask;
  const every = o.yieldEvery ?? 40;
  const tick = (): void => {
    pump?.();
  };
  try {
    engine.prepare();
    await engine.prerenderAll();
    engine.start();
    // Alle Steps vor playFor planen, keinen danach: zuletzt genau bis kurz vor playFor
    const last = o.playFor - HORIZON - 1e-6;
    let n = 0;
    for (now = 0; now < last; now += TICK) {
      tick();
      if (++n % every === 0) {
        o.onProgress?.(Math.min(1, now / o.playFor));
        await pause();
        if (o.signal?.aborted) return null;
      }
    }
    now = Math.max(0, last);
    tick();
    o.onProgress?.(1);
    const buf = await ctx.startRendering();
    return o.signal?.aborted ? null : buf;
  } finally {
    engine.dispose();
  }
}
