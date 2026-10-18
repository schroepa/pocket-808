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

/** Halbton-Ziele der Akkordtöne über dem Grundton (x,5 = kleine oder große Terz bzw. Septime) */
const CHORD_TARGETS: Readonly<Record<Exclude<ChordKind, 'oct'>, readonly number[]>> = {
  tri: [3.5, 7],
  sev: [3.5, 7, 10.5],
  pow: [7],
};

/**
 * Stufen eines Akkords auf Stufe d in der Skala `scale` (Halbtöne je Stufe). Jeder Akkordton ist
 * die Skalenstufe, die dem Halbton-Ziel am nächsten liegt (bei Gleichstand die tiefere). So bleibt
 * der Akkord leitereigen, und in der Pentatonik ist eine Quinte trotzdem eine Quinte.
 */
export function chordDegrees(
  d: number,
  ch: ChordKind | undefined,
  scale: readonly number[],
): number[] {
  const n = scale.length;
  if (!ch) return [d];
  if (ch === 'oct') return [d, d + n];
  const pitch = (k: number): number => (scale[k % n] ?? 0) + 12 * Math.floor(k / n);
  const root = pitch(d);
  return [
    d,
    ...CHORD_TARGETS[ch].map((target) => {
      let best = d + 1;
      for (let k = d + 2; k <= d + 2 * n; k++) {
        if (Math.abs(pitch(k) - root - target) < Math.abs(pitch(best) - root - target)) best = k;
      }
      return best;
    }),
  ];
}

/** MIDI-Töne einer Note (Grundton zuerst) */
export function noteMidis(part: Part, n: Note, s: State): number[] {
  const scale = must(SCALES[s.scale], 'Skala').s;
  return chordDegrees(n.d, n.ch, scale).map((d) => degreeToMidi(part, d, s, s.synth[part].oct));
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
