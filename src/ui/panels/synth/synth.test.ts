import { describe, expect, it } from 'vitest';
import { NOTE_NAMES, SCALES } from '../../../core/constants.ts';
import { baseState } from '../../../core/defaults.ts';
import type { State } from '../../../core/types.ts';
import { must } from '../../../core/util.ts';
import { makeContext } from '../../test-utils.ts';
import { fmtTime, partName, synthSummary } from './format.ts';
import { synthHead } from './head.ts';

describe('format', () => {
  it('fmtTime wie Legacy', () => {
    expect(fmtTime(0.25)).toBe('250 ms');
    expect(fmtTime(1.2)).toBe('1.20 s');
  });
  it('synthSummary: Part, Tonart, Skala, Notenzahl, stumm', () => {
    const s = baseState();
    const n = s.patterns[s.cur].notes[s.part].filter(Boolean).length;
    const tonart = `${must(NOTE_NAMES[s.key], 'Tonart')} ${must(SCALES[s.scale], 'Skala').name}`;
    expect(synthSummary(s)).toBe(
      `${partName(s.part)} · ${tonart} · ${n} ${n === 1 ? 'Note' : 'Noten'}`,
    );
    const ld: State = {
      ...s,
      part: 'LD',
      key: 9,
      scale: 1,
      patterns: {
        ...s.patterns,
        [s.cur]: {
          ...s.patterns[s.cur],
          notes: {
            ...s.patterns[s.cur].notes,
            LD: Array.from({ length: 16 }, (_, i) => (i === 0 ? { d: 0, l: 1 } : null)),
          },
        },
      },
      mix: { ...s.mix, LD: { ...s.mix.LD, m: true } },
    };
    expect(synthSummary(ld)).toBe('Lead · A Dur · 1 Note · stumm');
  });
});

describe('synthHead', () => {
  it('Bass/Lead, Stumm, Tonart und Skala schreiben in den Store', () => {
    const { c, store } = makeContext();
    const el = synthHead(c);
    el.querySelectorAll<HTMLButtonElement>('[role=radio]')[1]?.click();
    expect(store.state.value.part).toBe('LD');
    const mute = el.querySelector<HTMLButtonElement>('[aria-label="Stimme stumm"]');
    mute?.click();
    expect(store.state.value.mix.LD.m).toBe(true);
    expect(mute?.getAttribute('aria-pressed')).toBe('true');
    const [key, scale] = [...el.querySelectorAll('select')];
    if (!key || !scale) throw new Error('Auswahl fehlt');
    key.value = '9';
    key.dispatchEvent(new Event('change'));
    scale.value = '4';
    scale.dispatchEvent(new Event('change'));
    expect(store.state.value.key).toBe(9);
    expect(store.state.value.scale).toBe(4);
  });
});
