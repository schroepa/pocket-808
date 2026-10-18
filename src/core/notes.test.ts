import { describe, expect, it } from 'vitest';
import { SCALES } from './constants.ts';
import { baseState } from './defaults.ts';
import { chordDegrees, cycleChord, noteMidis, toggleNoteFlag } from './notes.ts';
import { currentPattern, placeNote } from './pattern.ts';
import { loadState, serialize } from './persist.ts';
import type { State } from './types.ts';

const withNote = (s: State = baseState()): State =>
  placeNote({ ...s, part: 'BA', noteLen: 4 }, 2, 4);
const note = (s: State, step = 4) => currentPattern(s).notes.BA[step];

describe('Noten-Attribute', () => {
  it('Akzent und Slide schalten um, auch vom Verlauf der Note aus; leere Zellen tun nichts', () => {
    const s0 = withNote();
    const a = toggleNoteFlag(s0, 'a', 6);
    expect(note(a)).toEqual({ d: 2, l: 4, a: true });
    const b = toggleNoteFlag(a, 's', 4);
    expect(note(b)).toEqual({ d: 2, l: 4, a: true, s: true });
    expect(note(toggleNoteFlag(b, 'a', 4))).toEqual({ d: 2, l: 4, s: true });
    expect(toggleNoteFlag(s0, 'a', 12)).toBe(s0);
  });

  it('Akkord schaltet weiter: kein → tri → sev → pow → oct → kein', () => {
    let s = withNote();
    const seen: unknown[] = [];
    for (let i = 0; i < 5; i++) {
      s = cycleChord(s, 5);
      seen.push(note(s)?.ch);
    }
    expect(seen).toEqual(['tri', 'sev', 'pow', 'oct', undefined]);
    expect(note(s)).toEqual({ d: 2, l: 4 });
    expect(cycleChord(s, 0)).toBe(s);
  });

  it('Akkord-Stufen; Oktave folgt der Skalenlänge', () => {
    const moll = [0, 2, 3, 5, 7, 8, 10];
    expect(chordDegrees(1, undefined, moll)).toEqual([1]);
    expect(chordDegrees(1, 'tri', moll)).toEqual([1, 3, 5]);
    expect(chordDegrees(1, 'sev', moll)).toEqual([1, 3, 5, 7]);
    expect(chordDegrees(1, 'pow', moll)).toEqual([1, 5]);
    expect(chordDegrees(1, 'oct', [0, 3, 5, 7, 10])).toEqual([1, 6]);
  });

  it('Pentatonik: Akkordtöne nach Halbtönen (Terz, Quinte, Septime), nicht nach Stufen', () => {
    const iv = (scaleName: string, ch: 'tri' | 'sev' | 'pow', d = 0) => {
      const s = { ...baseState(), key: 0, scale: SCALES.findIndex((x) => x.name === scaleName) };
      const m = noteMidis('BA', { d, l: 1, ch }, s);
      return m.map((x) => x - (m[0] ?? 0));
    };
    expect(iv('Moll-Pentatonik', 'tri')).toEqual([0, 3, 7]);
    expect(iv('Moll-Pentatonik', 'pow')).toEqual([0, 7]);
    expect(iv('Moll-Pentatonik', 'sev')).toEqual([0, 3, 7, 10]);
    expect(iv('Dur-Pentatonik', 'tri')).toEqual([0, 4, 7]);
    expect(iv('Moll-Pentatonik', 'pow', 1)).toEqual([0, 7]); // Es → B statt großer Sexte
    expect(iv('Moll', 'tri', 1)).toEqual([0, 3, 6]); // leitereigen vermindert
  });

  it('noteMidis: Moll-Dreiklang auf dem Grundton A', () => {
    const s = { ...baseState(), key: 9, scale: SCALES.findIndex((x) => x.name === 'Moll') };
    const m = noteMidis('BA', { d: 0, l: 1, ch: 'tri' }, s);
    expect(m.map((x) => x - (m[0] ?? 0))).toEqual([0, 3, 7]);
  });

  it('Speicherformat: Rundreise, kaputte Werte fallen weg, alte Noten bleiben schlank', () => {
    const s = cycleChord(toggleNoteFlag(toggleNoteFlag(withNote(), 'a', 4), 's', 4), 4);
    const back = loadState(JSON.parse(JSON.stringify(serialize(s))), baseState());
    expect(back.patterns.A.notes.BA[4]).toEqual({ d: 2, l: 4, a: true, s: true, ch: 'tri' });
    const raw = {
      patterns: {
        A: {
          notes: { BA: [{ d: 1, l: 2, a: 1, s: 'x', ch: 'big' }, ...Array<null>(15).fill(null)] },
        },
      },
    };
    expect(loadState(raw, baseState()).patterns.A.notes.BA[0]).toEqual({ d: 1, l: 2 });
  });

  it('Neusetzen einer Note entfernt die Attribute', () => {
    const s = toggleNoteFlag(withNote(), 'a', 4);
    const again = placeNote(placeNote(s, 2, 4), 2, 4);
    expect(note(again)).toEqual({ d: 2, l: 4 });
  });
});
