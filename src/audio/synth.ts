import { WAVES } from '../core/constants.ts';
import { attackTime, decayTime, releaseTime } from '../core/envelope.ts';
import type { SynthPatch } from '../core/types.ts';
import { must } from '../core/util.ts';
import { holdAt } from './params.ts';

/* SH-101-Stimme wie Legacy synthNote: zwei verstimmte Oszillatoren + Sub, Tiefpass mit Filter-ADSR,
   Amp-ADSR. Pro Part monophon: eine neue Note schneidet die vorige kurz ab. */

export interface SynthVoice {
  amp: GainNode;
  oscs: OscillatorNode[];
  t0: number;
  until: number;
}

/** Amp-ADSR: linearer Attack, exponentieller Decay/Release */
function schedAmp(
  P: AudioParam,
  t: number,
  A: number,
  D: number,
  S0: number,
  R: number,
  end: number,
): void {
  const S = Math.max(S0, 0.0001);
  const ta = t + A;
  const td = ta + D;
  let lv: number;
  P.setValueAtTime(0.0001, t);
  if (end <= ta) {
    lv = Math.max(0.0001, (end - t) / A);
    P.linearRampToValueAtTime(lv, end);
  } else {
    P.linearRampToValueAtTime(1, ta);
    if (end <= td) {
      lv = Math.max(0.0001, Math.pow(S, (end - ta) / D));
      P.exponentialRampToValueAtTime(lv, end);
    } else {
      lv = S;
      P.exponentialRampToValueAtTime(S, td);
    }
  }
  P.setValueAtTime(lv, end);
  P.exponentialRampToValueAtTime(0.0001, end + R);
}

/** Filter-ADSR: Cutoff wandert von base zu peak (Env-Menge), exponentiell in Hz */
function schedFlt(
  P: AudioParam,
  t: number,
  A: number,
  D: number,
  S: number,
  R: number,
  end: number,
  base: number,
  peak: number,
): void {
  const r = peak / base;
  const fe = (e: number): number => base * Math.pow(r, e);
  const ta = t + A;
  const td = ta + D;
  let e: number;
  P.setValueAtTime(base, t);
  if (end <= ta) {
    e = (end - t) / A;
    P.exponentialRampToValueAtTime(fe(e), end);
  } else {
    P.exponentialRampToValueAtTime(peak, ta);
    if (end <= td) {
      e = 1 - (1 - S) * ((end - ta) / D);
      P.exponentialRampToValueAtTime(fe(e), end);
    } else {
      e = S;
      P.exponentialRampToValueAtTime(fe(S), td);
    }
  }
  P.setValueAtTime(fe(e), end);
  P.exponentialRampToValueAtTime(base, end + R);
}

/** Monophon: vorige Note kurz abschneiden. */
function killVoice(v: SynthVoice, t: number): void {
  try {
    const tt = Math.max(t, v.t0 + 0.001);
    holdAt(v.amp.gain, tt);
    v.amp.gain.linearRampToValueAtTime(0, tt + 0.006);
    for (const o of v.oscs) {
      try {
        o.stop(tt + 0.01);
      } catch {
        /* schon gestoppt */
      }
    }
  } catch {
    /* Knoten schon abgebaut */
  }
}

export function synthNote(o: {
  ctx: BaseAudioContext;
  dest: AudioNode;
  patch: SynthPatch;
  midi: number;
  time: number;
  duration: number;
  previous: SynthVoice | undefined;
}): SynthVoice {
  const { ctx, patch: p, time: t } = o;
  const f = 440 * Math.pow(2, (o.midi - 69) / 12);
  const end = t + Math.max(0.04, o.duration);
  const fR = releaseTime(p.fr);
  const aR = releaseTime(p.ar);
  const base = 70 * Math.pow(2, p.cut * 7.2);
  const peak = Math.min(base * Math.pow(2, p.env * 4.5), 16000);
  if (o.previous && o.previous.until > t) killVoice(o.previous, t);
  const gn = (v: number): GainNode => {
    const g = ctx.createGain();
    g.gain.value = v;
    return g;
  };
  const osc = (type: OscillatorType, fr: number, dur: number): OscillatorNode => {
    const n = ctx.createOscillator();
    n.type = type;
    n.frequency.setValueAtTime(fr, t);
    n.start(t);
    n.stop(t + dur);
    return n;
  };
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = base;
  lp.Q.value = 0.5 + p.res * 14;
  schedFlt(lp.frequency, t, attackTime(p.fa), decayTime(p.fd), p.fs, fR, end, base, peak);
  const amp = ctx.createGain();
  schedAmp(amp.gain, t, attackTime(p.aa), decayTime(p.ad), p.as, aR, end);
  const life = end - t + Math.max(fR, aR) + 0.05;
  const cents = p.det * 28;
  const mix = gn(0.4);
  const oscs: OscillatorNode[] = [];
  const wave = must(WAVES[p.wave], `Wellenform ${p.wave}`)[1];
  for (const sg of [1, -1]) {
    const n = osc(wave, f, life);
    n.detune.value = sg * cents;
    n.connect(mix);
    oscs.push(n);
  }
  mix.connect(lp);
  lp.connect(amp);
  if (p.sub > 0.01) {
    const n = osc('sine', f / 2, life);
    const sg = gn(p.sub * 0.8);
    n.connect(sg);
    sg.connect(amp);
    oscs.push(n);
  }
  const out = gn(0.6);
  amp.connect(out);
  out.connect(o.dest);
  return { amp, oscs, t0: t, until: t + life };
}
