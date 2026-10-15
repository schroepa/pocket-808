import { describe, expect, it } from 'vitest';
import { exportFileName, exportPlan, formatDuration, EXPORT_MAX, EXPORT_TAIL } from './export.ts';
import { initialState } from './initial.ts';

const D = new Date('2026-10-15T12:00:00.000Z');

describe('Export-Dauer', () => {
  it('Pattern: Takte × 16 Steps plus Ausklang', () => {
    const s = { ...initialState(), tempo: 120 };
    expect(exportPlan(s, 'pattern', 4)).toEqual({ bars: 4, playFor: 8, seconds: 8 + EXPORT_TAIL });
  });
  it('Song: Summe der Wiederholungen', () => {
    const s = {
      ...initialState(),
      tempo: 120,
      song: [
        { p: 'A' as const, n: 3 },
        { p: 'B' as const, n: 2 },
      ],
    };
    expect(exportPlan(s, 'song', 8)).toEqual({ bars: 5, playFor: 10, seconds: 12 });
  });
  it('leerer Song: kein Export', () => {
    expect(exportPlan({ ...initialState(), song: [] }, 'song', 1)).toBeNull();
  });
  it('Grenze 5 Minuten', () => {
    expect(EXPORT_MAX).toBe(300);
  });
  it('Dateinamen', () => {
    const s = { ...initialState(), cur: 'C' as const };
    expect(exportFileName(s, 'pattern', 4, D)).toBe('pocket808-pattern-C-4x-2026-10-15.wav');
    expect(exportFileName(s, 'song', 4, D)).toBe('pocket808-song-2026-10-15.wav');
  });
  it('Dauer als m:ss', () => {
    expect(formatDuration(32.4)).toBe('0:32');
    expect(formatDuration(75)).toBe('1:15');
    expect(formatDuration(9.6)).toBe('0:10');
  });
});
