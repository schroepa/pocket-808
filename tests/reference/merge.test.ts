import { describe, expect, it } from 'vitest';
import { SAMPLE_STORE, SAVES } from './fixtures/saves.ts';
import { readGolden } from './golden.ts';
import { loadLegacy } from './legacy/harness.ts';

const plain = (v: unknown): unknown => JSON.parse(JSON.stringify(v));

describe('Referenz: Laden von Speicherständen (merge)', () => {
  for (const [name, raw] of Object.entries(SAVES)) {
    it(name, () => {
      const p = loadLegacy({ storage: raw === null ? {} : { 'pocket808.v1': raw } });
      try {
        expect(p.errors).toEqual([]);
        const state = plain(p.t.serial());
        expect(state).toEqual(readGolden(`merge/${name}`, state));
      } finally {
        p.close();
      }
    });
  }

  it('Rundlauf: gespeicherter Stand lädt identisch', () => {
    const first = loadLegacy({ storage: { 'pocket808.v1': SAVES.subUndSampler ?? '' } });
    const saved = JSON.stringify(first.t.serial());
    first.close();
    const second = loadLegacy({ storage: { 'pocket808.v1': saved } });
    try {
      expect(JSON.stringify(second.t.serial())).toBe(saved);
    } finally {
      second.close();
    }
  });

  it('Sample-Speicher', () => {
    const p = loadLegacy({ storage: { 'pocket808.smp.v1': SAMPLE_STORE } });
    try {
      expect(p.errors).toEqual([]);
      const state = p.t.serial() as { smp: { pads: { name: string }[] } };
      const actual = {
        padNames: state.smp.pads.map((pad) => pad.name),
        padLengths: p.t.smpPcm.map((pcm) => pcm?.length ?? null),
        pad5: Array.from(p.t.smpPcm[5] ?? []).map((x) => Math.round(x * 1e4) / 1e4),
        drumBD: Array.from(p.t.drumPcm.BD ?? []).map((x) => Math.round(x * 1e4) / 1e4),
        drumKeys: Object.keys(p.t.drumPcm).sort(),
        drumNames: Object.fromEntries(Object.entries(p.t.drumName)),
      };
      expect(actual).toEqual(readGolden('merge/sample-speicher', actual));
    } finally {
      p.close();
    }
  });
});
