import { describe, expect, it } from 'vitest';
import { mixDefaults } from './defaults.ts';
import { attackTime, decayTime, releaseTime } from './envelope.ts';
import { audibleChannels, channelGain, channelPan, masterGain } from './mix.ts';
import { degreeName, degreeToMidi, effectiveLength } from './music.ts';
import { deepFreeze } from './test-utils.ts';
import type { NoteRow } from './types.ts';

const aMinor = { key: 9, scale: 0 };

describe('degreeToMidi', () => {
  it('Grundton: Bass A2 = 45, Lead A4 = 69', () => {
    expect(degreeToMidi('BA', 0, aMinor, 0)).toBe(45);
    expect(degreeToMidi('LD', 0, aMinor, 0)).toBe(69);
  });
  it('Stufen über die Oktave und darunter, Oktav-Regler', () => {
    expect(degreeToMidi('BA', 7, aMinor, 0)).toBe(57);
    expect(degreeToMidi('BA', -1, aMinor, 0)).toBe(43);
    expect(degreeToMidi('BA', 2, aMinor, -1)).toBe(36);
    expect(degreeToMidi('BA', 5, { key: 0, scale: 4 }, 0)).toBe(48);
  });
});

describe('degreeName', () => {
  it('benennt Stufen in Tonart und Skala', () => {
    expect(degreeName(0, aMinor)).toBe('A');
    expect(degreeName(2, aMinor)).toBe('C');
    expect(degreeName(-1, aMinor)).toBe('G');
  });
});

describe('effectiveLength', () => {
  const row: NoteRow = new Array<null>(16).fill(null);
  row[0] = { d: 0, l: 4 };
  row[2] = { d: 1, l: 1 };
  row[14] = { d: 0, l: 4 };
  deepFreeze(row);
  it('endet an der nächsten Note, am Taktende oder nach l Steps', () => {
    expect(effectiveLength(row, 0)).toBe(2);
    expect(effectiveLength(row, 2)).toBe(1);
    expect(effectiveLength(row, 14)).toBe(2);
    expect(effectiveLength(row, 5)).toBe(0);
  });
});

describe('Hüllkurven-Zeiten', () => {
  it('quadratisch von kurz bis lang', () => {
    expect([attackTime(0), decayTime(0), releaseTime(0)]).toEqual([0.002, 0.02, 0.02]);
    expect(attackTime(1)).toBeCloseTo(1.502);
    expect(decayTime(1)).toBeCloseTo(1.82);
    expect(releaseTime(1)).toBeCloseTo(1.22);
  });
});

describe('Mixer-Logik', () => {
  it('Mute und Solo bestimmen die Hörbarkeit', () => {
    const m = structuredClone(mixDefaults());
    expect(Object.values(audibleChannels(m)).every(Boolean)).toBe(true);
    m.SD.m = true;
    expect(audibleChannels(m).SD).toBe(false);
    m.LT.s = true;
    m.SD.s = true;
    const a = audibleChannels(deepFreeze(m));
    expect([a.LT, a.SD, a.BD]).toEqual([true, false, false]);
  });
  it('Fader-Kurve, Pan, Master-Kurve', () => {
    const ch = { v: 0.8, p: 0.75, r: 0, m: false, s: false };
    expect(channelGain(ch, true)).toBeCloseTo(1);
    expect(channelGain(ch, false)).toBe(0);
    expect(channelPan(ch)).toBe(0.5);
    expect(masterGain(0.25)).toBeCloseTo(0.125);
  });
});
