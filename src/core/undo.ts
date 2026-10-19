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

/**
 * Schnappschuss wiederherstellen. Mit `after` (die Werte direkt nach der Aktion) bleiben Tempo, Swing
 * und Preset, die du danach selbst verändert hast (Regler, Tap), stehen; nur unveränderte werden
 * zurückgestellt. Ohne `after` immer, wie in der alten App.
 */
export const restoreSnapshot = (s: State, u: Snapshot, after?: Snapshot): State => {
  const changed = (k: 'tempo' | 'swing' | 'preset'): boolean => !!after && s[k] !== after[k];
  return {
    ...replacePattern(s, u.cur, u.pat),
    cur: u.cur,
    tempo: changed('tempo') ? s.tempo : u.tempo,
    swing: changed('swing') ? s.swing : u.swing,
    preset: changed('preset') ? s.preset : u.preset,
  };
};
