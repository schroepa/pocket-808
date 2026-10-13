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
  lowCentroidRel: 0.03,
};
/** reproduzierbares weißes Rauschen (LCG) */
const noise = (n: number, amp: number) => {
  let s = 12345;
  return Float32Array.from({ length: n }, () => {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0;
    return amp * ((s / 4294967296) * 2 - 1);
  });
};
const mix = (a: Float32Array, b: Float32Array) => a.map((x, i) => x + (b[i] ?? 0));

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

  it('erkennt einen Halbton im Ton unter lautem Rauschen (Schwerpunkt unter 2 kHz)', () => {
    // Rauschen dominiert das Gesamtspektrum (Schwerpunkt mehrere kHz), unter 2 kHz dominiert der Ton
    const n = Math.round(SR * 0.3);
    const a = fingerprint(mix(sine(200, 0.3, 0.3), noise(n, 0.4)), SR);
    const b = fingerprint(mix(sine(200 * 2 ** (1 / 12), 0.3, 0.3), noise(n, 0.4)), SR);
    expect(a.centroidHz).toBeGreaterThan(3000);
    const problems = compareFingerprints(a, b, TOL);
    expect(problems.some((p) => p.startsWith('Schwerpunkt <2 kHz'))).toBe(true);
    // der Gesamt-Schwerpunkt allein würde es nicht sehen
    expect(Math.abs(a.centroidHz - b.centroidHz) / a.centroidHz).toBeLessThan(0.03);
  });

  it('meldet einen zusätzlichen Treffer in einer sonst stillen Stelle', () => {
    const n = Math.round(SR * 1);
    const hit = (at: number) =>
      Float32Array.from({ length: n }, (_, i) => {
        const t = i / SR - at;
        return t >= 0 ? 0.8 * Math.sin(2 * Math.PI * 80 * t) * Math.exp(-t * 30) : 0;
      });
    const one = hit(0.05);
    const two = mix(one, hit(0.9));
    const problems = compareFingerprints(fingerprint(one, SR), fingerprint(two, SR), TOL);
    expect(problems.some((p) => p.startsWith('RMS'))).toBe(true);
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
