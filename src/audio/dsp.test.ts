import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../core/random.ts';
import {
  delayTime,
  djFilter,
  factorySamples,
  impulseResponse,
  noiseData,
  reverbReturn,
  softClipCurve,
  stutterPeriod,
} from './dsp.ts';

describe('dsp', () => {
  it('Kennlinie: 1024 Punkte, symmetrisch, normiert auf ±1', () => {
    const c = softClipCurve(1.4, true);
    expect(c).toHaveLength(1024);
    expect(c[0]).toBeCloseTo(-1, 6);
    expect(c[1023]).toBeCloseTo(1, 6);
    expect(c[511]! + c[512]!).toBeCloseTo(0, 6);
    expect(softClipCurve(1, false)[1023]).toBeCloseTo(Math.tanh(1), 6);
  });
  it('Rauschen liegt in [-1, 1) und ist reproduzierbar', () => {
    const a = noiseData(1000, mulberry32(3));
    expect(a).toEqual(noiseData(1000, mulberry32(3)));
    for (const x of a) expect(x >= -1 && x < 1).toBe(true);
  });
  it('Impulsantwort: Länge aus Size, Vorverzögerung still, klingt aus', () => {
    const ir = impulseResponse(44100, 0.4, 0.5, mulberry32(1));
    expect(ir).toHaveLength(Math.floor(44100 * (0.3 + 0.4 * 2.2)));
    expect(ir.slice(0, Math.floor(44100 * 0.012)).every((x) => x === 0)).toBe(true);
    expect(Math.abs(ir[ir.length - 1]!)).toBeLessThan(1e-4);
  });
  it('Fabrik-Samples: vier Klänge mit Legacy-Längen', () => {
    const f = factorySamples(mulberry32(1));
    expect(f.map((x) => x.length)).toEqual([19845, 8820, 28665, 26460]);
  });
  it('DJ-Filter: Mitte neutral, links Tiefpass, rechts Hochpass', () => {
    expect(djFilter({ dj: 0.5, djq: 0.2 })).toEqual({ lp: 20000, hp: 10, q: 0.7 });
    const lp = djFilter({ dj: 0, djq: 0 });
    expect(lp.lp).toBeCloseTo(200);
    expect(lp.hp).toBe(10);
    const hp = djFilter({ dj: 1, djq: 1 });
    expect(hp.hp).toBeCloseTo(4000);
    expect(hp.q).toBeCloseTo(9.7);
  });
  it('Return, Delay- und Stutter-Zeiten', () => {
    expect(reverbReturn({ ret: 0.5 })).toBeCloseTo(0.8);
    expect(delayTime(120)).toBeCloseTo(0.375);
    expect(delayTime(20)).toBe(1.9);
    expect(stutterPeriod(120, 0.25)).toBeCloseTo(0.125);
    expect(stutterPeriod(30, 8)).toBe(1.9);
  });
});
