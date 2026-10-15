import { createRequire } from 'node:module';
import { factorySamples, noiseData, softClipCurve } from '../../../src/audio/dsp.ts';
import { createEngine, type ScheduledStep } from '../../../src/audio/engine.ts';
import { renderOffline } from '../../../src/audio/export.ts';
import type { EngineTimer } from '../../../src/audio/timer.ts';
import { createGraph } from '../../../src/audio/graph.ts';
import { createSampler } from '../../../src/audio/sampler.ts';
import { synthNote } from '../../../src/audio/synth.ts';
import { renderVoice, type OfflineFactory } from '../../../src/audio/voices.ts';
import { CHANNELS, DRUM_DEFAULTS, SYN_PRESETS, VOICE_IDS } from '../../../src/core/constants.ts';
import { initialState } from '../../../src/core/initial.ts';
import { audibleChannels } from '../../../src/core/mix.ts';
import { seededRandom } from '../../../src/core/random.ts';
import type { DrumParams, Part, Slot, State, VoiceId } from '../../../src/core/types.ts';
import { createStore } from '../../../src/store/store.ts';
import { must } from '../../../src/core/util.ts';
import { fingerprint, type Fingerprint } from '../../support/fingerprint.ts';

/*
 * Dieselben Szenarien wie tests/reference/legacy/scenarios.ts, aber mit der neuen Engine.
 * Zufall je Zweck wie in der Legacy-Harness (seededRandom), damit Rauschen und Reverb übereinstimmen.
 */

const require = createRequire(import.meta.url);
const wa = require('node-web-audio-api') as { OfflineAudioContext: typeof OfflineAudioContext };
export const SR = 44100;
export const createOffline: OfflineFactory = (ch, len, sr) =>
  new wa.OfflineAudioContext(ch, len, sr);

/** Wie Legacy: Rauschpuffer (2 s, Strom 'graph') gehört dem Haupt-Kontext. */
export function sharedNoise(seed: number): AudioBuffer {
  const oc = createOffline(1, SR, SR);
  const b = oc.createBuffer(1, SR * 2, SR);
  b.getChannelData(0).set(noiseData(SR * 2, seededRandom(seed)('graph')));
  return b;
}

export async function drumVariants(args: {
  voice: VoiceId;
  seed?: number;
  variants: Record<string, Partial<DrumParams>>;
}): Promise<Record<string, Fingerprint>> {
  const seed = args.seed ?? 1;
  const random = seededRandom(seed);
  const noise = sharedNoise(seed);
  const kick = softClipCurve(1.6, true);
  const index = VOICE_IDS.indexOf(args.voice);
  const out: Record<string, Fingerprint> = {};
  for (const [name, change] of Object.entries(args.variants)) {
    const buf = await renderVoice({
      createOffline,
      sampleRate: SR,
      voice: args.voice,
      params: { ...DRUM_DEFAULTS[args.voice], ...change },
      noise,
      kick,
      rnd: random(`voice:${index}`),
    });
    out[name] = fingerprint(buf.getChannelData(0), buf.sampleRate);
  }
  return out;
}

export interface StereoPrint {
  L: Fingerprint;
  R: Fingerprint;
}

export async function renderStereo(ctx: OfflineAudioContext): Promise<StereoPrint> {
  const buf = await ctx.startRendering();
  const right = buf.numberOfChannels > 1 ? 1 : 0;
  return {
    L: fingerprint(buf.getChannelData(0), buf.sampleRate),
    R: fingerprint(buf.getChannelData(right), buf.sampleRate),
  };
}

/** Wie das Legacy-Szenario: Zustand nach init, angepasst, Graph bei currentTime 0 aufgebaut. */
function graphFor(s: State, seconds: number, seed: number) {
  const ctx = createOffline(2, Math.ceil(seconds * SR), SR);
  const graph = createGraph(ctx, s, audibleChannels(s.mix), seededRandom(seed));
  return { ctx, graph };
}

export async function synthPreset(args: {
  part: Part;
  preset: string;
  midi: number;
  seed?: number;
}): Promise<StereoPrint> {
  const s = structuredClone(initialState());
  const preset = must(
    SYN_PRESETS[args.part].find((x) => x.name === args.preset),
    args.preset,
  );
  s.tempo = 120;
  Object.assign(s.synth[args.part], preset.v);
  for (const id of CHANNELS) s.mix[id].r = 0;
  const { ctx, graph } = graphFor(s, 2, args.seed ?? 1);
  synthNote({
    ctx,
    dest: graph.parts[args.part].inp,
    patch: s.synth[args.part],
    midi: args.midi,
    time: 0.1,
    duration: 0.5,
    previous: undefined,
  });
  return renderStereo(ctx);
}

export async function samplerPad(args: { pad: number; seed?: number }): Promise<StereoPrint> {
  const seed = args.seed ?? 1;
  const s = structuredClone(initialState());
  s.mix.SM.r = 0;
  const { ctx, graph } = graphFor(s, 2, seed);
  const sampler = createSampler(ctx, factorySamples(seededRandom(seed)('factory')));
  sampler.play(args.pad, 0.1, must(s.smp.pads[args.pad], `Pad ${args.pad}`), graph.chan.SM.in);
  return renderStereo(ctx);
}

/** Leert alle Patterns und stellt einen neutralen Ausgangszustand her (wie Legacy isolate). */
function isolate(s: State): void {
  for (const k of Object.keys(s.patterns) as Slot[]) {
    const p = s.patterns[k];
    for (const v of VOICE_IDS) p[v] = new Array<0 | 1>(16).fill(0);
    p.notes.BA = new Array<null>(16).fill(null);
    p.notes.LD = new Array<null>(16).fill(null);
    p.smp = p.smp.map(() => new Array<0 | 1>(16).fill(0));
    p.sub = {};
  }
  s.mode = 'pattern';
  s.cur = 'A';
  s.tempo = 120;
}

function hits(s: State, steps: Partial<Record<VoiceId, number[]>>): void {
  for (const [id, list] of Object.entries(steps) as [VoiceId, number[]][]) {
    for (const i of list) s.patterns.A[id][i] = 1;
  }
}

interface EngineLike {
  stutterOn(f: number): void;
  stutterOff(): void;
}
type Change = (fn: (s: State) => State) => void;
interface MixCase {
  seconds: number;
  setup: (s: State) => void;
  events?: { at: number; run: (e: EngineLike, change: Change) => void }[];
}

const MIX: Record<string, MixCase> = {
  // Startzustand der App: Hip-Hop-Pattern A mit Bass, Lead und Sampler, Tempo 90, Swing
  demo: { seconds: 4, setup: () => undefined },
  base: {
    seconds: 1.9,
    setup: (s) => {
      isolate(s);
      hits(s, { BD: [0], SD: [4] });
    },
  },
  mute: {
    seconds: 1.9,
    setup: (s) => {
      isolate(s);
      hits(s, { BD: [0], SD: [4] });
      s.mix.BD.m = true;
      s.mix.SD.m = true;
    },
  },
  solo: {
    seconds: 1.9,
    setup: (s) => {
      isolate(s);
      hits(s, { BD: [0], SD: [4] });
      s.mix.SD.s = true;
    },
  },
  faderHalf: {
    seconds: 1,
    setup: (s) => {
      isolate(s);
      hits(s, { BD: [0] });
      s.mix.BD.v = 0.4;
      s.mix.BD.r = 0;
    },
  },
  master1: {
    seconds: 2,
    setup: (s) => {
      isolate(s);
      s.master = 1;
      (['BD', 'SD', 'CH', 'CP', 'OH', 'CY'] as const).forEach((id, k) => {
        for (let i = k % 2; i < 16; i += 2) s.patterns.A[id][i] = 1;
      });
    },
  },
  reverbDry: {
    seconds: 2.4,
    setup: (s) => {
      isolate(s);
      hits(s, { SD: [0] });
      s.mix.SD.r = 0;
    },
  },
  reverbWet: {
    seconds: 2.4,
    setup: (s) => {
      isolate(s);
      hits(s, { SD: [0] });
      s.mix.SD.r = 1;
      s.fx.ret = 1;
      s.fx.size = 0.8;
    },
  },
  // Live während der Wiedergabe: Mute, DJ-Filter, Return, Pegel, Pan und Tempo.
  // Solo fehlt bewusst: node-web-audio-api rendert vorab geplante Solo-Automation in beiden
  // Welten falsch (schon vor dem Ereignis); Solo prüft src/audio/engine.test.ts.
  liveMix: {
    seconds: 3,
    setup: () => undefined,
    events: [
      {
        at: 0.6,
        run: (_e, change) => {
          change((s) => ({
            ...s,
            mix: { ...s.mix, SD: { ...s.mix.SD, m: true } },
            fx: { ...s.fx, dj: 0.25, ret: 0.5 },
          }));
        },
      },
      {
        at: 1.4,
        run: (_e, change) => {
          change((s) => ({
            ...s,
            mix: { ...s.mix, BA: { ...s.mix.BA, v: 0.3 }, OH: { ...s.mix.OH, p: 0.9 } },
            tempo: 120,
          }));
        },
      },
    ],
  },
  // Open Hat klingt aus, Closed Hat würgt sie ab (808-Verhalten)
  hatChoke: {
    seconds: 1,
    setup: (s) => {
      isolate(s);
      hits(s, { OH: [0], CH: [2] });
      s.mix.OH.r = 0;
      s.mix.CH.r = 0;
    },
  },
  djLowpass: {
    seconds: 1.4,
    setup: (s) => {
      isolate(s);
      hits(s, { CH: [0, 2, 4], CY: [0] });
      s.fx.dj = 0.05;
    },
  },
  djHighpass: {
    seconds: 1.4,
    setup: (s) => {
      isolate(s);
      hits(s, { BD: [0] });
      s.fx.dj = 0.95;
    },
  },
  panRight: {
    seconds: 1,
    setup: (s) => {
      isolate(s);
      hits(s, { BD: [0] });
      s.mix.BD.p = 1;
      s.mix.BD.r = 0;
    },
  },
  stutter: {
    seconds: 1.7,
    setup: (s) => {
      isolate(s);
      hits(s, { BD: [0] });
      s.mix.BD.r = 0;
    },
    events: [
      {
        at: 0.1,
        run: (e) => {
          e.stutterOn(0.125);
        },
      },
    ],
  },
  stutterRelease: {
    seconds: 2.4,
    setup: (s) => {
      isolate(s);
      hits(s, { BD: [0], SD: [12] });
      s.mix.BD.r = 0;
    },
    events: [
      {
        at: 0.1,
        run: (e) => {
          e.stutterOn(0.125);
        },
      },
      {
        at: 0.8,
        run: (e) => {
          e.stutterOff();
        },
      },
    ],
  },
};

export const MIX_NAMES = Object.keys(MIX);

/**
 * Wie die Legacy-Szenarien: Zustand nach init → Setup → Engine bei t = 0 → Vorrendern →
 * Scheduler im 25-ms-Takt, von Hand ausgelöst, bis `playFor` erreicht ist.
 */
async function play(o: {
  seconds: number;
  playFor?: number;
  setup: (s: State) => void;
  events?: { at: number; run: (e: EngineLike, change: Change) => void }[];
  seed: number;
  instrument?: (c: OfflineAudioContext) => void;
  afterPrerender?: () => void;
  onScheduled?: (s: ScheduledStep) => void;
  each?: (now: number, store: ReturnType<typeof createStore>) => boolean;
}) {
  const s = structuredClone(initialState());
  o.setup(s);
  const store = createStore(s);
  const random = seededRandom(o.seed);
  const ctx = createOffline(2, Math.ceil(o.seconds * SR), SR);
  o.instrument?.(ctx);
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
    store,
    createContext: () => ctx,
    createOffline,
    random,
    timer,
    clock: () => now,
    prerender: false,
    pads: factorySamples(random('factory')),
    ...(o.onScheduled ? { onScheduled: o.onScheduled } : {}),
  });
  engine.prepare();
  await engine.prerenderAll();
  if (!engine.drumsReady()) throw new Error('Nicht alle Stimmen vorgerendert');
  o.afterPrerender?.();
  engine.start();
  const pending = [...(o.events ?? [])];
  const end = o.playFor ?? o.seconds;
  for (now = 0; now < end; now += 0.025) {
    while (pending[0] && pending[0].at <= now)
      pending.shift()?.run(engine, (fn) => {
        store.update(fn);
      });
    if (o.each?.(now, store)) break;
    (pump as (() => void) | null)?.();
  }
  return { ctx, engine, store };
}

export async function mixScenario(args: { name: string; seed?: number }): Promise<StereoPrint> {
  const sc = must(MIX[args.name], `Mix-Szenario ${args.name}`);
  const { ctx } = await play({ ...sc, seed: args.seed ?? 1 });
  return renderStereo(ctx);
}

export interface BenchResult {
  renderMs: number;
  nodesPerSecond: number;
  counts: Record<string, number>;
}

const COUNTED = [
  'createOscillator',
  'createBufferSource',
  'createGain',
  'createBiquadFilter',
  'createWaveShaper',
  'createDelay',
  'createDynamicsCompressor',
] as const;

/** Wie Legacy-Bench: 7 s spielen, 8 s rendern, Knoten des Haupt-Kontexts zählen. */
export async function bench(args: { load: 'demo' | 'worst' }): Promise<BenchResult> {
  const counts: Record<string, number> = Object.fromEntries(COUNTED.map((n) => [n, 0]));
  const { ctx } = await play({
    seconds: 8,
    playFor: 7,
    seed: 1,
    setup: (s) => {
      if (args.load === 'worst') {
        for (const id of ['BD', 'SD', 'CH', 'OH', 'CP', 'CY'] as const) {
          const sub: Record<number, (0 | 1)[]> = {};
          for (let st = 0; st < 16; st += 2) {
            sub[st] = Array.from({ length: 16 }, (_, k) => (k % 2 === 0 ? 1 : 0));
          }
          s.patterns.A.sub[id] = sub;
        }
      }
      s.tempo = 120;
      s.mode = 'pattern';
      s.cur = 'A';
    },
    instrument: (c) => {
      const target = c as unknown as Record<string, (...a: unknown[]) => unknown>;
      for (const name of COUNTED) {
        const orig = must(target[name], name).bind(c);
        target[name] = (...a: unknown[]) => {
          counts[name] = (counts[name] ?? 0) + 1;
          return orig(...a);
        };
      }
    },
    afterPrerender: () => {
      for (const k of Object.keys(counts)) counts[k] = 0;
    },
  });
  const t0 = performance.now();
  await ctx.startRendering();
  const renderMs = Math.round(performance.now() - t0);
  const total = Object.values(counts).reduce((x, y) => x + y, 0);
  return { renderMs, nodesPerSecond: Math.round(total / 7), counts };
}

export interface SequenceArgs {
  song: { p: string; n: number }[];
  mode: 'song' | 'pattern';
  cur: string;
  tempo: number;
  swing: number;
  steps: number;
  switchAt?: number;
  switchTo?: string;
}

/** Was der Scheduler je Step einplant, inkl. Slot-Wechsel mitten im Takt (wie Legacy-Szenario). */
export async function songSequence(
  args: SequenceArgs,
): Promise<{ entries: ScheduledStep[]; switchedAt: number }> {
  const entries: ScheduledStep[] = [];
  let switchedAt = -1;
  await play({
    seconds: 1,
    playFor: 1000,
    seed: 1,
    setup: (s) => {
      isolate(s);
      s.song = args.song as State['song'];
      s.mode = args.mode;
      s.cur = args.cur as Slot;
      s.tempo = args.tempo;
      s.swing = args.swing;
    },
    onScheduled: (e) => entries.push({ ...e }),
    each: (_now, store) => {
      if (entries.length >= args.steps) return true;
      if (switchedAt < 0 && args.switchAt !== undefined && entries.length >= args.switchAt) {
        const to = must(args.switchTo, 'switchTo') as Slot;
        store.update((st) => ({ ...st, cur: to }));
        switchedAt = entries.length;
      }
      return false;
    },
  });
  return { entries: entries.slice(0, args.steps), switchedAt };
}

/** Export-Weg (audio/export.ts) mit dem Demo-Zustand: muss wie das Mix-Szenario 'demo' klingen. */
export async function exportDemo(args: { seed?: number }): Promise<StereoPrint> {
  const random = seededRandom(args.seed ?? 1);
  const buf = await renderOffline({
    state: structuredClone(initialState()),
    pads: factorySamples(random('factory')),
    drums: {},
    playFor: 4,
    seconds: 4,
    // wie die Live-Wiedergabe (erster Step nach 80 ms), damit der Fingerabdruck vergleichbar ist
    leadIn: 0.08,
    createContext: createOffline,
    createOffline,
    random,
  });
  if (!buf) throw new Error('Export abgebrochen');
  return {
    L: fingerprint(buf.getChannelData(0), buf.sampleRate),
    R: fingerprint(buf.getChannelData(1), buf.sampleRate),
  };
}

/** Grenzen und Abbruch des Export-Wegs: geplante Steps, Fortschritt, Abbruch. */
export async function exportBounds(): Promise<{
  steps: number[];
  firstTime: number;
  progress: number[];
  abortedBefore: boolean;
  abortedDuring: boolean;
}> {
  const s = structuredClone(initialState());
  const steps: number[] = [];
  const times: number[] = [];
  const progress: number[] = [];
  const base = {
    pads: [],
    drums: {},
    createContext: createOffline,
    createOffline,
    random: seededRandom(1),
  };
  const bar = 16 * (60 / s.tempo / 4);
  await renderOffline({
    ...base,
    state: { ...s, mode: 'pattern' },
    playFor: bar,
    seconds: bar + 0.5,
    onScheduled: (e) => {
      steps.push(e.step);
      times.push(e.time);
    },
    onProgress: (f) => progress.push(f),
    yieldEvery: 4,
  });
  const before = new AbortController();
  before.abort();
  const a = await renderOffline({
    ...base,
    state: s,
    playFor: 1,
    seconds: 1,
    signal: before.signal,
  });
  const during = new AbortController();
  const b = await renderOffline({
    ...base,
    state: s,
    playFor: 4,
    seconds: 4,
    signal: during.signal,
    yieldEvery: 2,
    onProgress: (f) => {
      if (f > 0.2) during.abort();
    },
  });
  return {
    steps,
    firstTime: times[0] ?? -1,
    progress,
    abortedBefore: a === null,
    abortedDuring: b === null,
  };
}

export const SCENARIOS: Record<string, (args: never) => Promise<unknown>> = {
  exportDemo,
  exportBounds,
  drumVariants,
  synthPreset,
  samplerPad,
  mixScenario,
  bench,
  songSequence,
};
