import { factorySamples } from './audio/dsp.ts';
import { createEngine } from './audio/engine.ts';
import { bootState } from './core/boot.ts';
import { SAMPLE_STORAGE_KEY, SMP_MAX, SMP_RATE, STORAGE_KEY, VOICE_IDS } from './core/constants.ts';
import { serialize } from './core/persist.ts';
import type { DrumSample } from './core/samples.ts';
import type { VoiceId } from './core/types.ts';
import { must } from './core/util.ts';
import { renderOffline } from './audio/export.ts';
import { encodeWav } from './core/wav.ts';
import { fadeOut, toPcm } from './core/samples.ts';
import { stepDuration } from './core/timing.ts';
import { pickAudioFile, pickTextFile } from './platform/files.ts';
import { saveFile, type ArtifactDownloads } from './platform/share.ts';
import { createRecorder, type RecorderEnv } from './platform/recorder.ts';
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

/** Im Claude-Artifact: Download-Freigabe (claude.use), kommt später an; sonst bleibt sie null */
let artifactDownloads: ArtifactDownloads | null = null;
const claude = (window as unknown as { claude?: { use?: (name: string) => Promise<unknown> } })
  .claude;
if (typeof claude?.use === 'function') {
  claude.use('downloads').then(
    (d) => {
      artifactDownloads = (d as ArtifactDownloads | null) ?? null;
    },
    () => undefined,
  );
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
  const persist = persistState(store.state, storage);
  const samples = createSampleBank(storage, booted.drums, booted.pads);

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

  // Pad-Samples an die Engine geben, nur geänderte Pads
  let prevPads = samples.pads.peek();
  effect(() => {
    const next = samples.pads.value;
    next.forEach((pcm, i) => {
      if (pcm !== prevPads[i]) engine.setPadSample(i, pcm);
    });
    prevPads = next;
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
    auditionNote: (p, d, l) => {
      engine.auditionNote(p, d, l);
    },
    auditionPad: (i) => {
      engine.auditionPad(i);
    },
    stutterOn: (f) => {
      engine.stutterOn(f);
    },
    stutterOff: () => {
      engine.stutterOff();
    },
    setFill: (on) => {
      engine.setFill(on);
    },
    punchOn: (k) => {
      engine.punchOn(k);
    },
    punchOff: (k) => {
      engine.punchOff(k);
    },
    decode: (d) => engine.decode(d),
    bounce: async (state) => {
      const bar = 16 * stepDuration(state.tempo);
      const buf = await renderOffline({
        state: { ...state, mode: 'pattern' },
        pads: samples.pads.peek(),
        drums: Object.fromEntries(samples.drums.peek()),
        playFor: bar,
        seconds: Math.min(bar, SMP_MAX),
        createContext: (ch, len, sr) => new OfflineAudioContext(ch, len, sr),
      });
      if (!buf) return null;
      return {
        // 5 ms Ausblende: ein hart abgeschnittener Takt würde am Pad-Ende knacken
        pcm: fadeOut(
          toPcm([buf.getChannelData(0), buf.getChannelData(1)], buf.sampleRate),
          Math.round(SMP_RATE * 0.005),
        ),
        cut: bar > SMP_MAX,
      };
    },
    exportWav: async (state, playFor, seconds, onProgress, signal) => {
      const buf = await renderOffline({
        state,
        pads: samples.pads.peek(),
        drums: Object.fromEntries(samples.drums.peek()),
        playFor,
        seconds,
        createContext: (ch, len, sr) => new OfflineAudioContext(ch, len, sr),
        onProgress,
        signal,
      });
      if (!buf) return null;
      const wav = encodeWav([buf.getChannelData(0), buf.getChannelData(1)], buf.sampleRate);
      return new Blob([wav], { type: 'audio/wav' });
    },
  };
  mountShell(must(document.getElementById('app') ?? undefined, '#app'), {
    store,
    samples,
    audio,
    files: {
      pickAudio: (opts) => pickAudioFile(document, opts),
      pickProject: () => pickTextFile(document, '.json,application/json'),
      save: (blob, name) =>
        saveFile(
          { navigator, document, URL, File, downloads: () => artifactDownloads },
          blob,
          name,
        ),
    },
    recorder: createRecorder({
      mediaDevices: navigator.mediaDevices,
      MediaRecorder:
        typeof MediaRecorder === 'undefined'
          ? undefined
          : (MediaRecorder as unknown as RecorderEnv['MediaRecorder']),
      setTimeout: (fn, ms) => window.setTimeout(fn, ms),
      clearTimeout: (h) => {
        window.clearTimeout(h as number);
      },
    }),
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
      // iOS friert Zeitgeber im Hintergrund ein: Ausstehendes sofort speichern
      persist.flush();
    },
    pointer: () => {
      engine.resume();
    },
  });
  window.addEventListener('pagehide', () => {
    persist.flush();
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
