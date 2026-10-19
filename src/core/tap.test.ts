import { describe, expect, it } from 'vitest';
import { TAP_MAX, tapTempo } from './tap.ts';

describe('tapTempo', () => {
  it('erster Tipp: noch kein Tempo', () => {
    expect(tapTempo([], 1000)).toEqual({ taps: [1000], tempo: null });
  });

  it('Mittelwert der Abstände: 500 ms = 120 BPM', () => {
    let r = tapTempo([], 0);
    r = tapTempo(r.taps, 500);
    expect(r.tempo).toBe(120);
    r = tapTempo(r.taps, 1000);
    r = tapTempo(r.taps, 1500);
    expect(r.tempo).toBe(120);
    r = tapTempo(r.taps, 2100); // 600 ms nach dem letzten: Mittel aus 500, 500, 500, 600
    expect(r.tempo).toBe(Math.round(60000 / 525));
  });

  it('Pause über 2 s beginnt neu', () => {
    const r = tapTempo([0, 500], 3000);
    expect(r).toEqual({ taps: [3000], tempo: null });
  });

  it('behält höchstens die letzten Tipps', () => {
    let taps: number[] = [];
    for (let i = 0; i < 12; i++) taps = tapTempo(taps, i * 500).taps;
    expect(taps).toHaveLength(TAP_MAX);
    expect(taps.at(-1)).toBe(5500);
  });

  it('Tempo bleibt im Bereich 60–200', () => {
    expect(tapTempo([0], 100).tempo).toBe(200); // 600 BPM
    expect(tapTempo([0], 1900).tempo).toBe(60); // 31 BPM
  });
});
