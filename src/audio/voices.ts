import type { Rng } from '../core/random.ts';
import type { DrumParams, VoiceId } from '../core/types.ts';

/*
 * Die zehn Drum-Stimmen, 1:1 aus Legacy (VOICE_FN). Einzige gewollte Abweichung:
 * Rauschen startet sample-genau (Entscheidung 2026-10-14).
 */

export interface VoiceKit {
  ctx: BaseAudioContext;
  out: AudioNode;
  noise: AudioBuffer;
  kick: Float32Array;
  rnd: Rng;
  /** Legacy ohChoke: die zuletzt gestartete Open Hat, die CH/OH abwürgen */
  choke: { gain: GainNode | null };
}

type Voice = (k: VoiceKit, t: number, p: DrumParams) => void;

const gn = (k: VoiceKit, v: number): GainNode => {
  const g = k.ctx.createGain();
  g.gain.value = v;
  return g;
};
const flt = (k: VoiceKit, type: BiquadFilterType, f: number, q = 0.7): BiquadFilterNode => {
  const b = k.ctx.createBiquadFilter();
  b.type = type;
  b.frequency.value = f;
  b.Q.value = q;
  return b;
};
const env = (g: GainNode, t: number, peak: number, dec: number, atk = 0.001): void => {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + atk);
  g.gain.exponentialRampToValueAtTime(0.0001, t + atk + dec);
};
const osc = (
  k: VoiceKit,
  type: OscillatorType,
  f: number,
  t: number,
  dur: number,
): OscillatorNode => {
  const o = k.ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  o.start(t);
  o.stop(t + dur);
  return o;
};
/** Rauschen ab einem zufälligen, sample-genauen Versatz (Entscheidung 2026-10-14). */
const noise = (k: VoiceKit, t: number, dur: number): AudioBufferSourceNode => {
  const s = k.ctx.createBufferSource();
  s.buffer = k.noise;
  s.loop = true;
  const sr = k.ctx.sampleRate;
  s.start(t, Math.floor(k.rnd() * 1.5 * sr) / sr);
  s.stop(t + dur);
  return s;
};

const tom =
  (base: number): Voice =>
  (k, t, p) => {
    const f = base * (0.72 + p.tune * 0.56);
    const dec = 0.16 + p.decay * 0.5;
    const o = osc(k, 'sine', f * 1.6, t, dec + 0.08);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.05);
    const g = k.ctx.createGain();
    env(g, t, 1, dec, 0.002);
    const out = gn(k, p.level * 0.85);
    o.connect(g);
    g.connect(out);
    out.connect(k.out);
  };

const METAL = [263, 400, 421, 474, 587, 845];
const metal = (
  k: VoiceKit,
  t: number,
  dec: number,
  hp: number,
  level: number,
  kk: number,
): GainNode => {
  const g = k.ctx.createGain();
  env(g, t, 1, dec, 0.0008);
  const h = flt(k, 'highpass', hp, 0.8);
  const out = gn(k, level);
  for (const f of METAL) osc(k, 'square', f * kk, t, dec + 0.06).connect(h);
  h.connect(g);
  g.connect(out);
  return out;
};
const chokeOH = (k: VoiceKit, t: number): void => {
  const c = k.choke.gain;
  if (!c) return;
  c.gain.setValueAtTime(1, t);
  c.gain.exponentialRampToValueAtTime(0.0001, t + 0.025);
  k.choke.gain = null;
};

export const VOICE_FN: Record<VoiceId, Voice> = {
  BD(k, t, p) {
    const f = 38 + p.tune * 44;
    const dec = 0.22 + p.decay * 1.1;
    const o = osc(k, 'sine', f * 3.4, t, dec + 0.08);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.06);
    const g = k.ctx.createGain();
    env(g, t, 1, dec, 0.002);
    const sh = k.ctx.createWaveShaper();
    sh.curve = k.kick as Float32Array<ArrayBuffer>;
    const out = gn(k, p.level * 0.9);
    o.connect(g);
    g.connect(sh);
    sh.connect(out);
    out.connect(k.out);
  },
  SD(k, t, p) {
    const f = 150 + p.tune * 80;
    const out = gn(k, p.level * 0.85);
    for (const [m, a] of [
      [1, 0.7],
      [1.85, 0.35],
    ] as const) {
      const o = osc(k, 'triangle', f * m * 1.25, t, 0.4);
      o.frequency.exponentialRampToValueAtTime(f * m, t + 0.04);
      const g = k.ctx.createGain();
      env(g, t, a, 0.09 + p.decay * 0.08);
      o.connect(g);
      g.connect(out);
    }
    const n = noise(k, t, 0.5);
    const hp = flt(k, 'highpass', 1400);
    const g = k.ctx.createGain();
    env(g, t, 0.7, 0.1 + p.decay * 0.25);
    n.connect(hp);
    hp.connect(g);
    g.connect(out);
    out.connect(k.out);
  },
  LT: tom(98),
  HT: tom(180),
  RS(k, t, p) {
    const kk = 0.85 + p.tune * 0.3;
    const dec = 0.025 + p.decay * 0.05;
    const out = gn(k, p.level * 0.6);
    const bp = flt(k, 'bandpass', 1800 * kk, 1.5);
    const g = k.ctx.createGain();
    env(g, t, 1, dec, 0.0005);
    for (const [ty, f] of [
      ['square', 1670 * kk],
      ['triangle', 480 * kk],
    ] as const) {
      osc(k, ty, f, t, dec + 0.05).connect(bp);
    }
    bp.connect(g);
    g.connect(out);
    const n = noise(k, t, 0.02);
    const hp = flt(k, 'highpass', 3000);
    const g2 = k.ctx.createGain();
    env(g2, t, 0.3, 0.008, 0.0005);
    n.connect(hp);
    hp.connect(g2);
    g2.connect(out);
    out.connect(k.out);
  },
  CP(k, t, p) {
    const tail = 0.12 + p.decay * 0.35;
    const out = gn(k, p.level * 2.6);
    const bp = flt(k, 'bandpass', 900 + p.tune * 700, 1.1);
    const g = k.ctx.createGain();
    g.gain.value = 0.0001;
    const n = noise(k, t, 0.04 + tail + 0.05);
    n.connect(bp);
    bp.connect(g);
    g.connect(out);
    out.connect(k.out);
    for (let i = 0; i < 3; i++) {
      const s = t + i * 0.0105;
      g.gain.setValueAtTime(1, s);
      g.gain.exponentialRampToValueAtTime(0.15, s + 0.009);
    }
    const s3 = t + 0.0315;
    g.gain.setValueAtTime(0.9, s3);
    g.gain.exponentialRampToValueAtTime(0.0001, s3 + tail);
  },
  CB(k, t, p) {
    const kk = 0.88 + p.tune * 0.24;
    const dec = 0.1 + p.decay * 0.5;
    const out = gn(k, p.level * 1.5);
    const bp = flt(k, 'bandpass', 1700 * kk, 0.9);
    const g = k.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(1, t + 0.001);
    g.gain.exponentialRampToValueAtTime(0.28, t + 0.025);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dec + 0.025);
    for (const f of [540, 800]) osc(k, 'square', f * kk, t, dec + 0.08).connect(bp);
    bp.connect(g);
    g.connect(out);
    out.connect(k.out);
  },
  CH(k, t, p) {
    chokeOH(k, t);
    metal(k, t, 0.03 + p.decay * 0.07, 6000 + p.tune * 3000, p.level * 1.3, 1).connect(k.out);
  },
  OH(k, t, p) {
    chokeOH(k, t);
    const out = metal(k, t, 0.18 + p.decay * 0.55, 6000 + p.tune * 3000, p.level * 1.3, 1);
    const c = gn(k, 1);
    out.connect(c);
    c.connect(k.out);
    k.choke.gain = c;
  },
  CY(k, t, p) {
    metal(k, t, 0.7 + p.decay * 1.6, 4500 + p.tune * 2500, p.level * 1.1, 0.8).connect(k.out);
  },
};

/** Länge der vorgerenderten Klänge in Sekunden (Legacy VDUR) */
export const VOICE_DURATION: Record<VoiceId, number> = {
  BD: 1.7,
  SD: 0.7,
  LT: 0.9,
  HT: 0.9,
  RS: 0.25,
  CP: 0.7,
  CB: 0.9,
  CH: 0.3,
  OH: 1.1,
  CY: 2.8,
};
/** Reihenfolge des Vorrenderns: häufige Stimmen zuerst (Legacy RENDER_ORDER) */
export const RENDER_ORDER: readonly VoiceId[] = [
  'BD',
  'SD',
  'CH',
  'OH',
  'CP',
  'LT',
  'HT',
  'RS',
  'CB',
  'CY',
];

export type OfflineFactory = (
  channels: number,
  length: number,
  sampleRate: number,
) => OfflineAudioContext;

/** Eine Drum-Stimme offline vorrendern (Level 1; der Pegel wirkt beim Abspielen). */
export function renderVoice(opts: {
  createOffline: OfflineFactory;
  sampleRate: number;
  voice: VoiceId;
  params: DrumParams;
  noise: AudioBuffer;
  kick: Float32Array;
  rnd: Rng;
}): Promise<AudioBuffer> {
  const { createOffline, sampleRate, voice } = opts;
  const oc = createOffline(1, Math.ceil(sampleRate * VOICE_DURATION[voice]), sampleRate);
  const bus = oc.createGain();
  bus.connect(oc.destination);
  VOICE_FN[voice](
    { ctx: oc, out: bus, noise: opts.noise, kick: opts.kick, rnd: opts.rnd, choke: { gain: null } },
    0,
    { ...opts.params, level: 1 },
  );
  return oc.startRendering();
}
