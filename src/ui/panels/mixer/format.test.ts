import { describe, expect, it } from 'vitest';
import { baseState } from '../../../core/defaults.ts';
import { toggleSolo } from '../../../core/mixer.ts';
import { toggleMute } from '../../../core/synth.ts';
import { djText, fxSummary, mixSummary, panText, sizeText } from './format.ts';

describe('Mixer-/FX-Texte wie Legacy', () => {
  it('panText', () => {
    expect(panText(0.5)).toBe('Mitte');
    expect(panText(0.502)).toBe('Mitte');
    expect(panText(0.25)).toBe('L 50');
    expect(panText(1)).toBe('R 100');
  });
  it('djText und sizeText', () => {
    expect(djText(0.5)).toBe('aus');
    expect(djText(0)).toBe('Tiefpass 100%');
    expect(djText(0.75)).toBe('Hochpass 50%');
    expect(sizeText(0)).toBe('0.3 s');
    expect(sizeText(1)).toBe('2.5 s');
  });
  it('mixSummary', () => {
    const s = baseState();
    expect(mixSummary(s.mix)).toBe('13 Kanäle');
    const m = toggleMute(toggleMute(s, 'BD'), 'SD');
    expect(mixSummary(m.mix)).toBe('2 stumm');
    expect(mixSummary(toggleSolo(m, 'CH').mix)).toBe('2 stumm · Solo CH');
    expect(mixSummary(toggleSolo(toggleSolo(s, 'CH'), 'OH').mix)).toBe('Solo 2');
  });
  it('fxSummary', () => {
    const fx = baseState().fx;
    expect(fxSummary({ ...fx, ret: 0.5, dj: 0.5 })).toBe('Reverb 50% · Filter aus');
    expect(fxSummary({ ...fx, ret: 0.2, dj: 0.25 })).toBe('Reverb 20% · Filter LP 50%');
    expect(fxSummary({ ...fx, ret: 0, dj: 1 })).toBe('Reverb 0% · Filter HP 100%');
  });
});
