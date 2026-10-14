import { afterAll, describe, expect, it } from 'vitest';
import { factorySamples, impulseResponse, softClipCurve } from '../../src/audio/dsp.ts';
import { mulberry32, seededRandom } from '../../src/core/random.ts';
import { loadLegacy } from './legacy/harness.ts';

const page = loadLegacy();
const w = page.window as unknown as { Math: Math };

/** Index der ersten Abweichung (-1 = bitgleich); schneller und lesbarer als toEqual auf großen Arrays */
function firstDiff(a: ArrayLike<number>, b: ArrayLike<number>): number {
  if (a.length !== b.length) return Math.min(a.length, b.length);
  for (let i = 0; i < a.length; i++) if (!Object.is(a[i], b[i])) return i;
  return -1;
}

describe('dsp = Legacy (bitgenau)', () => {
  afterAll(() => {
    page.close();
  });
  it('Kennlinie', () => {
    for (const [k, norm] of [
      [1.4, true],
      [1.6, true],
      [1, false],
    ] as const) {
      expect(firstDiff(softClipCurve(k, norm), page.t.mkCurve(k, norm))).toBe(-1);
    }
  });
  it('Impulsantwort', () => {
    for (const [size, damp] of [
      [0.4, 0.5],
      [0.8, 0.1],
      [0, 1],
    ] as const) {
      // die Harness startet den Zufall in buildIR neu (Strom 'ir' zum Seed 1)
      let legacy = new Float32Array(0);
      page.t.buildIR(
        {
          sampleRate: 44100,
          createBuffer: (_c, n) => {
            legacy = new Float32Array(n);
            return { getChannelData: () => legacy };
          },
        },
        size,
        damp,
      );
      expect(firstDiff(impulseResponse(44100, size, damp, seededRandom(1)('ir')), legacy)).toBe(-1);
    }
  });
  it('Fabrik-Samples', () => {
    w.Math.random = mulberry32(5);
    const legacy = page.t.FACTORY.map((f) => (f as unknown as { gen(): Float32Array }).gen());
    const next = factorySamples(mulberry32(5));
    for (let i = 0; i < 4; i++) expect(firstDiff(next[i]!, legacy[i]!), `Sample ${i}`).toBe(-1);
  });
});
