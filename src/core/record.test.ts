import { describe, expect, it } from 'vitest';
import { baseState } from './defaults.ts';
import { currentPattern } from './pattern.ts';
import { recordHit } from './record.ts';
import { setStepOpt, stepOptOf } from './stepopts.ts';
import type { State } from './types.ts';

const empty = (): State => {
  const s = baseState();
  const p = s.patterns[s.cur];
  const zero = (r: readonly (0 | 1)[]) => r.map(() => 0 as const);
  const q = {
    ...p,
    BD: zero(p.BD),
    SD: zero(p.SD),
    smp: p.smp.map(zero),
    notes: { BA: p.notes.BA.map(() => null), LD: p.notes.LD.map(() => null) },
  };
  return { ...s, patterns: { ...s.patterns, [s.cur]: q } };
};

describe('recordHit', () => {
  it('Drum: setzt den Step im angegebenen Slot, der Rest bleibt', () => {
    const s = empty();
    const out = recordHit(s, { kind: 'drum', voice: 'SD', step: 5, slot: 'C' });
    expect(out.patterns.C.SD[5]).toBe(1);
    expect(out.patterns.A).toBe(s.patterns.A);
    expect(out.cur).toBe(s.cur);
  });

  it('Overdub löscht nie: ein schon gesetzter Step bleibt unverändert', () => {
    const s = empty();
    const once = recordHit(s, { kind: 'drum', voice: 'BD', step: 3, slot: 'A' });
    const twice = recordHit(once, { kind: 'drum', voice: 'BD', step: 3, slot: 'A' });
    expect(twice).toBe(once);
    expect(currentPattern(twice).BD[3]).toBe(1);
  });

  it('Drum mit Sub-Steps und Optionen: Sub-Steps zählen als gesetzt, nichts wird verändert', () => {
    let s = empty();
    s = recordHit(s, { kind: 'drum', voice: 'SD', step: 2, slot: 'A' });
    s = setStepOpt(s, 'SD', 2, { v: 0.4 });
    const again = recordHit(s, { kind: 'drum', voice: 'SD', step: 2, slot: 'A' });
    expect(again).toBe(s);
    expect(stepOptOf(currentPattern(again), 'SD', 2).v).toBe(0.4);
  });

  it('Pad: setzt den Step mit Halbtönen als Pitch; ein schon gesetzter Step bleibt unverändert', () => {
    const s = empty();
    const a = recordHit(s, { kind: 'pad', pad: 2, step: 7, slot: 'A', semis: 5 });
    expect(currentPattern(a).smp[2]?.[7]).toBe(1);
    expect(stepOptOf(currentPattern(a), 'P2', 7).n).toBe(5);
    expect(recordHit(a, { kind: 'pad', pad: 2, step: 7, slot: 'A', semis: 0 })).toBe(a);
    expect(recordHit(a, { kind: 'pad', pad: 2, step: 7, slot: 'A', semis: 9 })).toBe(a);
    const plain = recordHit(s, { kind: 'pad', pad: 0, step: 1, slot: 'A', semis: 0 });
    expect(stepOptOf(currentPattern(plain), 'P0', 1).n).toBeUndefined();
  });

  it('Note: Stufe und Länge am Step des Slots, gleiche Stufe an derselben Stelle bleibt', () => {
    const s = empty();
    const a = recordHit(s, { kind: 'note', part: 'LD', degree: 4, step: 6, slot: 'B', length: 2 });
    expect(a.patterns.B.notes.LD[6]).toEqual({ d: 4, l: 2 });
    expect(a.part).toBe(s.part);
    expect(a.noteLen).toBe(s.noteLen);
    const again = recordHit(a, {
      kind: 'note',
      part: 'LD',
      degree: 4,
      step: 6,
      slot: 'B',
      length: 2,
    });
    expect(again).toBe(a);
    const inTail = recordHit(a, {
      kind: 'note',
      part: 'LD',
      degree: 4,
      step: 7,
      slot: 'B',
      length: 1,
    });
    expect(inTail).toBe(a); // klingt dort schon aus der Note davor
    const other = recordHit(a, {
      kind: 'note',
      part: 'LD',
      degree: 1,
      step: 6,
      slot: 'B',
      length: 1,
    });
    // eine andere Stufe auf einem Step, an dem schon eine Note beginnt, ändert nichts (Overdub)
    expect(other).toBe(a);
    const free = recordHit(a, {
      kind: 'note',
      part: 'LD',
      degree: 1,
      step: 10,
      slot: 'B',
      length: 1,
    });
    expect(free.patterns.B.notes.LD[10]).toEqual({ d: 1, l: 1 });
  });
});
