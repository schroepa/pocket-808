import { describe, expect, it } from 'vitest';
import { bootState } from '../../src/core/boot.ts';
import { SAMPLE_STORE } from './fixtures/saves.ts';
import { readGolden } from './golden.ts';

const round = (xs: Iterable<number>) => Array.from(xs).map((x) => Math.round(x * 1e4) / 1e4);
// Längen der Legacy-Fabrik-Samples: Stab 0,9 s, Zap 0,4 s, Riser 1,3 s, Bell 1,2 s bei 22,05 kHz
const FACTORY_PCM = [19845, 8820, 28665, 26460]
  .map((n): Float32Array | null => new Float32Array(n))
  .concat([null, null, null, null]);

describe('core Sample-Speicher = Legacy', () => {
  it('Referenz sample-speicher', () => {
    const r = bootState(null, SAMPLE_STORE, FACTORY_PCM);
    const actual = {
      padNames: r.state.smp.pads.map((p) => p.name),
      padLengths: r.pads.map((p) => p?.length ?? null),
      pad5: round(r.pads[5] ?? []),
      drumBD: round(r.drums.BD?.pcm ?? []),
      drumKeys: Object.keys(r.drums).sort(),
      drumNames: Object.fromEntries(Object.entries(r.drums).map(([k, v]) => [k, v.name])),
    };
    expect(actual).toEqual(readGolden<typeof actual>('merge/sample-speicher', actual));
  });
});
