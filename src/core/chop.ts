import { currentPattern } from './pattern.ts';
import { setStepOpt, stepIsOn } from './stepopts.ts';
import type { Pad, State, SubKey } from './types.ts';
import { must } from './util.ts';

/* Chop (Etappe 7): Ein Pad wird in gleich große Slices zwischen Start und Ende geteilt, statt das
   Sample auf mehrere Pads zu kopieren. Welches Slice ein Step spielt, steht in seinen Optionen (k). */

export const CHOP_SIZES = [2, 4, 8] as const;
export type ChopSize = (typeof CHOP_SIZES)[number];

/** Chop eines Pads setzen; `undefined` schaltet ihn aus (Feld entfällt) */
export function setChop(s: State, i: number, sl: ChopSize | undefined): State {
  const pads = s.smp.pads.map((p, k) => {
    if (k !== i) return p;
    const next = { ...p };
    if (sl) next.sl = sl;
    else delete next.sl;
    return next;
  });
  return { ...s, smp: { ...s.smp, pads } };
}

/** Bereich eines Slices (k über der Slice-Zahl: das letzte); ohne Chop oder ohne k das ganze Pad */
export function sliceRange(p: Pad, k: number | undefined): { start: number; end: number } {
  if (!p.sl || k === undefined) return { start: p.start, end: p.end };
  const i = Math.min(k, p.sl - 1);
  const w = (p.end - p.start) / p.sl;
  return { start: p.start + w * i, end: p.start + w * (i + 1) };
}

/** Tune samt Pitch in Halbtönen (Tune 0..1 überstreicht ±1 Oktave, also 1/24 je Halbton) */
export const padPitch = (tune: number, n: number | undefined): number => tune + (n ?? 0) / 24;

/** Slices der Reihe nach auf die gesetzten Steps des Pads im aktuellen Pattern legen */
export function distributeSlices(s: State, i: number): State {
  const sl = must(s.smp.pads[i], `Pad ${i}`).sl;
  if (!sl) return s;
  const key = `P${i}` as SubKey;
  const pat = currentPattern(s);
  let next = s;
  let k = 0;
  for (let step = 0; step < 16; step++) {
    if (!stepIsOn(pat, key, step)) continue;
    next = setStepOpt(next, key, step, { k: k % sl });
    k++;
  }
  return next;
}
