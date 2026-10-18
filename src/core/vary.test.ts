import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { VOICE_IDS } from './constants.ts';
import { baseState, blankPattern } from './defaults.ts';
import { initialState } from './initial.ts';
import { currentPattern } from './pattern.ts';
import { mulberry32 } from './random.ts';
import { stepOptOf } from './stepopts.ts';
import type { State } from './types.ts';
import { vary } from './vary.ts';

const ROLE = new Set(['BD', 'SD', 'CH', 'OH']);

describe('Würfel (vary)', () => {
  it('ändert nur BD, SD, CH, OH; Noten, Sampler, Sub-Steps bleiben; deterministisch je Seed', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 1e6 }), (seed) => {
        const s0 = initialState();
        const a = vary(s0, mulberry32(seed));
        const b = vary(s0, mulberry32(seed));
        expect(a).toEqual(b);
        const p0 = currentPattern(s0);
        const p1 = currentPattern(a);
        expect(p1.notes).toBe(p0.notes);
        expect(p1.smp).toBe(p0.smp);
        expect(p1.sub).toBe(p0.sub);
        for (const id of VOICE_IDS) if (!ROLE.has(id)) expect(p1[id]).toBe(p0[id]);
        // andere Slots unberührt
        for (const k of ['B', 'C'] as const) expect(a.patterns[k]).toBe(s0.patterns[k]);
      }),
      { numRuns: 80 },
    );
  });

  it('verändert ein gefülltes Pattern über zehn Würfe mindestens einmal', () => {
    const s0 = initialState();
    const changed = Array.from({ length: 10 }, (_, i) => vary(s0, mulberry32(i + 1))).some(
      (s) => JSON.stringify(currentPattern(s)) !== JSON.stringify(currentPattern(s0)),
    );
    expect(changed).toBe(true);
  });

  it('Ghost-Steps bekommen leise Velocity; vorhandene Optionen bleiben', () => {
    let found = false;
    for (let seed = 1; seed < 40 && !found; seed++) {
      const s0 = initialState();
      const s = vary(s0, mulberry32(seed));
      const p0 = currentPattern(s0);
      const p = currentPattern(s);
      for (let st = 0; st < 16; st++) {
        if (p.CH[st] && !p0.CH[st]) {
          expect(stepOptOf(p, 'CH', st).v).toBeCloseTo(0.35);
          found = true;
        }
      }
    }
    expect(found).toBe(true);
  });

  it('leeres Pattern: Grundbeat, dann Variation', () => {
    const s0: State = { ...baseState(), patterns: { ...baseState().patterns, A: blankPattern() } };
    const p = currentPattern(vary(s0, mulberry32(7)));
    for (const st of [0, 4, 8, 12]) expect(p.BD[st]).toBe(1);
    expect(p.SD[4]).toBe(1);
    expect(p.SD[12]).toBe(1);
  });
});

describe('Würfel ohne freien Platz', () => {
  it('voll besetzte Spuren: keine Kandidaten; ein Wurf ohne Änderung liefert denselben Zustand', () => {
    const full = Array<0 | 1>(16).fill(1);
    const s0 = baseState();
    const p = { ...s0.patterns.A, BD: full, SD: full, CH: full, OH: full };
    const s = { ...s0, patterns: { ...s0.patterns, A: p } };
    const results = Array.from({ length: 20 }, (_, i) => vary(s, mulberry32(i + 1)));
    expect(results.some((r) => r === s)).toBe(true);
    // nur das Ausdünnen kann etwas ändern
    for (const r of results) {
      const q = currentPattern(r);
      expect(q.BD).toBe(full);
      expect(q.SD).toBe(full);
      expect(q.OH).toBe(full);
    }
  });
});
