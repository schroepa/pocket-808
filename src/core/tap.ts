/* Tap-Tempo (Etappe 8a): aus den Zeiten der letzten Tipps ein Tempo ableiten. */

/** so viele Tipps (und damit Abstände) zählen höchstens */
export const TAP_MAX = 6;
/** nach dieser Pause (ms) beginnt eine neue Folge */
export const TAP_RESET_MS = 2000;

/** Tipp zum Zeitpunkt `now` (ms) einrechnen; Tempo in BPM (60–200) ab dem zweiten Tipp, sonst null */
export function tapTempo(
  taps: readonly number[],
  now: number,
): { taps: number[]; tempo: number | null } {
  const last = taps.at(-1);
  const kept = last === undefined || now - last > TAP_RESET_MS ? [] : [...taps];
  const next = [...kept, now].slice(-TAP_MAX);
  const first = next[0];
  if (next.length < 2 || first === undefined) return { taps: next, tempo: null };
  const mean = (now - first) / (next.length - 1);
  return { taps: next, tempo: Math.min(200, Math.max(60, Math.round(60000 / mean))) };
}
