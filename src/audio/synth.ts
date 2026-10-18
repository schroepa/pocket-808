import { WAVES } from '../core/constants.ts';
import { attackTime, decayTime, releaseTime } from '../core/envelope.ts';
import type { SynthPatch } from '../core/types.ts';
import { must } from '../core/util.ts';
import { holdAt } from './params.ts';

/* SH-101-Stimme wie Legacy synthNote: zwei verstimmte Oszillatoren + Sub, Tiefpass mit Filter-ADSR,
   Amp-ADSR. Pro Part monophon: eine neue Note schneidet die vorige kurz ab.
   Etappe 6a: Akkorde paraphon (ein Filter, eine Amp, je Ton zwei Oszillatoren, Sub nur für den
   Grundton), Akzent (lauter, mehr Env) und Slide (gleitet von der klingenden Vorgängerin). */

/** Akzent: Pegel-Faktor und zusätzliche Env-Menge */
export const ACCENT_GAIN = 1.35;
export const ACCENT_ENV = 0.25;
/** Slide: Gleitzeit in Sekunden */
export const SLIDE_TIME = 0.06;

export interface SynthVoice {
  amp: GainNode;
  oscs: OscillatorNode[];
  /** Frequenzen der Töne (Grundton zuerst), Ausgangspunkt für einen Slide */
  freqs: number[];
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

/** Slide: ohne neuen Attack, die Amp steht sofort auf Sustain und klingt danach aus. */
function schedAmpSlide(P: AudioParam, t: number, S0: number, R: number, end: number): void {
  const S = Math.max(S0, 0.0001);
  P.setValueAtTime(S, t);
  P.setValueAtTime(S, end);
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

/** Slide: der Cutoff steht auf dem Sustain-Wert der Hüllkurve und kehrt im Release zurück. */
function schedFltSlide(
  P: AudioParam,
  t: number,
  S: number,
  R: number,
  end: number,
  base: number,
  peak: number,
): void {
  const v = base * Math.pow(peak / base, S);
  P.setValueAtTime(v, t);
  P.setValueAtTime(v, end);
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
  /** Töne der Note, Grundton zuerst (ein Ton oder ein Akkord) */
  midis: readonly number[];
  time: number;
  duration: number;
  previous: SynthVoice | undefined;
  accent?: boolean;
  slide?: boolean;
}): SynthVoice {
  const { ctx, patch: p, time: t } = o;
  const freqs = o.midis.map((m) => 440 * Math.pow(2, (m - 69) / 12));
  const end = t + Math.max(0.04, o.duration);
  const fR = releaseTime(p.fr);
  const aR = releaseTime(p.ar);
  const base = 70 * Math.pow(2, p.cut * 7.2);
  const env = p.env + (o.accent ? ACCENT_ENV : 0);
  const peak = Math.min(base * Math.pow(2, env * 4.5), 16000);
  const sounding = o.previous && o.previous.until > t ? o.previous : undefined;
  if (sounding) killVoice(sounding, t);
  // Slide nur, wenn die Vorgängerin noch klingt; Akkordtöne gleiten vom passenden Ton
  const from = o.slide && sounding ? sounding.freqs : undefined;
  const gn = (v: number): GainNode => {
    const g = ctx.createGain();
    g.gain.value = v;
    return g;
  };
  const osc = (type: OscillatorType, fr: number, dur: number, start?: number): OscillatorNode => {
    const n = ctx.createOscillator();
    n.type = type;
    if (start === undefined) n.frequency.setValueAtTime(fr, t);
    else {
      n.frequency.setValueAtTime(start, t);
      n.frequency.exponentialRampToValueAtTime(fr, t + SLIDE_TIME);
    }
    n.start(t);
    n.stop(t + dur);
    return n;
  };
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = base;
  lp.Q.value = 0.5 + p.res * 14;
  const amp = ctx.createGain();
  if (from) {
    schedFltSlide(lp.frequency, t, p.fs, fR, end, base, peak);
    schedAmpSlide(amp.gain, t, p.as, aR, end);
  } else {
    schedFlt(lp.frequency, t, attackTime(p.fa), decayTime(p.fd), p.fs, fR, end, base, peak);
    schedAmp(amp.gain, t, attackTime(p.aa), decayTime(p.ad), p.as, aR, end);
  }
  const life = end - t + Math.max(fR, aR) + 0.05;
  const cents = p.det * 28;
  // Akkord: Mischpegel × 1/√n, damit er nicht lauter als ein Einzelton wird
  const mix = gn(0.4 / Math.sqrt(freqs.length));
  const oscs: OscillatorNode[] = [];
  const wave = must(WAVES[p.wave], `Wellenform ${p.wave}`)[1];
  const fromOf = (i: number): number | undefined =>
    from ? from[Math.min(i, from.length - 1)] : undefined;
  freqs.forEach((f, i) => {
    for (const sg of [1, -1]) {
      const n = osc(wave, f, life, fromOf(i));
      n.detune.value = sg * cents;
      n.connect(mix);
      oscs.push(n);
    }
  });
  mix.connect(lp);
  lp.connect(amp);
  const f = must(freqs[0], 'Grundton');
  if (p.sub > 0.01) {
    const start = fromOf(0);
    const n = osc('sine', f / 2, life, start === undefined ? undefined : start / 2);
    const sg = gn(p.sub * 0.8);
    n.connect(sg);
    sg.connect(amp);
    oscs.push(n);
  }
  const out = gn(0.6 * (o.accent ? ACCENT_GAIN : 1));
  amp.connect(out);
  out.connect(o.dest);
  return { amp, oscs, freqs, t0: t, until: t + life };
}
