import type { State } from './types.ts';

/*
 * Klangcharakter: „Warm“ (analoger Klang) und „Tape“ (Bandmaschine). Beide Felder fehlen im
 * Zustand, solange sie aus sind, damit alte Speicherstände bytegleich bleiben.
 */

export interface Tone {
  warm: boolean;
  tape: number;
}

export const toneOf = (s: Pick<State, 'warm' | 'tape'>): Tone => ({
  warm: s.warm === true,
  tape: s.tape ?? 0,
});

export const sameTone = (a: Tone, b: Tone): boolean => a.warm === b.warm && a.tape === b.tape;

export function setWarm(s: State, on: boolean): State {
  const next = { ...s };
  if (on) next.warm = true;
  else delete next.warm;
  return next;
}

export function setTape(s: State, v: number): State {
  const next = { ...s };
  const x = Math.min(1, Math.max(0, v));
  if (x > 0) next.tape = x;
  else delete next.tape;
  return next;
}
