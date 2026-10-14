import { SMP_RATE } from '../core/constants.ts';
import type { Rng } from '../core/random.ts';
import type { Fx } from '../core/types.ts';

/*
 * Reine Klangberechnung ohne Audio-Kontext. Ausdrücke und Rechenreihenfolge entsprechen Legacy,
 * damit die Ergebnisse bitgleich sind (tests/reference/next-dsp.test.ts).
 */

/** Weiche Sättigungskennlinie (Legacy mkCurve). */
export function softClipCurve(k: number, norm: boolean): Float32Array {
  const n = 1024;
  const c = new Float32Array(n);
  const d = norm ? Math.tanh(k) : 1;
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / (n - 1) - 1;
    c[i] = Math.tanh(k * x) / d;
  }
  return c;
}

export function noiseData(length: number, rnd: Rng): Float32Array {
  const d = new Float32Array(length);
  for (let i = 0; i < length; i++) d[i] = rnd() * 2 - 1;
  return d;
}

/** Impulsantwort: Rauschen mit exponentiellem Abfall, Höhen dämpfen sich mit der Zeit (Legacy buildIR). */
export function impulseResponse(
  sampleRate: number,
  size: number,
  damp: number,
  rnd: Rng,
): Float32Array {
  const len = 0.3 + size * 2.2;
  const n = Math.floor(sampleRate * len);
  const pre = Math.floor(sampleRate * 0.012);
  const d = new Float32Array(n);
  const a0 = 0.06 + 0.9 * Math.pow(1 - damp, 2);
  let y = 0;
  for (let i = pre; i < n; i++) {
    const x = (i - pre) / (n - pre);
    const a = Math.max(0.03, a0 * (1 - 0.7 * x));
    y += (rnd() * 2 - 1 - y) * a;
    d[i] = y * Math.pow(1 - x, 2.6);
  }
  return d;
}

/** einfacher Tiefpass erster Ordnung, in place */
function lowpass(a: Float32Array, c: number): Float32Array {
  let y = 0;
  for (const [i, x] of a.entries()) {
    y += (x - y) * c;
    a[i] = y;
  }
  return a;
}

/** Fabrik-Samples (Legacy FACTORY): Stab, Zap, Riser, Bell. Nur Riser verbraucht Zufall. */
export function factorySamples(rnd: Rng): Float32Array[] {
  const stab = (): Float32Array => {
    const n = Math.trunc(SMP_RATE * 0.9);
    const a = new Float32Array(n);
    const fr = [220, 261.63, 329.63, 392];
    for (let i = 0; i < n; i++) {
      const t = i / SMP_RATE;
      let v = 0;
      fr.forEach((f, k) => {
        const q = f * (1 + 0.003 * (k - 1.5));
        v += 2 * ((q * t) % 1) - 1;
      });
      a[i] = Math.tanh(v * 0.4) * Math.exp(-t * 4.5) * (1 - Math.exp(-t * 500));
    }
    return lowpass(a, 0.3);
  };
  const zap = (): Float32Array => {
    const n = Math.trunc(SMP_RATE * 0.4);
    const a = new Float32Array(n);
    let ph = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SMP_RATE;
      ph += (2 * Math.PI * (90 + 1700 * Math.exp(-t * 14))) / SMP_RATE;
      a[i] = Math.sin(ph) * Math.exp(-t * 7);
    }
    return a;
  };
  const riser = (): Float32Array => {
    const n = Math.trunc(SMP_RATE * 1.3);
    const a = new Float32Array(n);
    let y = 0;
    for (let i = 0; i < n; i++) {
      const t = i / n;
      y += (rnd() * 2 - 1 - y) * (0.02 + 0.85 * t * t);
      a[i] = y * Math.pow(t, 1.4) * 2.2;
    }
    return a;
  };
  const bell = (): Float32Array => {
    const n = Math.trunc(SMP_RATE * 1.2);
    const a = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const t = i / SMP_RATE;
      const e = Math.exp(-t * 5);
      a[i] = Math.sin(2 * Math.PI * 440 * t + 3 * e * Math.sin(2 * Math.PI * 616 * t)) * e;
    }
    return a;
  };
  return [stab(), zap(), riser(), bell()];
}

/** DJ-Filter: Mitte = beide offen, links Tiefpass, rechts Hochpass (Legacy applyFx). */
export function djFilter(fx: Pick<Fx, 'dj' | 'djq'>): { lp: number; hp: number; q: number } {
  const d = fx.dj - 0.5;
  const x = Math.abs(d) * 2;
  const q = Math.abs(d) > 0.001 ? 0.7 + fx.djq * 9 : 0.7;
  const lp = d < 0 ? 18000 * Math.pow(200 / 18000, x) : 20000;
  const hp = d > 0 ? 20 * Math.pow(4000 / 20, x) : 10;
  return { lp, hp, q };
}

export const reverbReturn = (fx: Pick<Fx, 'ret'>): number => fx.ret * 1.6;
/** punktierte Achtel, tempo-synchron */
export const delayTime = (tempo: number): number => Math.min(1.9, (3 * 60) / tempo / 4);
export const stutterPeriod = (tempo: number, fraction: number): number =>
  Math.min(1.9, (60 / tempo) * fraction);
