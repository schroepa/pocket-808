import { describe, expect, it } from 'vitest';
import {
  CHANNEL_NAMES,
  CHANNELS,
  DRUM_DEFAULTS,
  PRESETS,
  SCALES,
  SYN_KEYS,
  SYN_PRESETS,
  VOICE_IDS,
} from './constants.ts';
import { deepFreeze } from './test-utils.ts';

describe('Konstanten', () => {
  it('haben für jede Stimme Defaults und jeder Kanal einen Namen', () => {
    expect(Object.keys(DRUM_DEFAULTS)).toEqual([...VOICE_IDS]);
    expect(CHANNELS).toHaveLength(13);
    for (const ch of CHANNELS) expect(CHANNEL_NAMES[ch]).toBeTruthy();
  });

  it('Presets nutzen nur bekannte Stimmen und 16-Step-Muster', () => {
    for (const p of PRESETS) {
      for (const [id, pat] of Object.entries(p.pat)) {
        expect(VOICE_IDS).toContain(id);
        expect(pat).toMatch(/^[x.]{16}$/);
      }
    }
  });

  it('Synth-Presets setzen genau die Synth-Regler plus Wellenform', () => {
    for (const list of Object.values(SYN_PRESETS)) {
      for (const p of list) expect(Object.keys(p.v).sort()).toEqual(['wave', ...SYN_KEYS].sort());
    }
  });

  it('Skalen beginnen beim Grundton und steigen', () => {
    for (const sc of SCALES) {
      expect(sc.s[0]).toBe(0);
      expect([...sc.s].sort((a, b) => a - b)).toEqual([...sc.s]);
    }
  });
});

describe('deepFreeze', () => {
  it('friert verschachtelte Objekte ein', () => {
    const o = deepFreeze({ a: [1, { b: 2 }] });
    expect(() => {
      (o.a[1] as { b: number }).b = 3;
    }).toThrow(TypeError);
  });
});
