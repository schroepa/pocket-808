import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { PRESETS } from './constants.ts';
import { baseState } from './defaults.ts';
import {
  clearPattern,
  clearTrack,
  currentPattern,
  pastePattern,
  setSubSteps,
  toggleDrumStep,
  toggleSampleStep,
  toggleSubStep,
} from './pattern.ts';
import { loadState, serialize } from './persist.ts';
import { applyPreset } from './presets.ts';
import {
  condPasses,
  drumLockVariants,
  hasLock,
  setStepOpt,
  STEP_CONDS,
  stepIsOn,
  stepOptOf,
  velocityGain,
} from './stepopts.ts';
import { deepFreeze } from './test-utils.ts';
import type { State, StepCond } from './types.ts';

const on = (s: State, voice: 'BD' | 'SD', step: number): State =>
  currentPattern(s)[voice][step] ? s : toggleDrumStep(s, voice, step);

describe('Step-Optionen', () => {
  it('Standard: Velocity 1, Chance 1, Immer; ohne Optionen kein opt-Feld', () => {
    const s = baseState();
    expect(stepOptOf(currentPattern(s), 'BD', 0)).toEqual({ v: 1, p: 1, c: 'all' });
    expect('opt' in currentPattern(s)).toBe(false);
  });

  it('setzen, begrenzen, nur Abweichungen speichern; Standard entfernt den Eintrag', () => {
    const s0 = deepFreeze(baseState());
    const s1 = setStepOpt(s0, 'BD', 4, { v: 0.5, c: '1:2' });
    expect(currentPattern(s1).opt).toEqual({ BD: { 4: { v: 0.5, c: '1:2' } } });
    const s2 = setStepOpt(s1, 'BD', 4, { p: 1.7, v: -1 });
    expect(stepOptOf(currentPattern(s2), 'BD', 4)).toEqual({ v: 0, p: 1, c: '1:2' });
    expect(currentPattern(s2).opt?.BD?.[4]).toEqual({ v: 0, c: '1:2' });
    const s3 = setStepOpt(s2, 'BD', 4, { v: 1, c: 'all' });
    expect('opt' in currentPattern(s3)).toBe(false);
    expect(setStepOpt(s0, 'BD', 4, { v: 1 })).toBe(s0);
  });

  it('andere Stimmen und Pads bleiben getrennt', () => {
    const s = setStepOpt(setStepOpt(baseState(), 'P2', 0, { p: 0.5 }), 'SD', 1, { v: 0.3 });
    expect(currentPattern(s).opt).toEqual({ P2: { 0: { p: 0.5 } }, SD: { 1: { v: 0.3 } } });
    const t = setStepOpt(s, 'P2', 0, {});
    expect(currentPattern(t).opt).toEqual({ SD: { 1: { v: 0.3 } } });
  });

  it.each<[StepCond, number[]]>([
    ['all', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]],
    ['1:2', [1, 3, 5, 7, 9, 11]],
    ['2:2', [2, 4, 6, 8, 10, 12]],
    ['1:3', [1, 4, 7, 10]],
    ['2:3', [2, 5, 8, 11]],
    ['3:3', [3, 6, 9, 12]],
    ['1:4', [1, 5, 9]],
    ['2:4', [2, 6, 10]],
    ['3:4', [3, 7, 11]],
    ['4:4', [4, 8, 12]],
    ['first', [1]],
    ['notFirst', [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]],
  ])('Bedingung %s spielt in den Durchläufen %j', (c, plays) => {
    const n = Array.from({ length: 12 }, (_, i) => i + 1);
    expect(n.filter((k) => condPasses(c, k))).toEqual(plays);
  });

  it('Bedingungen mit Beschriftungen, Velocity als Pegel v²', () => {
    expect(STEP_CONDS.map((x) => x.value)).toEqual([
      'all',
      '1:2',
      '2:2',
      '1:3',
      '2:3',
      '3:3',
      '1:4',
      '2:4',
      '3:4',
      '4:4',
      'first',
      'notFirst',
      'fill',
      'notFill',
    ]);
    expect(STEP_CONDS[0]?.label).toBe('Immer');
    expect(STEP_CONDS.at(-3)?.label).toBe('Nicht erster');
    expect(velocityGain(0.5)).toBe(0.25);
  });
});

describe('Step-Optionen in den Pattern-Befehlen', () => {
  it('Step aus entfernt seine Optionen (Drums und Pads)', () => {
    const s = setStepOpt(on(baseState(), 'BD', 2), 'BD', 2, { v: 0.4 });
    expect('opt' in currentPattern(toggleDrumStep(s, 'BD', 2))).toBe(false);
    const p0 = toggleSampleStep(baseState(), 1, 3);
    const p1 = setStepOpt(p0, 'P1', 3, { p: 0.2 });
    expect('opt' in currentPattern(toggleSampleStep(p1, 1, 3))).toBe(false);
  });

  it('Einschalten lässt fremde Optionen stehen', () => {
    const s = setStepOpt(on(baseState(), 'BD', 2), 'BD', 2, { v: 0.4 });
    expect(currentPattern(toggleDrumStep(s, 'BD', 5)).opt).toEqual({ BD: { 2: { v: 0.4 } } });
  });

  it('Spur leeren entfernt die Optionen der Stimme, Pattern leeren alles', () => {
    let s = setStepOpt(on(baseState(), 'BD', 2), 'BD', 2, { v: 0.4 });
    s = setStepOpt(on(s, 'SD', 4), 'SD', 4, { v: 0.6 });
    const t = clearTrack({ ...s, sel: 0 });
    expect(currentPattern(t).opt).toEqual({ SD: { 4: { v: 0.6 } } });
    expect('opt' in currentPattern(clearPattern(s))).toBe(false);
  });

  it('Vorlage: Drum-Optionen weg, Pad-Optionen bleiben; Einfügen nimmt sie mit', () => {
    let s = setStepOpt(on(baseState(), 'BD', 0), 'BD', 0, { v: 0.4 });
    s = setStepOpt(toggleSampleStep(s, 0, 0), 'P0', 0, { p: 0.5 });
    const preset = PRESETS[0];
    if (!preset) throw new Error('Vorlage');
    expect(currentPattern(applyPreset(s, preset)).opt).toEqual({ P0: { 0: { p: 0.5 } } });
    const onlyDrums = setStepOpt(s, 'P0', 0, {});
    expect('opt' in currentPattern(applyPreset(onlyDrums, preset))).toBe(false);
    const pasted = pastePattern({ ...baseState(), cur: 'C' }, currentPattern(s));
    expect(currentPattern(pasted).opt).toEqual(currentPattern(s).opt);
  });
});

describe('Step-Optionen im Speicherformat', () => {
  it('Rundreise über serialize/loadState', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            key: fc.constantFrom('BD' as const, 'CH' as const, 'P0' as const, 'P7' as const),
            step: fc.integer({ min: 0, max: 15 }),
            v: fc.option(fc.double({ min: 0, max: 1, noNaN: true }), { nil: undefined }),
            p: fc.option(fc.double({ min: 0, max: 1, noNaN: true }), { nil: undefined }),
            c: fc.option(fc.constantFrom(...STEP_CONDS.map((x) => x.value)), { nil: undefined }),
          }),
          { maxLength: 8 },
        ),
        (edits) => {
          let s = baseState();
          for (const e of edits) {
            s = setStepOpt(s, e.key, e.step, {
              ...(e.v === undefined ? {} : { v: e.v }),
              ...(e.p === undefined ? {} : { p: e.p }),
              ...(e.c === undefined ? {} : { c: e.c }),
            });
          }
          const back = loadState(JSON.parse(JSON.stringify(serialize(s))), baseState());
          expect(back).toEqual(s);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('kaputte Einträge fallen still weg', () => {
    const raw = {
      patterns: {
        A: {
          opt: {
            XX: { 0: { v: 0.5 } },
            BD: { 0: { v: 0.5, c: 'egal', p: 'x' }, 16: { v: 0.2 }, 3: 'x', 4: { v: 1 } },
            P9: { 0: { v: 0.1 } },
            SD: 5,
          },
        },
      },
    };
    expect(loadState(raw, baseState()).patterns.A.opt).toEqual({ BD: { 0: { v: 0.5 } } });
    const none = { patterns: { A: { opt: { BD: { 0: { c: 'all' } } } } } };
    expect('opt' in loadState(none, baseState()).patterns.A).toBe(false);
  });

  it('fehlendes opt übernimmt das vorhandene (wie sub)', () => {
    const base = setStepOpt(baseState(), 'BD', 0, { v: 0.5 });
    expect(loadState({ patterns: { A: { BD: 'x...' } } }, base).patterns.A.opt).toEqual({
      BD: { 0: { v: 0.5 } },
    });
  });
});

describe('stepIsOn', () => {
  it('Drums, Pads und Sub-Steps', () => {
    let s = toggleDrumStep(baseState(), 'SD', 3);
    s = toggleSampleStep(s, 2, 7);
    const p = currentPattern(s);
    expect(stepIsOn(p, 'SD', 3)).toBe(true);
    expect(stepIsOn(p, 'SD', 4)).toBe(false);
    expect(stepIsOn(p, 'P2', 7)).toBe(true);
    expect(stepIsOn(p, 'P2', 6)).toBe(false);
    expect(stepIsOn({ ...p, sub: { BD: { 9: Array<0 | 1>(16).fill(1) } } }, 'BD', 9)).toBe(true);
  });
});

describe('Sub-Steps leeren entfernt die Optionen eines ausgeschalteten Steps', () => {
  it('Drum: Leeren und letzter Sub-Step', () => {
    const empty = Array<0 | 1>(16).fill(0);
    let s = toggleSubStep(baseState(), 'BD', 3, 0);
    s = setStepOpt(s, 'BD', 3, { v: 0.35, c: '1:2' });
    expect('opt' in currentPattern(setSubSteps(s, 'BD', 3, empty))).toBe(false);
    expect('opt' in currentPattern(toggleSubStep(s, 'BD', 3, 0))).toBe(false);
    // Step selbst an: Optionen bleiben
    const on = setStepOpt(
      toggleDrumStep(toggleSubStep(baseState(), 'BD', 5, 0), 'BD', 5),
      'BD',
      5,
      {
        v: 0.5,
      },
    );
    expect(currentPattern(on).BD[5]).toBe(0);
    const keep = setStepOpt(toggleDrumStep(baseState(), 'BD', 6), 'BD', 6, { v: 0.5 });
    expect(currentPattern(setSubSteps(keep, 'BD', 6, empty)).opt).toEqual({
      BD: { 6: { v: 0.5 } },
    });
  });
  it('Pad', () => {
    let s = toggleSubStep(baseState(), 'P1', 2, 4);
    s = setStepOpt(s, 'P1', 2, { p: 0.5 });
    expect('opt' in currentPattern(setSubSteps(s, 'P1', 2, Array<0 | 1>(16).fill(0)))).toBe(false);
  });
});

describe('Fill und Parameter-Locks', () => {
  it('Fill-Bedingungen', () => {
    expect(condPasses('fill', 1)).toBe(false);
    expect(condPasses('fill', 1, true)).toBe(true);
    expect(condPasses('notFill', 3)).toBe(true);
    expect(condPasses('notFill', 3, true)).toBe(false);
    expect(condPasses('1:2', 1, true)).toBe(true);
    expect(STEP_CONDS.slice(-2).map((x) => x.label)).toEqual(['Fill', 'Nicht Fill']);
  });

  it('Locks bleiben gespeichert, auch bei jedem Wert; begrenzt; einzeln entfernbar', () => {
    const s = setStepOpt(baseState(), 'BD', 2, { t: 1.4, d: 0.5 });
    expect(currentPattern(s).opt?.BD?.[2]).toEqual({ t: 1, d: 0.5 });
    expect(hasLock(stepOptOf(currentPattern(s), 'BD', 2))).toBe(true);
    expect(hasLock(stepOptOf(currentPattern(s), 'BD', 3))).toBe(false);
    const t = setStepOpt(s, 'BD', 2, { t: undefined, d: undefined });
    expect('opt' in currentPattern(t)).toBe(false);
    const u = setStepOpt(setStepOpt(s, 'BD', 2, { v: 0.5 }), 'BD', 2, {
      t: undefined,
      d: undefined,
    });
    expect(currentPattern(u).opt?.BD?.[2]).toEqual({ v: 0.5 });
  });

  it('Speicherformat: Locks lesen, Start nur bei Pads', () => {
    const raw = {
      patterns: {
        A: {
          opt: {
            BD: { 0: { t: 0.2, d: 2, s: 0.5 }, 1: { t: 'x' } },
            P3: { 4: { s: 0.25, t: -1 }, 5: { c: 'fill' } },
          },
        },
      },
    };
    expect(loadState(raw, baseState()).patterns.A.opt).toEqual({
      BD: { 0: { t: 0.2, d: 1 } },
      P3: { 4: { s: 0.25, t: 0 }, 5: { c: 'fill' } },
    });
  });
});

describe('drumLockVariants', () => {
  it('sammelt gelockte Drum-Varianten aller Patterns, Pads zählen nicht', () => {
    let s = setStepOpt(baseState(), 'BD', 0, { t: 0.234 });
    s = setStepOpt(s, 'SD', 1, { d: 0.7 });
    s = setStepOpt(s, 'P0', 1, { t: 0.1 });
    s = setStepOpt({ ...s, cur: 'B' }, 'BD', 3, { t: 0.234, v: 0.5 });
    s = setStepOpt(s, 'CH', 2, { v: 0.5 });
    expect(drumLockVariants(s)).toEqual([
      `BD|0.23|${String(s.params.BD.decay)}`,
      `SD|${String(s.params.SD.tune)}|0.7`,
    ]);
  });
});
