import { describe, expect, it } from 'vitest';
import { baseState } from './defaults.ts';
import {
  clearNotes,
  clearPattern,
  clearTrack,
  copyPattern,
  pastePattern,
  patternHasContent,
  placeNote,
  selectSlot,
  setSubSteps,
  SUB_PATTERNS,
  subStepsOf,
  toggleDrumStep,
  toggleSampleStep,
  toggleSubStep,
} from './pattern.ts';
import { deepFreeze } from './test-utils.ts';
import type { State } from './types.ts';
import { restoreSnapshot, snapshot } from './undo.ts';

const fresh = (): State => deepFreeze(baseState());
const roll = () => SUB_PATTERNS.roll();

describe('Drum-Steps', () => {
  it('schaltet einen Step um, setzt das Preset zurück und teilt Unverändertes', () => {
    const s0 = deepFreeze({ ...baseState(), preset: 'House' });
    const s = toggleDrumStep(s0, 'SD', 4);
    expect(s.patterns.A.SD[4]).toBe(1);
    expect(s.preset).toBeNull();
    expect(s.patterns.A.BD).toBe(s0.patterns.A.BD);
    expect(s.patterns.B).toBe(s0.patterns.B);
    expect(toggleDrumStep(s, 'SD', 4).patterns.A.SD[4]).toBe(0);
  });
  it('löscht vorhandene Sub-Steps statt umzuschalten und lässt das Preset stehen', () => {
    const s0 = deepFreeze({ ...setSubSteps(fresh(), 'BD', 2, roll()), preset: 'Trap' });
    const s = toggleDrumStep(s0, 'BD', 2);
    expect(subStepsOf(s.patterns.A, 'BD', 2)).toBeNull();
    expect(s.patterns.A.sub).toEqual({});
    expect(s.patterns.A.BD[2]).toBe(0);
    expect(s.preset).toBe('Trap');
  });
});

describe('Sampler-Steps', () => {
  it('schaltet um und löscht Pad-Sub-Steps', () => {
    const s = toggleSampleStep(fresh(), 3, 7);
    expect(s.patterns.A.smp[3]![7]).toBe(1);
    const withSub = deepFreeze(setSubSteps(s, 'P3', 7, roll()));
    const c = toggleSampleStep(withSub, 3, 7);
    expect(c.patterns.A.smp[3]![7]).toBe(0);
    expect(c.patterns.A.sub).toEqual({});
  });
});

describe('Sub-Steps', () => {
  it('setzen, umschalten, Leerzeile entfernt den Eintrag', () => {
    let s = toggleSubStep(fresh(), 'CH', 0, 3);
    expect(subStepsOf(s.patterns.A, 'CH', 0)?.[3]).toBe(1);
    s = toggleSubStep(deepFreeze(s), 'CH', 0, 3);
    expect(s.patterns.A.sub).toEqual({});
    s = setSubSteps(deepFreeze(setSubSteps(fresh(), 'CH', 1, roll())), 'CH', 5, roll());
    expect(Object.keys(s.patterns.A.sub.CH ?? {})).toEqual(['1', '5']);
    s = setSubSteps(deepFreeze(s), 'CH', 1, SUB_PATTERNS.clear());
    expect(Object.keys(s.patterns.A.sub.CH ?? {})).toEqual(['5']);
    expect(setSubSteps(fresh(), 'CH', 1, SUB_PATTERNS.clear()).patterns.A.sub).toEqual({});
  });
  it('behält die Reihenfolge der Schlüssel wie Legacy (gespeichertes JSON bleibt bytegleich)', () => {
    let s = setSubSteps(fresh(), 'BD', 1, roll());
    s = setSubSteps(deepFreeze(s), 'CH', 2, roll());
    s = setSubSteps(deepFreeze(s), 'BD', 5, roll());
    expect(Object.keys(s.patterns.A.sub)).toEqual(['BD', 'CH']);
    s = setSubSteps(deepFreeze(s), 'BD', 1, SUB_PATTERNS.clear());
    expect(Object.keys(s.patterns.A.sub)).toEqual(['BD', 'CH']);
  });
  it('Vorlagen Roll, ÷2, ÷4, Leeren', () => {
    expect(SUB_PATTERNS.roll().every((x) => x === 1)).toBe(true);
    expect(SUB_PATTERNS.half().filter(Boolean)).toHaveLength(8);
    expect(SUB_PATTERNS.quarter().filter(Boolean)).toHaveLength(4);
    expect(SUB_PATTERNS.clear().some(Boolean)).toBe(false);
  });
});

describe('Noten', () => {
  it('setzt eine Note mit aktueller Länge, Tippen auf klingende Note löscht sie', () => {
    const s0 = deepFreeze({ ...baseState(), part: 'LD' as const, noteLen: 4 as const });
    const s = placeNote(s0, 3, 2);
    expect(s.patterns.A.notes.LD[2]).toEqual({ d: 3, l: 4 });
    expect(placeNote(deepFreeze(s), 3, 4).patterns.A.notes.LD[2]).toBeNull();
    expect(placeNote(deepFreeze(s), 5, 4).patterns.A.notes.LD[4]).toEqual({ d: 5, l: 4 });
    expect(placeNote(deepFreeze(s), 3, 6).patterns.A.notes.LD[6]).toEqual({ d: 3, l: 4 });
  });
});

describe('Noten leeren', () => {
  it('leert nur die Noten des aktuellen Parts und lässt das Preset stehen', () => {
    let s = placeNote(fresh(), 2, 0);
    s = placeNote(deepFreeze({ ...s, part: 'LD' as const }), 4, 3);
    const t = clearNotes(deepFreeze({ ...s, part: 'BA' as const, preset: 'House' }));
    expect(t.patterns.A.notes.BA.every((n) => n === null)).toBe(true);
    expect(t.patterns.A.notes.LD[3]).toEqual({ d: 4, l: 1 });
    expect(t.patterns.A.notes.LD).toBe(s.patterns.A.notes.LD);
    expect(t.preset).toBe('House');
  });
});

describe('Pattern als Ganzes', () => {
  it('leeren, Spur leeren, Slot wählen', () => {
    let s = toggleDrumStep(fresh(), 'BD', 0);
    s = setSubSteps(deepFreeze(s), 'BD', 4, roll());
    s = toggleDrumStep(deepFreeze(s), 'SD', 1);
    const t = clearTrack(deepFreeze({ ...s, sel: 0, preset: 'House' }));
    expect(t.patterns.A.BD.some(Boolean)).toBe(false);
    expect(t.patterns.A.SD[1]).toBe(1);
    expect(t.patterns.A.sub).toEqual({});
    expect(t.preset).toBeNull();
    expect(patternHasContent(clearPattern(deepFreeze(s)).patterns.A)).toBe(false);
    expect(selectSlot(deepFreeze({ ...s, preset: 'House' }), 'C')).toMatchObject({
      cur: 'C',
      preset: null,
    });
  });
  it('kopieren und einfügen ergibt eine unabhängige Kopie', () => {
    const s = deepFreeze(toggleDrumStep(fresh(), 'CY', 9));
    const clip = copyPattern(s);
    const pasted = pastePattern(deepFreeze(selectSlot(s, 'D')), clip);
    expect(pasted.patterns.D).toEqual(s.patterns.A);
    expect(pasted.patterns.D).not.toBe(clip);
  });
  it('erkennt Inhalt in Drums, Noten, Sampler und Sub-Steps', () => {
    const b = fresh();
    expect(patternHasContent(b.patterns.A)).toBe(false);
    expect(patternHasContent(toggleSampleStep(b, 0, 0).patterns.A)).toBe(true);
    expect(patternHasContent(placeNote(b, 0, 0).patterns.A)).toBe(true);
    expect(patternHasContent(setSubSteps(b, 'P0', 0, roll()).patterns.A)).toBe(true);
  });
});

describe('Undo', () => {
  it('stellt Pattern, Slot, Tempo, Swing und Preset wieder her', () => {
    const s0 = deepFreeze({ ...toggleDrumStep(fresh(), 'BD', 0), tempo: 100, preset: 'House' });
    const snap = snapshot(s0);
    const changed = deepFreeze({ ...clearPattern(s0), tempo: 140, swing: 0.9, cur: 'B' as const });
    const back = restoreSnapshot(changed, snap);
    expect(back.cur).toBe('A');
    expect(back.patterns.A).toEqual(s0.patterns.A);
    expect([back.tempo, back.swing, back.preset]).toEqual([100, s0.swing, 'House']);
  });
});
