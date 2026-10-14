import { replacePattern } from './pattern.ts';
import type { Pattern, Slot, State } from './types.ts';

/** Ein Schritt Undo (wie Legacy): aktuelles Pattern, Slot, Tempo, Swing, Preset. */
export interface Snapshot {
  pat: Pattern;
  cur: Slot;
  tempo: number;
  swing: number;
  preset: string | null;
}

/** Zustände sind unveränderlich: Der Schnappschuss teilt das Pattern statt es zu kopieren. */
export const snapshot = (s: State): Snapshot => ({
  pat: s.patterns[s.cur],
  cur: s.cur,
  tempo: s.tempo,
  swing: s.swing,
  preset: s.preset,
});

export const restoreSnapshot = (s: State, u: Snapshot): State => ({
  ...replacePattern(s, u.cur, u.pat),
  cur: u.cur,
  tempo: u.tempo,
  swing: u.swing,
  preset: u.preset,
});
