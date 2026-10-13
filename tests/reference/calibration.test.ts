import { describe, expect, it } from 'vitest';
import { compareFingerprints, type Fingerprint } from '../support/fingerprint.ts';
import type { StereoPrint } from './legacy/scenarios.ts';
import { runLegacy } from './run.ts';
import { TOLERANCE } from './tolerance.ts';

// Standardwerte aus legacy/index.html (DEFAULTS). tuneStep = Tune-Änderung, die die von Tune
// gesteuerte Frequenz um einen Halbton (≈ 6 %) verschiebt:
//   BD: Tonhöhe 38 + 44·Tune Hz, SD: Tonhöhe 150 + 80·Tune Hz, CH: Hochpass 6000 + 3000·Tune Hz.
// Stimmen mit Rauschen (SD) streuen je Zufalls-Seed stark: Legacy startet den Rauschpuffer bei einem
// zufälligen Bruchteil-Versatz, die lineare Interpolation färbt das Rauschen dann unterschiedlich.
// Für sie gilt deshalb nur die Reproduzierbarkeit bei gleichem Seed, nicht die Seed-Toleranz.
const CASES = {
  BD: { tune: 0.5, decay: 0.55, tuneStep: 0.082, noise: false }, // tonal
  SD: { tune: 0.5, decay: 0.45, tuneStep: 0.141, noise: true }, // Ton + Rauschen
  CH: { tune: 0.5, decay: 0.4, tuneStep: 0.149, noise: false }, // metallisch, kurz
} as const;

type Prints = Record<string, Fingerprint>;

describe.concurrent('Kalibrierung der Klang-Toleranzen', () => {
  for (const [voice, d] of Object.entries(CASES)) {
    it(voice, async ({ expect }) => {
      const variants = {
        base: {},
        tuneUp: { tune: d.tune + d.tuneStep },
        decayUp: { decay: d.decay * 1.1 },
      };
      const [a, again, other] = await Promise.all([
        runLegacy<Prints>('drumVariants', { voice, seed: 1, variants }),
        runLegacy<Prints>('drumVariants', { voice, seed: 1, variants: { base: {} } }),
        runLegacy<Prints>('drumVariants', { voice, seed: 2, variants: { base: {} } }),
      ]);
      expect(
        again.base,
        'gleicher Seed in zwei Prozessen ergibt identischen Fingerabdruck',
      ).toEqual(a.base);
      if (!d.noise) {
        expect(
          compareFingerprints(a.base!, other.base!, TOLERANCE),
          'anderer Zufalls-Seed muss toleriert werden',
        ).toEqual([]);
      }
      // über die Klangfarbe, nicht zufällig über die (rauschabhängige) Spitze
      expect(
        compareFingerprints(a.base!, a.tuneUp!, TOLERANCE).some((p) => p.startsWith('Schwerpunkt')),
        'Tune +1 Halbton muss am Schwerpunkt auffallen',
      ).toBe(true);
      expect(
        compareFingerprints(a.base!, a.decayUp!, TOLERANCE).length,
        'Decay +10 % muss auffallen',
      ).toBeGreaterThan(0);
    });
  }
});

describe('Kalibrierung: Synth', () => {
  it('BA Acid einen Halbton höher fällt am Schwerpunkt auf', async () => {
    const [base, up] = await Promise.all([
      runLegacy<StereoPrint>('synthPreset', { part: 'BA', preset: 'Acid', midi: 45 }),
      runLegacy<StereoPrint>('synthPreset', { part: 'BA', preset: 'Acid', midi: 46 }),
    ]);
    expect(
      compareFingerprints(base.L, up.L, TOLERANCE).some((p) => p.startsWith('Schwerpunkt')),
    ).toBe(true);
  });
});
