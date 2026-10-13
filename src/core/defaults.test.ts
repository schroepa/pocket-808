import { describe, expect, it } from 'vitest';
import { PRESETS, VOICE_IDS } from './constants.ts';
import { baseState, blankPattern, mixDefaults, parsePattern } from './defaults.ts';
import { initialState } from './initial.ts';
import { applyPreset } from './presets.ts';
import { deepFreeze } from './test-utils.ts';

const hipHop = PRESETS.find((p) => p.name === 'Hip-Hop')!;

describe('Defaults', () => {
  it('parsePattern liest x als Schlag und füllt auf 16 Steps', () => {
    expect(parsePattern('x..x')).toEqual([1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(parsePattern('x'.repeat(20))).toHaveLength(16);
  });

  it('blankPattern ist leer und unabhängig', () => {
    const a = blankPattern();
    const b = blankPattern();
    for (const id of VOICE_IDS) expect(a[id].every((x) => x === 0)).toBe(true);
    expect(a.notes.BA).toEqual(new Array(16).fill(null));
    expect(a.smp).toHaveLength(8);
    expect(a.sub).toEqual({});
    a.BD[0] = 1;
    expect(b.BD[0]).toBe(0);
  });

  it('mixDefaults setzt Fader, Mitte und voreingestellte Sends', () => {
    const m = mixDefaults();
    expect(m.BD).toEqual({ v: 0.8, p: 0.5, r: 0, m: false, s: false });
    expect(m.CP.r).toBe(0.3);
    expect(m.SM.r).toBe(0.15);
  });

  it('baseState entspricht dem Legacy-Grundzustand', () => {
    const s = baseState();
    expect([s.tempo, s.swing, s.master, s.cur, s.mode, s.key, s.part, s.noteLen]).toEqual([
      90,
      0.35,
      0.8,
      'A',
      'pattern',
      9,
      'BA',
      1,
    ]);
    expect(s.synth.BA.preset).toBe('Acid');
    expect(s.synth.LD.preset).toBe('Saw');
  });
});

describe('applyPreset', () => {
  it('ersetzt Drums, Tempo und Swing, behält Noten, Sampler-Steps und Pad-Sub-Steps', () => {
    const s0 = baseState();
    s0.patterns.A.notes.BA[3] = { d: 2, l: 1 };
    s0.patterns.A.smp[1]![4] = 1;
    s0.patterns.A.sub = {
      BD: { 0: new Array<0 | 1>(16).fill(1) },
      P2: { 5: new Array<0 | 1>(16).fill(1) },
    };
    s0.patterns.A.SD[1] = 1;
    const s = applyPreset(deepFreeze(s0), hipHop);
    expect(s.tempo).toBe(90);
    expect(s.preset).toBe('Hip-Hop');
    expect(s.patterns.A.BD).toEqual(parsePattern('x.....x.x.....x.'));
    expect(s.patterns.A.SD).toEqual(parsePattern('....x.......x...'));
    expect(s.patterns.A.notes.BA[3]).toEqual({ d: 2, l: 1 });
    expect(s.patterns.A.smp[1]![4]).toBe(1);
    expect(Object.keys(s.patterns.A.sub)).toEqual(['P2']);
    expect(s.patterns.B).toBe(s0.patterns.B);
  });
});

describe('initialState', () => {
  it('enthält Hip-Hop in A, Seed in B, Noten, Song und Fabrik-Pads', () => {
    const s = initialState();
    expect(s.preset).toBe('Hip-Hop');
    expect(s.patterns.B.CY[0]).toBe(1);
    expect(s.patterns.A.notes.BA[0]).toEqual({ d: 0, l: 2 });
    expect(s.song).toEqual([
      { p: 'A', n: 3 },
      { p: 'B', n: 1 },
    ]);
    expect(s.smp.pads.map((p) => p.name)).toEqual(['Stab', 'Zap', 'Riser', 'Bell', '', '', '', '']);
    expect(s.patterns.A.smp[1]![15]).toBe(1);
    expect(s.patterns.B.smp[2]![8]).toBe(1);
  });
});
