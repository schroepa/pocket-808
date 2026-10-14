import { factorySamples } from './audio/dsp.ts';
import { createEngine } from './audio/engine.ts';
import { bootState } from './core/boot.ts';
import { SAMPLE_STORAGE_KEY, STORAGE_KEY, VOICE_IDS } from './core/constants.ts';
import { serialize } from './core/persist.ts';
import type { DrumSample } from './core/samples.ts';
import type { VoiceId } from './core/types.ts';
import { must } from './core/util.ts';
import { pickAudioFile } from './platform/files.ts';
import { connectHost, hostState, type HostHot } from './platform/host.ts';
import { createIosUnlock } from './platform/ios.ts';
import { watchLifecycle } from './platform/lifecycle.ts';
import { createWakeLock } from './platform/wake.ts';
import { browserTimer, persistState, type StorageLike } from './store/persist.ts';
import { createSampleBank } from './store/samples.ts';
import { effect } from './store/signals.ts';
import { createStore, type Store } from './store/store.ts';
import type { UiAudio } from './ui/context.ts';
import { mountShell } from './ui/shell.ts';

/*
 * Verdrahtung: Host-Daten bzw. localStorage → Store → Engine (Kontext schlafend, Drums im Hintergrund
 * vorgerendert) → Oberfläche → Plattform (iOS, Wake Lock, Lebenszyklus). Nur diese Datei kennt alle Schichten.
 */

/** localStorage, falls erreichbar; sonst (privates Fenster, gesperrte Daten) ein flüchtiger Ersatz */
function openStorage(): StorageLike {
  try {
    const s = window.localStorage;
    s.getItem(STORAGE_KEY);
    return s;
  } catch {
    const m = new Map<string, string>();
    return {
      getItem: (k) => m.get(k) ?? null,
      setItem: (k, v) => {
        m.set(k, v);
      },
    };
  }
}

function boot(hostData: unknown): Store {
  const storage = openStorage();
  const read = (k: string): string | null => {
    try {
      return storage.getItem(k);
    } catch {
      return null;
    }
  };
  const booted = bootState(
    read(STORAGE_KEY),
    read(SAMPLE_STORAGE_KEY),
    factorySamples(Math.random),
    hostState(hostData),
  );
  const store = createStore(booted.state);
  persistState(store.state, storage);
  const samples = createSampleBank(storage, booted.drums);

  const unlock = createIosUnlock({
    navigator: navigator,
    createAudio: (src) => new Audio(src),
    createObjectURL: (b) => URL.createObjectURL(b),
  });
  const engine = createEngine({
    store,
    createContext: () => new AudioContext({ latencyHint: 'balanced' }),
    pads: booted.pads,
    drums: booted.drums,
    onGesture: unlock,
  });
  const available = engine.prepare();

  // Eigene Drum-Samples an die Engine geben, nur geänderte Stimmen
  let prev = new Map<VoiceId, DrumSample>(samples.drums.peek());
  effect(() => {
    const next = samples.drums.value;
    for (const id of VOICE_IDS) {
      if (next.get(id) !== prev.get(id)) engine.setDrumSample(id, next.get(id) ?? null);
    }
    prev = new Map(next);
  });

  const audio: UiAudio = {
    available,
    playing: engine.playing,
    playhead: engine.playhead,
    start: () => {
      engine.start();
    },
    stop: () => {
      engine.stop();
    },
    tick: () => {
      engine.tick();
    },
    audition: (v) => {
      engine.audition(v);
    },
    decode: (d) => engine.decode(d),
  };
  mountShell(must(document.getElementById('app') ?? undefined, '#app'), {
    store,
    samples,
    audio,
    files: { pickAudio: () => pickAudioFile(document) },
    timer: browserTimer,
    win: window,
  });

  const wake = createWakeLock({
    navigator: navigator,
    document,
  });
  effect(() => {
    if (engine.playing.value) wake.hold();
    else wake.release();
  });
  watchLifecycle(document, {
    hidden: () => {
      engine.stop();
    },
    pointer: () => {
      engine.resume();
    },
  });
  return store;
}

let app: Store | null = null;
connectHost(
  window as unknown as { claude?: { hot?: HostHot } },
  () => (app ? { state: serialize(app.state.peek()) } : {}),
  (data) => {
    app = boot(data);
  },
);
