import { STEPS } from './constants.ts';
import { fileDay } from './project.ts';
import { stepDuration } from './timing.ts';
import type { State } from './types.ts';

export type ExportScope = 'pattern' | 'song';
/** Ausklang für Reverb, Delay und ausklingende Noten (Sekunden) */
export const EXPORT_TAIL = 2;
/** Längster Export (Sekunden) */
export const EXPORT_MAX = 300;

/** Takte und Dauer eines Exports; null, wenn der Song leer ist. */
export function exportPlan(
  s: State,
  scope: ExportScope,
  repeats: number,
): { bars: number; playFor: number; seconds: number } | null {
  const bars = scope === 'song' ? s.song.reduce((n, e) => n + e.n, 0) : repeats;
  if (bars === 0) return null;
  const playFor = bars * STEPS * stepDuration(s.tempo);
  return { bars, playFor, seconds: playFor + EXPORT_TAIL };
}

export const exportFileName = (s: State, scope: ExportScope, repeats: number, d: Date): string =>
  scope === 'song'
    ? `pocket808-song-${fileDay(d)}.wav`
    : `pocket808-pattern-${s.cur}-${String(repeats)}x-${fileDay(d)}.wav`;

export function formatDuration(sec: number): string {
  const t = Math.round(sec);
  return `${String(Math.floor(t / 60))}:${String(t % 60).padStart(2, '0')}`;
}
