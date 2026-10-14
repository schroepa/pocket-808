import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { toPcm } from '../../src/core/samples.ts';
import { loadLegacy } from './legacy/harness.ts';

describe('toPcm gleich Legacy', () => {
  it('bitgleich für zufällige Kanäle und Abtastraten', () => {
    const p = loadLegacy({ seed: 1 });
    try {
      fc.assert(
        fc.property(
          fc.constantFrom(8000, 22050, 44100, 48000, 96000),
          fc.integer({ min: 1, max: 2 }),
          fc.integer({ min: 0, max: 30000 }),
          fc.integer(),
          (rate, chs, len, seed) => {
            let a = seed >>> 0;
            const rnd = () => ((a = (a * 1664525 + 1013904223) >>> 0) / 2 ** 32) * 2 - 1;
            const data = Array.from({ length: chs }, () => Float32Array.from({ length: len }, rnd));
            const ab = {
              numberOfChannels: chs,
              length: len,
              sampleRate: rate,
              getChannelData: (c: number) => data[c] ?? new Float32Array(len),
            };
            expect(toPcm(data, rate)).toEqual(p.t.toPcm(ab));
          },
        ),
        { numRuns: 60 },
      );
    } finally {
      p.close();
    }
  });
});
