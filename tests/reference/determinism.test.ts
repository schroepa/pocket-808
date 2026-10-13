import { describe, it } from 'vitest';
import type { Fingerprint } from '../support/fingerprint.ts';
import type { StereoPrint } from './legacy/scenarios.ts';
import { runLegacy } from './run.ts';

type Prints = Record<string, Fingerprint>;

// Referenzen dürfen nur vom Klang einer Stimme abhängen, nicht davon, was vorher gerendert wurde.
describe.concurrent('Determinismus der Referenzen', () => {
  for (const voice of ['SD', 'CP', 'RS'] as const) {
    it(`${voice}: Render-Reihenfolge ändert den Klang nicht`, async ({ expect }) => {
      const [alone, after] = await Promise.all([
        runLegacy<Prints>('drumVariants', { voice, variants: { tune1: { tune: 1 } } }),
        runLegacy<Prints>('drumVariants', {
          voice,
          variants: { default: {}, decay0: { decay: 0 }, tune1: { tune: 1 } },
        }),
      ]);
      expect(after.tune1).toEqual(alone.tune1);
    });
  }

  it('Mix-Szenario mit Reverb ist in zwei Prozessen identisch', async ({ expect }) => {
    const [a, b] = await Promise.all([
      runLegacy<StereoPrint>('mixScenario', { name: 'reverbWet' }),
      runLegacy<StereoPrint>('mixScenario', { name: 'reverbWet' }),
    ]);
    expect(b).toEqual(a);
  });
});
