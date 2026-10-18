import { SCALES } from './constants.ts';
import { degreeToMidi } from './music.ts';
import { currentPattern, replacePattern } from './pattern.ts';
import { noteAt } from './synth.ts';
import type { ChordKind, Note, Part, State } from './types.ts';
import { must } from './util.ts';

/** Reihenfolge beim Weiterschalten des Akkords (danach wieder keiner) */
export const CHORDS: readonly ChordKind[] = ['tri', 'sev', 'pow', 'oct'];
export const CHORD_LABELS: Readonly<Record<ChordKind, string>> = {
  tri: 'Dreiklang',
  sev: 'Vierklang',
  pow: 'Quinte',
  oct: 'Oktave',
};
/** Kürzel in der Roll-Zelle */
export const CHORD_MARKS: Readonly<Record<ChordKind, string>> = {
  tri: '3',
  sev: '4',
  pow: '5',
  oct: '8',
};

/** Stufen eines Akkords auf Stufe d (scaleLen: Töne der Skala, für die Oktave) */
export function chordDegrees(d: number, ch: ChordKind | undefined, scaleLen: number): number[] {
  switch (ch) {
    case 'tri':
      return [d, d + 2, d + 4];
    case 'sev':
      return [d, d + 2, d + 4, d + 6];
    case 'pow':
      return [d, d + 4];
    case 'oct':
      return [d, d + scaleLen];
    default:
      return [d];
  }
}

/** MIDI-Töne einer Note (Grundton zuerst) */
export function noteMidis(part: Part, n: Note, s: State): number[] {
  const len = must(SCALES[s.scale], 'Skala').s.length;
  return chordDegrees(n.d, n.ch, len).map((d) => degreeToMidi(part, d, s, s.synth[part].oct));
}

/** Note des aktuellen Parts, die `step` abdeckt, durch fn ersetzen; ohne Note unverändert */
function editNote(s: State, step: number, fn: (n: Note) => Note): State {
  const row = currentPattern(s).notes[s.part];
  const at = noteAt(row, step);
  if (!at) return s;
  const n = must(row[at.start] ?? undefined, 'Note');
  const next = row.map((x, k) => (k === at.start ? fn(n) : x));
  const p = currentPattern(s);
  return replacePattern(s, s.cur, { ...p, notes: { ...p.notes, [s.part]: next } });
}

/** Akzent (a) oder Slide (s) der Note unter `step` umschalten */
export function toggleNoteFlag(s: State, flag: 'a' | 's', step: number): State {
  return editNote(s, step, ({ a, s: slide, ...rest }) => {
    const next: Note = { ...rest };
    if (flag === 'a' ? !a : a) next.a = true;
    if (flag === 's' ? !slide : slide) next.s = true;
    return next;
  });
}

/** Akkord der Note unter `step` weiterschalten: kein → Dreiklang → Vierklang → Quinte → Oktave → kein */
export function cycleChord(s: State, step: number): State {
  return editNote(s, step, (n) => {
    const i = n.ch ? CHORDS.indexOf(n.ch) + 1 : 0;
    const next = { ...n };
    const ch = CHORDS[i];
    if (ch) next.ch = ch;
    else delete next.ch;
    return next;
  });
}
