import { describe, expect, it } from 'vitest';
import { compareFingerprints, fingerprint, SILENCE_DB, type Tolerance } from './fingerprint.ts';

const SR = 44100;
const sine = (hz: number, seconds: number, amp = 1) =>
  Float32Array.from(
    { length: Math.round(SR * seconds) },
    (_, i) => amp * Math.sin((2 * Math.PI * hz * i) / SR),
  );
const TOL: Tolerance = {
  peakRel: 0.05,
  rmsFloorDb: -50,
  rmsMeanDb: 0.5,
  rmsMaxDb: 3,
  centroidRel: 0.03,
};

describe('fingerprint', () => {
  it('misst Spitze, RMS in 10-ms-Fenstern und Schwerpunkt eines Sinus', () => {
    const fp = fingerprint(sine(1000, 0.5, 0.5), SR);
    expect(fp.length).toBe(22050);
    expect(fp.rmsDb).toHaveLength(50);
    expect(fp.peak).toBeCloseTo(0.5, 3);
    // RMS eines Sinus = Amplitude / √2 → 20·log10(0,5/√2) ≈ −9,03 dB
    for (const db of fp.rmsDb) expect(db).toBeCloseTo(-9.03, 1);
    expect(Math.abs(fp.centroidHz - 1000) / 1000).toBeLessThan(0.02);
    expect(fp.nonFinite).toBe(0);
  });

  it('kennzeichnet Stille und zählt NaN/Infinity', () => {
    const x = new Float32Array(882);
    x[500] = Number.NaN;
    x[600] = Number.POSITIVE_INFINITY;
    const fp = fingerprint(x, SR);
    expect(fp.nonFinite).toBe(2);
    expect(fp.rmsDb[0]).toBe(SILENCE_DB);
    expect(fp.centroidHz).toBe(0);
  });

  it('kommt mit Puffern kürzer als ein FFT-Rahmen zurecht', () => {
    const fp = fingerprint(sine(2000, 0.01), SR);
    expect(fp.centroidHz).toBeGreaterThan(1500);
    expect(fp.centroidHz).toBeLessThan(2500);
  });
});

describe('compareFingerprints', () => {
  const base = fingerprint(sine(440, 0.3, 0.8), SR);

  it('gleicher Klang passt', () => {
    expect(compareFingerprints(base, fingerprint(sine(440, 0.3, 0.8), SR), TOL)).toEqual([]);
  });

  it('meldet lauteren Klang (Spitze und RMS)', () => {
    const problems = compareFingerprints(base, fingerprint(sine(440, 0.3, 1), SR), TOL);
    expect(problems.some((p) => p.startsWith('Spitze'))).toBe(true);
    expect(problems.some((p) => p.startsWith('RMS'))).toBe(true);
  });

  it('meldet einen Halbton höheren Klang (Schwerpunkt)', () => {
    const up = fingerprint(sine(440 * 2 ** (1 / 12), 0.3, 0.8), SR);
    expect(compareFingerprints(base, up, TOL).some((p) => p.startsWith('Schwerpunkt'))).toBe(true);
  });

  it('meldet abweichende Länge statt abzustürzen', () => {
    const problems = compareFingerprints(base, fingerprint(sine(440, 0.5, 0.8), SR), TOL);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/^Länge/);
  });

  it('meldet ungültige Samples', () => {
    const bad = { ...base, nonFinite: 3 };
    expect(compareFingerprints(base, bad, TOL)[0]).toMatch(/ungültige Samples/);
  });
});
