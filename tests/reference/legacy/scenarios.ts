import { fingerprint, type Fingerprint } from '../../support/fingerprint.ts';
import { loadLegacy, type LegacyPage } from './harness.ts';
import { row, type DrumParams, type LegacyHooks, type Part } from './types.ts';

export interface StereoPrint {
  L: Fingerprint;
  R: Fingerprint;
}

/** Wirft, wenn das Legacy-Fenster Fehler gemeldet hat: Sonst hielte eine Referenz still einen Fehlerpfad fest. */
export function assertClean(p: Pick<LegacyPage, 'errors'>): void {
  if (p.errors.length) throw new Error(`Fehler im Legacy-Fenster:\n${p.errors.join('\n')}`);
}

/** Wirft, wenn eine Drum-Stimme nicht vorgerendert ist (Legacy fiele still auf Live-Synthese zurück). */
export function assertPrerendered(t: LegacyHooks): void {
  const missing = t.VOICES.filter((v) => !t.voiceBuf[v.id]).map((v) => v.id);
  if (missing.length) throw new Error(`Nicht vorgerendert: ${missing.join(', ')}`);
}

export async function renderStereo(p: LegacyPage): Promise<StereoPrint> {
  const buf = await p.ctx().startRendering();
  assertClean(p);
  const right = buf.numberOfChannels > 1 ? 1 : 0;
  return {
    L: fingerprint(buf.getChannelData(0), buf.sampleRate),
    R: fingerprint(buf.getChannelData(right), buf.sampleRate),
  };
}

/** Prüft die Kette Kindprozess → jsdom → Audio: ein kurzer Synth-Ton. */
export async function smoke(): Promise<{ errors: string[]; peak: number }> {
  const p = loadLegacy({ audio: { seconds: 0.5 } });
  try {
    if (!p.t.ensureAudio()) throw new Error('Audio-Kontext fehlt');
    p.setNow(0.001);
    p.t.applyMixAll();
    p.setNow(0);
    p.t.synthNote('BA', 45, 0.05, 0.2);
    const print = await renderStereo(p);
    return { errors: p.errors, peak: print.L.peak };
  } finally {
    p.close();
  }
}

/** Rendert eine Drum-Stimme über den Legacy-Vorrender-Pfad (renderVoice) in mehreren Parameter-Varianten. */
export async function drumVariants(args: {
  voice: string;
  seed?: number;
  variants: Record<string, Partial<DrumParams>>;
}): Promise<Record<string, Fingerprint>> {
  const p = loadLegacy({ seed: args.seed ?? 1, audio: { seconds: 1 } });
  try {
    if (!p.t.ensureAudio()) throw new Error('Audio-Kontext fehlt');
    const index = p.t.VOICES.findIndex((v) => v.id === args.voice);
    const params = p.t.state.params[args.voice];
    if (index < 0 || !params) throw new Error(`Unbekannte Stimme ${args.voice}`);
    const base = { ...params };
    const out: Record<string, Fingerprint> = {};
    for (const [name, change] of Object.entries(args.variants)) {
      Object.assign(params, base, change);
      // renderVoice verschluckt Fehler: alten Buffer entfernen, damit nichts Veraltetes durchrutscht
      p.t.voiceBuf[args.voice] = undefined;
      await p.t.renderVoice(index);
      const buf = p.t.voiceBuf[args.voice];
      if (!buf) throw new Error(`Kein Buffer für ${args.voice}/${name}`);
      out[name] = fingerprint(buf.getChannelData(0), buf.sampleRate);
    }
    assertClean(p);
    return out;
  } finally {
    p.close();
  }
}

/** Ein Synth-Ton mit Preset, durch Kanalzug, Delay und Master-Kette. Reverb aus (eigenes Mix-Szenario). */
export async function synthPreset(args: {
  part: Part;
  preset: string;
  midi: number;
  seed?: number;
}): Promise<StereoPrint> {
  const p = loadLegacy({ seed: args.seed ?? 1, audio: { seconds: 2 } });
  try {
    const { t } = p;
    const preset = t.SYN_PRESETS[args.part].find((x) => x.name === args.preset);
    if (!preset) throw new Error(`Unbekanntes Preset ${args.part}/${args.preset}`);
    t.state.tempo = 120;
    Object.assign(t.state.synth[args.part], preset.v);
    for (const ch of Object.values(t.state.mix)) ch.r = 0;
    if (!t.ensureAudio()) throw new Error('Audio-Kontext fehlt');
    p.setNow(0.001);
    t.applyMixAll();
    p.setNow(0);
    t.synthNote(args.part, args.midi, 0.1, 0.5);
    return await renderStereo(p);
  } finally {
    p.close();
  }
}

/** Ein Fabrik-Sample mit Standard-Pad-Einstellungen. */
export async function samplerPad(args: { pad: number; seed?: number }): Promise<StereoPrint> {
  const p = loadLegacy({ seed: args.seed ?? 1, audio: { seconds: 2 } });
  try {
    const { t } = p;
    const mix = t.state.mix.SM;
    if (!mix) throw new Error('Kanal SM fehlt');
    mix.r = 0;
    if (!t.ensureAudio()) throw new Error('Audio-Kontext fehlt');
    if (!t.smpPcm[args.pad]) throw new Error(`Pad ${args.pad} ist leer`);
    p.setNow(0.001);
    t.applyMixAll();
    p.setNow(0);
    t.smpPlay(args.pad, 0.1);
    return await renderStereo(p);
  } finally {
    p.close();
  }
}

/** Leert alle Patterns und stellt einen neutralen Ausgangszustand her (wie mixlib.clearAll). */
function isolate(t: LegacyHooks): void {
  for (const pat of Object.values(t.state.patterns)) {
    for (const v of t.VOICES) row(pat, v.id).fill(0);
    pat.notes.BA.fill(null);
    pat.notes.LD.fill(null);
    for (const r of pat.smp) r.fill(0);
    pat.sub = {};
  }
  t.state.mode = 'pattern';
  t.state.cur = 'A';
  const a = t.state.patterns.A;
  if (!a) throw new Error('Pattern A fehlt');
  t.state.pat = a;
  t.state.tempo = 120;
}

function hits(t: LegacyHooks, steps: Record<string, number[]>): void {
  const a = t.state.patterns.A;
  if (!a) throw new Error('Pattern A fehlt');
  for (const [id, list] of Object.entries(steps)) for (const s of list) row(a, id)[s] = 1;
}

const mixOf = (t: LegacyHooks, id: string) => {
  const ch = t.state.mix[id];
  if (!ch) throw new Error(`Kanal ${id} fehlt`);
  return ch;
};

interface MixCase {
  seconds: number;
  setup: (t: LegacyHooks) => void;
  events?: { at: number; run: (t: LegacyHooks) => void }[];
}

const MIX: Record<string, MixCase> = {
  // Startzustand der App: Hip-Hop-Pattern A mit Bass, Lead und Sampler, Tempo 90, Swing
  demo: { seconds: 4, setup: () => undefined },
  base: {
    seconds: 1.9,
    setup: (t) => {
      isolate(t);
      hits(t, { BD: [0], SD: [4] });
    },
  },
  mute: {
    seconds: 1.9,
    setup: (t) => {
      isolate(t);
      hits(t, { BD: [0], SD: [4] });
      mixOf(t, 'BD').m = true;
      mixOf(t, 'SD').m = true;
    },
  },
  solo: {
    seconds: 1.9,
    setup: (t) => {
      isolate(t);
      hits(t, { BD: [0], SD: [4] });
      mixOf(t, 'SD').s = true;
    },
  },
  faderHalf: {
    seconds: 1,
    setup: (t) => {
      isolate(t);
      hits(t, { BD: [0] });
      mixOf(t, 'BD').v = 0.4;
      mixOf(t, 'BD').r = 0;
    },
  },
  // dichtes Muster bei Master 100 %: reizt Kompressor, Soft-Clip, Limiter und Sicherheits-Shaper aus
  master1: {
    seconds: 2,
    setup: (t) => {
      isolate(t);
      t.state.master = 1;
      ['BD', 'SD', 'CH', 'CP', 'OH', 'CY'].forEach((id, k) => {
        const steps: number[] = [];
        for (let i = k % 2; i < 16; i += 2) steps.push(i);
        hits(t, { [id]: steps });
      });
    },
  },
  reverbDry: {
    seconds: 2.4,
    setup: (t) => {
      isolate(t);
      hits(t, { SD: [0] });
      mixOf(t, 'SD').r = 0;
    },
  },
  reverbWet: {
    seconds: 2.4,
    setup: (t) => {
      isolate(t);
      hits(t, { SD: [0] });
      mixOf(t, 'SD').r = 1;
      t.state.fx.ret = 1;
      t.state.fx.size = 0.8;
    },
  },
  djLowpass: {
    seconds: 1.4,
    setup: (t) => {
      isolate(t);
      hits(t, { CH: [0, 2, 4], CY: [0] });
      t.state.fx.dj = 0.05;
    },
  },
  djHighpass: {
    seconds: 1.4,
    setup: (t) => {
      isolate(t);
      hits(t, { BD: [0] });
      t.state.fx.dj = 0.95;
    },
  },
  panRight: {
    seconds: 1,
    setup: (t) => {
      isolate(t);
      hits(t, { BD: [0] });
      mixOf(t, 'BD').p = 1;
      mixOf(t, 'BD').r = 0;
    },
  },
  stutter: {
    seconds: 1.7,
    setup: (t) => {
      isolate(t);
      hits(t, { BD: [0] });
      mixOf(t, 'BD').r = 0;
    },
    events: [
      {
        at: 0.1,
        run: (t) => {
          t.stutterOn(0.125);
        },
      },
    ],
  },
};

MIX.stutterRelease = {
  seconds: 2.4,
  setup: (t) => {
    isolate(t);
    hits(t, { BD: [0], SD: [12] });
    mixOf(t, 'BD').r = 0;
  },
  events: [
    {
      at: 0.1,
      run: (t) => {
        t.stutterOn(0.125);
      },
    },
    {
      at: 0.8,
      run: (t) => {
        t.stutterOff();
      },
    },
  ],
};

export const MIX_NAMES = Object.keys(MIX);

/** Spielt ein Pattern über den Legacy-Scheduler (pump im 25-ms-Takt) und rendert den Master. */
export async function mixScenario(args: { name: string; seed?: number }): Promise<StereoPrint> {
  const sc = MIX[args.name];
  if (!sc) throw new Error(`Unbekanntes Mix-Szenario ${args.name}`);
  const p = loadLegacy({ seed: args.seed ?? 1, audio: { seconds: sc.seconds } });
  try {
    const { t } = p;
    sc.setup(t);
    if (!t.ensureAudio()) throw new Error('Audio-Kontext fehlt');
    await t.prerenderAll();
    assertPrerendered(t);
    p.setNow(0.001);
    t.applyMixAll();
    p.setNow(0);
    t.begin();
    const pending = [...(sc.events ?? [])];
    for (let now = 0; now < sc.seconds; now += 0.025) {
      p.setNow(now);
      while (pending[0] && pending[0].at <= now) pending.shift()?.run(t);
      t.pump();
    }
    return await renderStereo(p);
  } finally {
    p.close();
  }
}

export interface BenchResult {
  renderMs: number;
  /** pro Sekunde Musik erzeugte Audio-Knoten (deterministisch) */
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

/** Port von legacy/tests/bench.cjs: 7 s spielen, 8 s rendern, Knoten zählen. */
export async function bench(args: { load: 'demo' | 'worst' }): Promise<BenchResult> {
  const counts: Record<string, number> = Object.fromEntries(COUNTED.map((n) => [n, 0]));
  const p = loadLegacy({
    audio: { seconds: 8 },
    instrument: (c) => {
      const target = c as unknown as Record<string, (...a: unknown[]) => unknown>;
      for (const name of COUNTED) {
        const orig = target[name]!.bind(c);
        target[name] = (...a: unknown[]) => {
          counts[name] = (counts[name] ?? 0) + 1;
          return orig(...a);
        };
      }
    },
  });
  try {
    const { t } = p;
    if (args.load === 'worst') {
      // jede laute Drum-Spur mit Sub-Roll auf jedem zweiten Step
      const a = t.state.patterns.A!;
      for (const id of ['BD', 'SD', 'CH', 'OH', 'CP', 'CY']) {
        const sub: Record<number, number[]> = {};
        for (let s = 0; s < 16; s += 2) {
          sub[s] = Array.from({ length: 16 }, (_, k) => (k % 2 === 0 ? 1 : 0));
        }
        a.sub[id] = sub;
      }
    }
    t.state.tempo = 120;
    t.state.mode = 'pattern';
    t.state.cur = 'A';
    t.state.pat = t.state.patterns.A!;
    if (!t.ensureAudio()) throw new Error('Audio-Kontext fehlt');
    await t.prerenderAll();
    assertPrerendered(t);
    for (const k of Object.keys(counts)) counts[k] = 0;
    t.begin();
    for (let now = 0; now < 7; now += 0.025) {
      p.setNow(now);
      t.pump();
    }
    const t0 = performance.now();
    await p.ctx().startRendering();
    assertClean(p);
    const renderMs = Math.round(performance.now() - t0);
    const total = Object.values(counts).reduce((x, y) => x + y, 0);
    return { renderMs, nodesPerSecond: Math.round(total / 7), counts };
  } finally {
    p.close();
  }
}

export const SCENARIOS: Record<string, (args: never) => Promise<unknown>> = {
  smoke,
  drumVariants,
  synthPreset,
  samplerPad,
  mixScenario,
  bench,
};
