import { describe, expect, it } from 'vitest';
import { djText, panText, sizeText } from './format.ts';

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
});
