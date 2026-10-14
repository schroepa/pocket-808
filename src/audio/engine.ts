import { CHANNELS, PARTS, VOICE_IDS } from '../core/constants.ts';
import { audibleChannels } from '../core/mix.ts';
import { degreeToMidi, effectiveLength } from '../core/music.ts';
import { subStepsOf } from '../core/pattern.ts';
import type { Rng } from '../core/random.ts';
import type { DrumSample } from '../core/samples.ts';
import { nextBar, songStart, stepSlot, type SongCursor } from '../core/song.ts';
import { stepDuration, subStepOffset, swingDelay } from '../core/timing.ts';
import type { ChannelId, Part, Slot, State, SubKey, VoiceId } from '../core/types.ts';
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
  Partial<Pick<AudioContext, 'resume' | 'outputLatency'>>;

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
  /** z. B. iOS-Entsperren aus platform, direkt im Tipp-Handler */
  beforeStart?: () => void;
  onScheduled?: (s: ScheduledStep) => void;
}

export interface Engine {
  prepare(): boolean;
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
  /** Klänge zu einem festen Zeitpunkt planen (Scheduler, Tests, später Live-Aufnahme) */
  readonly schedule: {
    drum(voice: VoiceId, time: number): void;
    note(part: Part, midi: number, time: number, duration: number): void;
    pad(pad: number, time: number): void;
  };
  dispose(): void;
}

const LOOKAHEAD_MS = 25;
const HORIZON_S = 0.2;
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
  const drumSamples: Partial<Record<VoiceId, DrumSample>> = { ...o.drums };
  const disposers: (() => void)[] = [];
  const synthLast: Partial<Record<Part, SynthVoice>> = {};
  const playing = signal(false);
  const playhead = signal({ step: -1, songIndex: -1 });
  let interval: unknown = null;
  let step = 0;
  let nextTime = 0;
  let cursor: SongCursor = songStart();
  let bar: { slot: Slot; fromSong: boolean } = { slot: 'A', fromSong: false };
  const queue: ScheduledStep[] = [];
  let irTimer: unknown = null;

  const now = (): number => (o.clock ? o.clock() : (ctx?.currentTime ?? 0));
  const state = (): State => store.state.peek();

  /** Legacy queueIR: 150 ms entprellt, Return ausblenden, nach 50 ms neuen Convolver einsetzen. */
  const queueReverb = (): void => {
    timer.clearTimeout(irTimer);
    irTimer = timer.setTimeout(() => {
      const g = graph;
      if (!g) return;
      g.muteReverb(now());
      timer.setTimeout(() => {
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
      }),
    );
  };

  const prepare = (): boolean => {
    if (graph) return true;
    const c = o.createContext();
    ctx = c;
    const g = createGraph(c, state(), audible.peek(), random);
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

  const scheduleDrum = (voice: VoiceId, t: number): void => {
    drums?.hit(voice, t, state().params[voice]);
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
  const schedulePad = (pad: number, t: number): void => {
    if (!graph || !sampler) return;
    sampler.play(pad, t, must(state().smp.pads[pad], `Pad ${pad}`), graph.chan.SM.in);
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
      const pat = s.patterns[slot];
      const d = stepDuration(s.tempo);
      const t = nextTime + swingDelay(step, s.swing, d);
      const aud = audible.peek();
      for (const id of VOICE_IDS) {
        if (!aud[id]) continue;
        const sb = subStepsOf(pat, id, step);
        if (sb) {
          for (let k = 0; k < 16; k++) if (sb[k]) scheduleDrum(id, t + subStepOffset(k, d));
        } else if (pat[id][step]) scheduleDrum(id, t);
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
          const sb = subStepsOf(pat, `P${i}` as SubKey, step);
          if (sb) {
            for (let k = 0; k < 16; k++) if (sb[k]) schedulePad(i, t + subStepOffset(k, d));
          } else if (pat.smp[i]?.[step]) schedulePad(i, t);
        }
      }
      const entry: ScheduledStep = { step, time: t, slot, song: bar.fromSong, si: cursor.index };
      queue.push(entry);
      o.onScheduled?.(entry);
      nextTime += d;
      step = (step + 1) % 16;
    }
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
    start() {
      if (playing.peek()) return;
      o.beforeStart?.();
      prepare();
      resume();
      playing.value = true;
      step = 0;
      cursor = songStart();
      queue.length = 0;
      nextTime = now() + 0.08;
      interval = timer.setInterval(pump, LOOKAHEAD_MS);
      pump();
    },
    stop() {
      if (!playing.peek()) return;
      timer.clearInterval(interval);
      interval = null;
      queue.length = 0;
      batch(() => {
        playing.value = false;
        playhead.value = { step: -1, songIndex: -1 };
      });
    },
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
      prepare();
      scheduleDrum(voice, now() + 0.005);
    },
    auditionNote(part, degree, length = 1) {
      prepare();
      const s = state();
      scheduleNote(
        part,
        degreeToMidi(part, degree, s, s.synth[part].oct),
        now() + 0.005,
        ((length * 60) / s.tempo / 4) * 0.92 + 0.12,
      );
    },
    auditionPad(pad) {
      prepare();
      if (sampler?.has(pad)) schedulePad(pad, now() + 0.005);
    },
    stutterOn(fraction) {
      prepare();
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
      if (sample) drumSamples[voice] = sample;
      drums?.setSample(voice, sample);
    },
    schedule: { drum: scheduleDrum, note: scheduleNote, pad: schedulePad },
    dispose() {
      if (interval !== null) timer.clearInterval(interval);
      timer.clearTimeout(irTimer);
      for (const d of disposers.splice(0)) d();
    },
  };
}
