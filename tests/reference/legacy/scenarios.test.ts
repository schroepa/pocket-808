import { describe, expect, it } from 'vitest';
import { assertClean, assertPrerendered } from './scenarios.ts';
import type { LegacyHooks } from './types.ts';

const VOICES = [
  { id: 'BD', name: 'Bass Drum' },
  { id: 'SD', name: 'Snare Drum' },
];

describe('assertPrerendered', () => {
  it('scheitert, wenn eine Stimme nicht vorgerendert wurde (Legacy fiele still auf Live-Synthese zurück)', () => {
    const t = { VOICES, voiceBuf: { BD: {} as AudioBuffer } } as unknown as LegacyHooks;
    expect(() => {
      assertPrerendered(t);
    }).toThrow(/SD/);
  });

  it('akzeptiert vollständig vorgerenderte Stimmen', () => {
    const buf = {} as AudioBuffer;
    const t = { VOICES, voiceBuf: { BD: buf, SD: buf } } as unknown as LegacyHooks;
    expect(() => {
      assertPrerendered(t);
    }).not.toThrow();
  });
});

describe('assertClean', () => {
  it('scheitert bei Fehlern aus dem Legacy-Fenster', () => {
    expect(() => {
      assertClean({ errors: ['TypeError: x is undefined'] });
    }).toThrow(/TypeError/);
  });

  it('akzeptiert eine fehlerfreie Seite', () => {
    expect(() => {
      assertClean({ errors: [] });
    }).not.toThrow();
  });
});
