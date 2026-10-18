import { describe, expect, it } from 'vitest';
import { CHOP_SIZES, distributeSlices, padPitch, setChop, sliceRange } from './chop.ts';
import { baseState } from './defaults.ts';
import { loadState, serialize } from './persist.ts';
import { normalizeOpt, setStepOpt, stepOptOf } from './stepopts.ts';
import type { Pad, State } from './types.ts';

const pad = (o: Partial<Pad> = {}): Pad => ({
  name: 'X',
  start: 0.2,
  end: 0.6,
  tune: 0.5,
  att: 0,
  dec: 1,
  lvl: 0.8,
  rev: false,
  ...o,
});

describe('Chop', () => {
  it('Größen und Setzen/Löschen am Pad', () => {
    expect(CHOP_SIZES).toEqual([2, 4, 8]);
    const s0 = baseState();
    const s = setChop(s0, 1, 4);
    expect(s.smp.pads[1]?.sl).toBe(4);
    expect('sl' in (setChop(s, 1, undefined).smp.pads[1] ?? {})).toBe(false);
    expect(s.smp.pads[0]).toBe(s0.smp.pads[0]);
  });

  it('Slice-Bereiche innerhalb der Griffe; ohne Chop oder ohne k das ganze Pad', () => {
    const first = sliceRange(pad({ sl: 4 }), 0);
    expect(first.start).toBeCloseTo(0.2);
    expect(first.end).toBeCloseTo(0.3);
    const r = sliceRange(pad({ sl: 4 }), 3);
    expect(r.start).toBeCloseTo(0.5);
    expect(r.end).toBeCloseTo(0.6);
    expect(sliceRange(pad({ sl: 2 }), 7).start).toBeCloseTo(0.4); // auf das letzte begrenzt
    expect(sliceRange(pad(), 2)).toEqual({ start: 0.2, end: 0.6 });
    expect(sliceRange(pad({ sl: 8 }), undefined)).toEqual({ start: 0.2, end: 0.6 });
  });

  it('Pitch: Halbtöne zu Tune (1/24 je Halbton)', () => {
    expect(padPitch(0.5, 12)).toBeCloseTo(1);
    expect(padPitch(0.25, -7)).toBeCloseTo(0.25 - 7 / 24);
    expect(padPitch(0.4, undefined)).toBe(0.4);
  });

  it('Verteilen: Slices der Reihe nach auf die gesetzten Steps, Rest der Optionen bleibt', () => {
    let s: State = baseState();
    const p = s.patterns[s.cur];
    const row = Array.from({ length: 16 }, (_, i) => (i % 3 === 0 ? 1 : 0));
    s = {
      ...s,
      patterns: { ...s.patterns, [s.cur]: { ...p, smp: p.smp.map((r, i) => (i === 2 ? row : r)) } },
    };
    s = setStepOpt(s, 'P2', 3, { v: 0.5 });
    s = setChop(s, 2, 4);
    const out = distributeSlices(s, 2);
    const pat = out.patterns[out.cur];
    const ks = [0, 3, 6, 9, 12, 15].map((st) => stepOptOf(pat, 'P2', st).k);
    expect(ks).toEqual([0, 1, 2, 3, 0, 1]);
    expect(stepOptOf(pat, 'P2', 3).v).toBe(0.5);
  });

  it('Verteilen ohne Chop oder ohne Steps ändert nichts', () => {
    const s = baseState();
    expect(distributeSlices(s, 0)).toBe(s);
    const chopped = setChop(s, 5, 2);
    expect(distributeSlices(chopped, 5)).toBe(chopped);
  });
});

describe('Step-Optionen n und k', () => {
  it('normalisiert: ganzzahlig, begrenzt, 0 Halbtöne entfällt', () => {
    expect(normalizeOpt({ n: 0 })).toBeNull();
    expect(normalizeOpt({ n: 3.6, k: 9 })).toEqual({ n: 4, k: 7 });
    expect(normalizeOpt({ n: -40, k: -1 })).toEqual({ n: -12, k: 0 });
  });

  it('Speicher: Rundreise, nur bei Pads, Chop am Pad, kaputte Werte fallen weg, alte Stände schlank', () => {
    expect(JSON.stringify(serialize(baseState()))).not.toMatch(/"sl"|"n":|"k":/);
    let s = setChop(baseState(), 0, 8);
    s = setStepOpt(s, 'P0', 4, { n: -5, k: 6 });
    const back = loadState(JSON.parse(JSON.stringify(serialize(s))), baseState());
    expect(back.smp.pads[0]?.sl).toBe(8);
    expect(back.patterns[back.cur].opt?.P0?.[4]).toEqual({ n: -5, k: 6 });
    const raw = {
      smp: { pads: [{ sl: 3 }, { sl: 4 }] },
      patterns: { A: { opt: { BD: { 0: { n: 2, k: 1 } }, P1: { 2: { n: 'x', k: 2.5 } } } } },
    };
    const bad = loadState(raw, baseState());
    expect('sl' in (bad.smp.pads[0] ?? {})).toBe(false);
    expect(bad.smp.pads[1]?.sl).toBe(4);
    expect(bad.patterns.A.opt?.BD).toBeUndefined();
    expect(bad.patterns.A.opt?.P1?.[2]).toEqual({ k: 3 });
  });
});
