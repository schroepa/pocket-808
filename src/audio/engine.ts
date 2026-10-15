import { CHANNELS, PARTS, VOICE_IDS } from '../core/constants.ts';
import { audibleChannels } from '../core/mix.ts';
import { degreeToMidi, effectiveLength } from '../core/music.ts';
import { subStepsOf } from '../core/pattern.ts';
import type { Rng } from '../core/random.ts';
import { toPcm, type DrumSample } from '../core/samples.ts';
import { nextBar, songStart, stepSlot, type SongCursor } from '../core/song.ts';
import { stepDuration, subStepOffset, swingDelay } from '../core/timing.ts';
import { condPasses, stepOptOf, velocityGain } from '../core/stepopts.ts';
import type { ChannelId, Part, Pattern, Slot, State, SubKey, VoiceId } from '../core/types.ts';
import { must } from '../core/util.ts';
import { batch, computed, effect, signal, type ReadonlySignal } from '../store/signals.ts';
import type { Store } from '../store/store.ts';
import { createDrumBank, type DrumBank } from './drums.ts';
import { impulseResponse, stutterPeriod } from './dsp.ts';
import { createGraph, type Graph } from './graph.ts';
import { createSampler, type Sampler } from './sampler.ts';
import { synthNote, type SynthVoice } from './synth.ts';
import { browserTimer, type EngineTimer } from './timer.ts';
import type { OfflineFactory } from './voices.ts';

/*
 * Audio-Engine: baut Kontext und Graph erst bei prepare()/start(), folgt dem Store per Effekt
 * (Mixer, FX, Tempo, Synth-Pegel, Tune/Decay) und plant mit dem Lookahead-Scheduler (Legacy pump).
 */

export interface ScheduledStep {
  step: number;
  time: number;
  slot: Slot;
  song: boolean;
  si: number;
}

/** Echter oder Offline-Kontext; resume und outputLatency gibt es nur bei manchen. */
export type EngineContext = BaseAudioContext &
  Partial<Pick<AudioContext, 'resume' | 'close' | 'outputLatency'>>;

export interface EngineOptions {
  store: Store;
  createContext: () => EngineContext;
  createOffline?: OfflineFactory;
  random?: (tag: string) => Rng;
  timer?: EngineTimer;
  clock?: () => number;
  pads?: readonly (Float32Array | null)[];
  drums?: Partial<Record<VoiceId, DrumSample>>;
  /** false: Drums nicht automatisch vorrendern (Tests rendern gezielt mit prerenderAll) */
  prerender?: boolean;
  /** bei jeder Bedien-Geste (Start, Vorhören, Stutter), z. B. iOS-Entsperren aus platform */
  onGesture?: () => void;
  onScheduled?: (s: ScheduledStep) => void;
}

export interface Engine {
  /** Kontext und Graph anlegen (einmal); false, wenn der Aufbau scheitert oder nach dispose */
  prepare(): boolean;
  /** Kontext wecken, falls er nicht läuft (iOS: bei jedem Pointerdown) */
  resume(): void;
  prerenderAll(): Promise<void>;
  drumsReady(): boolean;
  readonly playing: ReadonlySignal<boolean>;
  readonly playhead: ReadonlySignal<{ step: number; songIndex: number }>;
  start(): void;
  stop(): void;
  /** pro Bildschirm-Frame aufrufen: Abspielposition, im Song-Modus folgt die Ansicht */
  tick(now?: number): void;
  audition(voice: VoiceId): void;
  auditionNote(part: Part, degree: number, length?: number): void;
  auditionPad(pad: number): void;
  stutterOn(fraction: number): void;
  stutterOff(): void;
  setPadSample(pad: number, pcm: Float32Array | null): void;
  setDrumSample(voice: VoiceId, sample: DrumSample | null): void;
  /** Datei dekodieren und ins Sample-Format (22,05 kHz mono) umrechnen */
  decode(data: ArrayBuffer): Promise<Float32Array>;
  /** Klänge zu einem festen Zeitpunkt planen (Scheduler, Tests, später Live-Aufnahme) */
  readonly schedule: {
    drum(voice: VoiceId, time: number, velocity?: number): void;
    note(part: Part, midi: number, time: number, duration: number): void;
    pad(pad: number, time: number, velocity?: number): void;
  };
  /** stoppt, löscht Zeitgeber und Effekte und schließt den Kontext; danach ist die Engine stumm */
  dispose(): void;
}

const LOOKAHEAD_MS = 25;
/** Vorlauf des Schedulers (Sekunden) */
export const HORIZON_S = 0.2;
/** Abstand des ersten Steps zur Uhr beim Start (Sekunden) */
export const START_DELAY = 0.08;
const sameAudible = (a: Record<ChannelId, boolean>, b: Record<ChannelId, boolean>): boolean =>
  CHANNELS.every((id) => a[id] === b[id]);
/** Wert nur lesen, um im Effekt eine Abhängigkeit anzulegen. */
const dependOn = (value: unknown): unknown => value;

export function createEngine(o: EngineOptions): Engine {
  const { store } = o;
  const timer = o.timer ?? browserTimer;
  const random = o.random ?? ((): Rng => Math.random);
  const createOffline: OfflineFactory =
    o.createOffline ?? ((ch, len, sr) => new OfflineAudioContext(ch, len, sr));
  const audible = store.select((s) => audibleChannels(s.mix), sameAudible);

  let ctx: EngineContext | null = null;
  let graph: Graph | null = null;
  let drums: DrumBank | null = null;
  let sampler: Sampler | null = null;
  const pads: (Float32Array | null)[] = [...(o.pads ?? [])];
  const drumSamples = new Map(Object.entries(o.drums ?? {}) as [VoiceId, DrumSample][]);
  const disposers: (() => void)[] = [];
  const synthLast: Partial<Record<Part, SynthVoice>> = {};
  const playing = signal(false);
  const playhead = signal({ step: -1, songIndex: -1 });
  let interval: unknown = null;
  let step = 0;
  let nextTime = 0;
  let cursor: SongCursor = songStart();
  let bar: { slot: Slot; fromSong: boolean } = { slot: 'A', fromSong: false };
  /** Durchläufe je Slot seit dem Start (Bedingungen der Step-Optionen) */
  let loops: Partial<Record<Slot, number>> = {};
  const chance = random('prob');
  const queue: ScheduledStep[] = [];
  let irTimer: unknown = null;
  let disposed = false;

  const now = (): number => (o.clock ? o.clock() : (ctx?.currentTime ?? 0));
  const state = (): State => store.state.peek();

  /** Legacy queueIR: 150 ms entprellt, Return ausblenden, nach 50 ms neuen Convolver einsetzen. */
  const queueReverb = (): void => {
    timer.clearTimeout(irTimer);
    irTimer = timer.setTimeout(() => {
      const g = graph;
      if (!g) return;
      g.muteReverb(now());
      irTimer = timer.setTimeout(() => {
        const s = state();
        g.replaceReverb(
          impulseResponse(g.ctx.sampleRate, s.fx.size, s.fx.damp, random('ir')),
          s.fx,
          now(),
        );
      }, 50);
    }, 150);
  };

  /** Effekte für Live-Parameter. Erster Lauf nur merken: Anfangswerte setzt createGraph. */
  const watchLive = (g: Graph): void => {
    const live = <T>(read: () => T, apply: (v: T) => void): void => {
      let first = true;
      disposers.push(
        effect(() => {
          const v = read();
          if (first) {
            first = false;
            return;
          }
          apply(v);
        }),
      );
    };
    const master = store.select((s) => s.master);
    live(
      () => master.value,
      (v) => {
        g.setMaster(v, now());
      },
    );
    for (const id of CHANNELS) {
      const ch = store.select((s) => s.mix[id]);
      const aud = computed(() => audible.value[id]);
      live(
        () => [ch.value, aud.value] as const,
        ([c, a]) => {
          g.applyChannel(id, c, a, now());
        },
      );
    }
    const fxMix = store.select(
      (s) => s.fx,
      (a, b) => a.ret === b.ret && a.dj === b.dj && a.djq === b.djq,
    );
    live(
      () => fxMix.value,
      (fx) => {
        g.applyFx(fx, now());
      },
    );
    const room = store.select(
      (s) => s.fx,
      (a, b) => a.size === b.size && a.damp === b.damp,
    );
    live(() => room.value, queueReverb);
    const tempo = store.select((s) => s.tempo);
    const synth = store.select((s) => s.synth);
    const partsAudible = computed(
      () => [audible.value.BA, audible.value.LD] as const,
      (a, b) => a[0] === b[0] && a[1] === b[1],
    );
    live(
      () => [tempo.value, synth.value, partsAudible.value] as const,
      () => {
        g.syncSynth(state(), audible.peek(), now());
      },
    );
    for (const id of VOICE_IDS) {
      const p = store.select(
        (s) => s.params[id],
        (a, b) => a.tune === b.tune && a.decay === b.decay,
      );
      live(
        () => p.value,
        () => {
          drums?.rerender(id);
        },
      );
    }
    // Moduswechsel (Legacy setMode: songFirst = true): Song beginnt wieder vorn
    disposers.push(
      effect(() => {
        dependOn(store.songEpoch.value);
        cursor = songStart();
        loops = {};
      }),
    );
  };

  const close = (c: EngineContext): void => {
    c.close?.().catch(() => undefined);
  };

  const prepare = (): boolean => {
    if (disposed) return false;
    if (graph) return true;
    let c: EngineContext;
    try {
      c = o.createContext();
    } catch {
      return false; // kein Web Audio
    }
    let g: Graph;
    try {
      g = createGraph(c, state(), audible.peek(), random);
    } catch {
      // z. B. fehlender StereoPanner: Kontext nicht liegen lassen, beim nächsten Tipp neu versuchen
      close(c);
      return false;
    }
    ctx = c;
    graph = g;
    drums = createDrumBank({
      graph: g,
      createOffline,
      random,
      timer,
      params: () => state().params,
      samples: drumSamples,
    });
    sampler = createSampler(c, pads);
    watchLive(g);
    if (o.prerender !== false) void drums.prerenderAll();
    return true;
  };

  const resume = (): void => {
    if (ctx?.resume && ctx.state !== 'running') ctx.resume().catch(() => undefined);
  };

  /** Bedien-Geste: Entsperren, Kontext anlegen und wecken (Legacy ensureAudio) */
  const gesture = (): boolean => {
    if (disposed) return false;
    o.onGesture?.();
    if (!prepare()) return false;
    resume();
    return true;
  };

  const scheduleDrum = (voice: VoiceId, t: number, velocity = 1): void => {
    const p = state().params[voice];
    drums?.hit(voice, t, velocity === 1 ? p : { ...p, level: p.level * velocityGain(velocity) });
  };
  const scheduleNote = (part: Part, midi: number, t: number, duration: number): void => {
    if (!graph || !ctx) return;
    synthLast[part] = synthNote({
      ctx,
      dest: graph.parts[part].inp,
      patch: state().synth[part],
      midi,
      time: t,
      duration,
      previous: synthLast[part],
    });
  };
  const schedulePad = (pad: number, t: number, velocity = 1): void => {
    if (!graph || !sampler) return;
    const p = must(state().smp.pads[pad], `Pad ${pad}`);
    // der Sampler rechnet lvl², so ergibt lvl · v ebenfalls v²
    sampler.play(pad, t, velocity === 1 ? p : { ...p, lvl: p.lvl * velocity }, graph.chan.SM.in);
  };
  /** Bedingung (Durchlauf n) und Wahrscheinlichkeit eines Steps; liefert die Velocity oder null */
  const trig = (pat: Pattern, key: SubKey, st: number, n: number): number | null => {
    const o = stepOptOf(pat, key, st);
    if (!condPasses(o.c, n)) return null;
    if (o.p < 1 && chance() >= o.p) return null;
    return o.v;
  };

  /** Lookahead-Scheduler (Legacy pump): plant alle Steps bis 0,2 s voraus. */
  const pump = (): void => {
    const t0 = now();
    if (nextTime < t0 - 0.1) nextTime = t0 + 0.05;
    const horizon = t0 + HORIZON_S;
    while (nextTime < horizon) {
      const s = state();
      if (step === 0) {
        const r = nextBar(cursor, s);
        cursor = r.cursor;
        bar = r;
      }
      const slot = stepSlot(bar, s);
      // Step 0 beginnt einen Durchlauf; ein mitten im Takt begonnener Slot zählt sofort als Durchlauf 1
      const n = (loops[slot] = step === 0 ? (loops[slot] ?? 0) + 1 : (loops[slot] ?? 1));
      const pat = s.patterns[slot];
      const d = stepDuration(s.tempo);
      const t = nextTime + swingDelay(step, s.swing, d);
      const aud = audible.peek();
      for (const id of VOICE_IDS) {
        if (!aud[id]) continue;
        const sb = subStepsOf(pat, id, step);
        if (!sb && !pat[id][step]) continue;
        const v = trig(pat, id, step, n);
        if (v === null) continue;
        if (sb) {
          for (let k = 0; k < 16; k++) if (sb[k]) scheduleDrum(id, t + subStepOffset(k, d), v);
        } else scheduleDrum(id, t, v);
      }
      for (const id of PARTS) {
        const row = pat.notes[id];
        const n = row[step];
        if (n && aud[id]) {
          scheduleNote(
            id,
            degreeToMidi(id, n.d, s, s.synth[id].oct),
            t,
            effectiveLength(row, step) * d * 0.92,
          );
        }
      }
      if (aud.SM) {
        for (let i = 0; i < 8; i++) {
          const key = `P${i}` as SubKey;
          const sb = subStepsOf(pat, key, step);
          if (!sb && !pat.smp[i]?.[step]) continue;
          const v = trig(pat, key, step, n);
          if (v === null) continue;
          if (sb) {
            for (let k = 0; k < 16; k++) if (sb[k]) schedulePad(i, t + subStepOffset(k, d), v);
          } else schedulePad(i, t, v);
        }
      }
      const entry: ScheduledStep = { step, time: t, slot, song: bar.fromSong, si: cursor.index };
      queue.push(entry);
      o.onScheduled?.(entry);
      nextTime += d;
      step = (step + 1) % 16;
    }
  };

  const stop = (): void => {
    if (!playing.peek()) return;
    timer.clearInterval(interval);
    interval = null;
    queue.length = 0;
    batch(() => {
      playing.value = false;
      playhead.value = { step: -1, songIndex: -1 };
    });
  };

  return {
    prepare,
    prerenderAll: async () => {
      prepare();
      await drums?.prerenderAll();
    },
    drumsReady: () => VOICE_IDS.every((id) => drums?.ready(id) ?? false),
    playing,
    playhead,
    resume,
    start() {
      if (playing.peek() || !gesture()) return;
      playing.value = true;
      step = 0;
      cursor = songStart();
      loops = {};
      queue.length = 0;
      nextTime = now() + START_DELAY;
      interval = timer.setInterval(pump, LOOKAHEAD_MS);
      pump();
    },
    stop,
    tick(at) {
      if (!playing.peek()) return;
      const t = at ?? now() - (ctx?.outputLatency ?? 0);
      let hit: ScheduledStep | undefined;
      while (queue[0] && queue[0].time <= t) hit = queue.shift();
      if (!hit) return;
      const h = hit;
      batch(() => {
        playhead.value = { step: h.step, songIndex: h.song ? h.si : -1 };
        if (h.song && h.slot !== state().cur) store.selectSlot(h.slot);
      });
    },
    audition(voice) {
      if (!gesture()) return;
      scheduleDrum(voice, now() + 0.005);
    },
    auditionNote(part, degree, length = 1) {
      if (!gesture()) return;
      const s = state();
      scheduleNote(
        part,
        degreeToMidi(part, degree, s, s.synth[part].oct),
        now() + 0.005,
        ((length * 60) / s.tempo / 4) * 0.92 + 0.12,
      );
    },
    auditionPad(pad) {
      if (!gesture()) return;
      if (sampler?.has(pad)) schedulePad(pad, now() + 0.005);
    },
    stutterOn(fraction) {
      if (!gesture()) return;
      graph?.stutterOn(now() + 0.01, stutterPeriod(state().tempo, fraction));
    },
    stutterOff() {
      graph?.stutterOff(now() + 0.005);
    },
    setPadSample(pad, pcm) {
      pads[pad] = pcm;
      sampler?.setPcm(pad, pcm);
    },
    setDrumSample(voice, sample) {
      if (sample) drumSamples.set(voice, sample);
      else drumSamples.delete(voice);
      drums?.setSample(voice, sample);
    },
    async decode(data) {
      if (!prepare()) throw new Error('Kein Audio');
      const c = ctx;
      if (!c) throw new Error('Kein Audio');
      const buf = await c.decodeAudioData(data);
      return toPcm(
        Array.from({ length: buf.numberOfChannels }, (_, i) => buf.getChannelData(i)),
        buf.sampleRate,
      );
    },
    schedule: { drum: scheduleDrum, note: scheduleNote, pad: schedulePad },
    dispose() {
      if (disposed) return;
      stop();
      disposed = true;
      timer.clearTimeout(irTimer);
      for (const d of disposers.splice(0)) d();
      drums?.dispose();
      if (ctx) close(ctx);
      ctx = null;
      graph = null;
      drums = null;
      sampler = null;
    },
  };
}
