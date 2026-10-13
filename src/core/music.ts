import { NOTE_NAMES, PART_BASE, SCALES } from './constants.ts';
import type { NoteRow, Part } from './types.ts';
import { must } from './util.ts';

export interface Tonality {
  key: number;
  scale: number;
}

function scaleStep(degree: number, scale: number): { octave: number; semis: number } {
  const sc = must(SCALES[scale], `Skala ${scale}`).s;
  const n = sc.length;
  return { octave: Math.floor(degree / n), semis: must(sc[((degree % n) + n) % n], 'Skalenstufe') };
}

/** Skalenstufe → MIDI-Note (Grundton je Part, Tonart, Oktav-Regler). */
export function degreeToMidi(part: Part, degree: number, t: Tonality, octave: number): number {
  const { octave: o, semis } = scaleStep(degree, t.scale);
  return 12 * (PART_BASE[part] + octave + 1) + t.key + semis + 12 * o;
}

export function degreeName(degree: number, t: Tonality): string {
  return must(NOTE_NAMES[(t.key + scaleStep(degree, t.scale).semis) % 12], 'Notenname');
}

/** Klingende Länge einer Note in Steps: bis zur nächsten Note, höchstens l und bis Taktende. */
export function effectiveLength(row: NoteRow, step: number): number {
  const n = row[step];
  if (!n) return 0;
  for (let k = 1; k < n.l && step + k < 16; k++) if (row[step + k]) return k;
  return Math.min(n.l, 16 - step);
}
