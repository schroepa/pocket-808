import { describe, expect, it } from 'vitest';
import { SMP_RATE } from './constants.ts';
import { baseState } from './defaults.ts';
import {
  clearedPad,
  grabHandle,
  loadedPad,
  movePadHandle,
  padSummary,
  selectPad,
  setPadValue,
  toggleReverse,
  waveColumns,
} from './sampler.ts';
import { must } from './util.ts';

const pad = (s: ReturnType<typeof baseState>, i: number) => must(s.smp.pads[i], 'Pad');

describe('Pad-Bedienung', () => {
  it('selectPad und setPadValue', () => {
    const s0 = selectPad(baseState(), 3);
    const s = setPadValue(s0, 3, 'tune', 0.7);
    expect(s.smp.sel).toBe(3);
    expect(pad(s, 3).tune).toBe(0.7);
    expect(s.smp.pads[2]).toBe(s0.smp.pads[2]);
  });
  it('grabHandle nimmt den näheren Griff, bei Gleichstand den Start', () => {
    const p = { ...pad(baseState(), 0), start: 0.25, end: 0.75 };
    expect(grabHandle(p, 0.1)).toBe('start');
    expect(grabHandle(p, 0.7)).toBe('end');
    expect(grabHandle(p, 0.5)).toBe('start');
  });
  it('movePadHandle hält 0,02 Abstand, Griffe kreuzen sich nie', () => {
    let s = movePadHandle(baseState(), 0, 'end', 0.5);
    expect(pad(s, 0).end).toBe(0.5);
    s = movePadHandle(s, 0, 'start', 0.9);
    expect(pad(s, 0).start).toBeCloseTo(0.48, 10);
    s = movePadHandle(s, 0, 'end', 0.1);
    expect(pad(s, 0).end).toBeCloseTo(0.5, 10);
    s = movePadHandle(s, 0, 'end', 1);
    expect(pad(s, 0).end).toBe(1);
  });
  it('toggleReverse, loadedPad, clearedPad', () => {
    let s = toggleReverse(movePadHandle(baseState(), 1, 'start', 0.3), 1);
    expect(pad(s, 1).rev).toBe(true);
    s = loadedPad(s, 1, 'Kick');
    expect(pad(s, 1)).toMatchObject({ name: 'Kick', start: 0, end: 1, rev: true });
    s = clearedPad(movePadHandle(s, 1, 'end', 0.5), 1);
    expect(pad(s, 1)).toMatchObject({ name: '', start: 0, end: 1, rev: false });
  });
});

describe('waveColumns', () => {
  it('Spitzen je Pixelspalte wie Legacy drawWave', () => {
    const pcm = Float32Array.from([0.5, -0.5, 0.25, -0.1]);
    expect(waveColumns(pcm, 2)).toEqual([
      { min: -0.5, max: 0.5 },
      { min: Math.fround(-0.1), max: 0.25 },
    ]);
  });
  it('breiter als das Sample: jede Spalte mindestens ein Wert', () => {
    const cols = waveColumns(Float32Array.from([0.3, -0.3]), 4);
    expect(cols).toHaveLength(4);
    expect(cols[0]).toEqual({ min: Math.fround(0.3), max: Math.fround(0.3) });
    expect(cols[3]).toEqual({ min: Math.fround(-0.3), max: Math.fround(-0.3) });
  });
  it('leeres Sample: keine Ausschläge', () => {
    expect(waveColumns(new Float32Array(0), 2)).toEqual([
      { min: 0, max: 0 },
      { min: 0, max: 0 },
    ]);
  });
});

describe('padSummary', () => {
  it('Pad, Name oder leer, Länge in Sekunden', () => {
    const s = loadedPad(selectPad(baseState(), 2), 2, 'Stab');
    expect(padSummary(s, new Float32Array(SMP_RATE * 1.5))).toBe('Pad 3 · Stab · 1.5 s');
    expect(padSummary(clearedPad(s, 2), null)).toBe('Pad 3 · leer');
  });
});
