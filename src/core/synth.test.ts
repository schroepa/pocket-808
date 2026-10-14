import { describe, expect, it } from 'vitest';
import { SYN_PRESETS } from './constants.ts';
import { baseState } from './defaults.ts';
import {
  applySynthPreset,
  noteAt,
  setSynthValue,
  setWave,
  shiftOctave,
  toggleMute,
} from './synth.ts';
import type { NoteRow } from './types.ts';
import { must } from './util.ts';

describe('Synth-Patch', () => {
  it('setSynthValue setzt den Wert und hebt die Preset-Markierung auf', () => {
    const s = baseState();
    expect(s.synth.BA.preset).not.toBeNull();
    const t = setSynthValue(s, 'BA', 'cut', 0.3);
    expect(t.synth.BA.cut).toBe(0.3);
    expect(t.synth.BA.preset).toBeNull();
    expect(t.synth.LD).toBe(s.synth.LD);
  });
  it('setWave wählt die Wellenform und hebt die Preset-Markierung auf', () => {
    const t = setWave(baseState(), 'LD', 2);
    expect(t.synth.LD.wave).toBe(2);
    expect(t.synth.LD.preset).toBeNull();
  });
  it('shiftOctave begrenzt auf −2..+2 und lässt das Preset', () => {
    let s = baseState();
    const preset = s.synth.BA.preset;
    for (let i = 0; i < 5; i++) s = shiftOctave(s, 'BA', 1);
    expect(s.synth.BA.oct).toBe(2);
    expect(s.synth.BA.preset).toBe(preset);
    for (let i = 0; i < 6; i++) s = shiftOctave(s, 'BA', -1);
    expect(s.synth.BA.oct).toBe(-2);
  });
  it('applySynthPreset übernimmt alle Werte und den Namen, Oktave bleibt', () => {
    const p = must(SYN_PRESETS.BA[0], 'Preset');
    const s0 = shiftOctave(baseState(), 'BA', 1);
    const s = applySynthPreset(setSynthValue(s0, 'BA', 'cut', 0.99), 'BA', p);
    expect(s.synth.BA.cut).toBe(p.v.cut);
    expect(s.synth.BA.wave).toBe(p.v.wave);
    expect(s.synth.BA.preset).toBe(p.name);
    expect(s.synth.BA.oct).toBe(1);
  });
  it('toggleMute schaltet den Mixer-Kanal um', () => {
    const s = toggleMute(baseState(), 'LD');
    expect(s.mix.LD.m).toBe(true);
    expect(toggleMute(s, 'LD').mix.LD.m).toBe(false);
  });
});

describe('noteAt', () => {
  const row = (notes: Record<number, { d: number; l: number }>): NoteRow =>
    Array.from({ length: 16 }, (_, i) => notes[i] ?? null);
  it('Beginn und Ausklang einer Note', () => {
    const r = row({ 0: { d: 3, l: 4 } });
    expect(noteAt(r, 0)).toEqual({ start: 0, d: 3 });
    expect(noteAt(r, 3)).toEqual({ start: 0, d: 3 });
    expect(noteAt(r, 4)).toBeNull();
  });
  it('eine spätere Note kürzt die frühere', () => {
    const r = row({ 0: { d: 3, l: 4 }, 2: { d: 5, l: 1 } });
    expect(noteAt(r, 1)).toEqual({ start: 0, d: 3 });
    expect(noteAt(r, 2)).toEqual({ start: 2, d: 5 });
    expect(noteAt(r, 3)).toBeNull();
  });
  it('leere Reihe', () => {
    expect(noteAt(row({}), 7)).toBeNull();
  });
});
