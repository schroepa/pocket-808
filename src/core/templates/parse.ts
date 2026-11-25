import { PARTS, ROWS, STEPS, VOICE_IDS } from '../constants.ts';
import { blankPattern } from '../defaults.ts';
import type { Note, OptMap, Pattern, StepOpt, StepRow, SubMap } from '../types.ts';
import type { TemplatePattern } from './types.ts';

/*
 * Kurzschreibweise der Vorlagen.
 *
 * Drum-Zeile, 16 Zeichen:
 *   .  Pause            x  voll             o  mittel (Velocity 0,7)   -  Ghost (0,4)
 *   ?  Ghost, kommt nur in der Hälfte der Durchläufe (Chance 50 %)
 *   %  voll, Chance 60 %
 *   r  Roll ×2          t  Roll ×3 (Triole) R  Roll ×4
 *   1  nur im ersten von zwei Durchläufen   2  nur im zweiten   4  nur im vierten von vier
 *
 * Noten: 'Step:Stufe:Länge', dahinter beliebig a (Akzent), s (Slide) und ein Akkord:
 *   T Dreiklang, S Vierklang (Septakkord), P Quinte, O Oktave. Beispiel: '0:0:4a 8:3:2sT'
 */

interface Mark {
  opt?: StepOpt;
  /** Sub-Steps eines Rolls (Positionen 0..15) */
  sub?: readonly number[];
}

const MARKS: Readonly<Record<string, Mark>> = {
  x: {},
  o: { opt: { v: 0.7 } },
  '-': { opt: { v: 0.4 } },
  '?': { opt: { v: 0.5, p: 0.5 } },
  '%': { opt: { p: 0.6 } },
  r: { sub: [0, 8] },
  t: { sub: [0, 5, 11] },
  R: { sub: [0, 4, 8, 12] },
  '1': { opt: { c: '1:2' } },
  '2': { opt: { c: '2:2' } },
  '4': { opt: { c: '4:4' } },
};

const CHORDS = { T: 'tri', S: 'sev', P: 'pow', O: 'oct' } as const;
const NOTE = /^(\d+):(\d+):(\d+)([asTSPO]*)$/;

/** Fehler einer Vorlage (falsche Länge, unbekanntes Zeichen, doppelte Note): fällt im Test auf */
export class TemplateError extends Error {}

function parseNotes(text: string): (Note | null)[] {
  const row = new Array<Note | null>(STEPS).fill(null);
  for (const token of text.split(' ').filter(Boolean)) {
    const m = NOTE.exec(token);
    if (!m) throw new TemplateError(`Note unlesbar: ${token}`);
    const step = Number(m[1]);
    const d = Number(m[2]);
    const l = Number(m[3]);
    const flags = m[4] ?? '';
    if (step >= STEPS || d >= ROWS || l < 1 || step + l > STEPS)
      throw new TemplateError(`Note außerhalb des Takts oder der Stufen: ${token}`);
    if (row[step]) throw new TemplateError(`zwei Noten auf Step ${String(step)}`);
    const note: Note = { d, l };
    if (flags.includes('a')) note.a = true;
    if (flags.includes('s')) note.s = true;
    for (const [mark, ch] of Object.entries(CHORDS)) if (flags.includes(mark)) note.ch = ch;
    row[step] = note;
  }
  return row;
}

/** Kurzschreibweise → Pattern (Sampler-Spuren leer) */
export function parseTemplatePattern(t: TemplatePattern): Pattern {
  const p = blankPattern();
  const sub: SubMap = {};
  const opt: OptMap = {};
  for (const id of VOICE_IDS) {
    const line = t.d[id];
    if (line === undefined) continue;
    if (line.length !== STEPS) throw new TemplateError(`${id}: ${String(line.length)} Zeichen`);
    const row: StepRow = p[id];
    for (let step = 0; step < STEPS; step++) {
      const ch = line.charAt(step);
      if (ch === '.') continue;
      const mark = MARKS[ch];
      if (!mark) throw new TemplateError(`${id}: unbekanntes Zeichen ${ch}`);
      row[step] = 1;
      if (mark.opt) (opt[id] ??= {})[step] = { ...mark.opt };
      if (mark.sub) {
        const hits = mark.sub;
        (sub[id] ??= {})[step] = Array.from({ length: 16 }, (_, k) => (hits.includes(k) ? 1 : 0));
      }
    }
  }
  p.sub = sub;
  if (Object.keys(opt).length) p.opt = opt;
  for (const part of PARTS) {
    const text = t.n?.[part];
    if (text) p.notes[part] = parseNotes(text);
  }
  return p;
}
