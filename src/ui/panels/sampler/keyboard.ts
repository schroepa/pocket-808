import { clamp } from '../../../core/persist.ts';
import { signal } from '../../../store/signals.ts';
import type { UiContext } from '../../context.ts';
import { chip } from '../../controls/chip.ts';
import { bind, h } from '../../dom.ts';
import { recordTap } from '../../record.ts';
import { padState } from './common.ts';

/** Tasten einer Oktave: Halbton über C, Name, schwarz? */
const KEYS: readonly (readonly [number, string, boolean])[] = [
  [0, 'C', false],
  [1, 'C#', true],
  [2, 'D', false],
  [3, 'D#', true],
  [4, 'E', false],
  [5, 'F', false],
  [6, 'F#', true],
  [7, 'G', false],
  [8, 'G#', true],
  [9, 'A', false],
  [10, 'A#', true],
  [11, 'B', false],
];

/**
 * Melodische Tastatur (Etappe 7): zwölf Tasten spielen das gewählte Pad, C in seiner eigenen
 * Stimmung. Die Oktave verschiebt um ±12 Halbtöne. Nur live; aufgenommen wird in Etappe 8.
 */
export function samplerKeyboard(c: UiContext): HTMLElement {
  const { scope, audio, samples } = c;
  const { sel } = padState(c);
  const oct = signal(0);
  const octLabel = h('span', { class: 'oct' });
  bind(
    scope,
    () => oct.value,
    (o) => {
      octLabel.textContent = `Okt ${o > 0 ? '+' : ''}${String(o)}`;
    },
  );
  let white = 0;
  const keys = KEYS.map(([semi, name, black]) => {
    // 14 Spalten: weiße Tasten (7) belegen je zwei in Reihe 2, schwarze sitzen dazwischen in Reihe 1
    const col = black ? 2 * white : 2 * white++ + 1;
    const key = h('button', {
      class: black ? 'key black' : 'key',
      text: name,
      attrs: {
        type: 'button',
        'aria-label': `Pad spielen, Ton ${name}`,
        style: `grid-row:${black ? 1 : 2};grid-column:${String(col)} / span 2`,
      },
      on: {
        click: () => {
          const i = sel.peek();
          if (!samples.pads.peek()[i]) return;
          const semis = semi + oct.peek() * 12;
          audio.auditionPad(i, semis);
        },
      },
    });
    recordTap(c, key, () => {
      const i = sel.peek();
      if (!samples.pads.peek()[i]) return null;
      const semis = semi + oct.peek() * 12;
      return {
        make: (pos) => ({ kind: 'pad', pad: i, semis, ...pos }),
        label: `Pad ${String(i + 1)} ${name}`,
      };
    });
    return key;
  });
  const shift = (d: number) => () => {
    oct.value = clamp(oct.peek() + d, -1, 1);
  };
  return h('div', { class: 'smp-keys' }, [
    h('div', { class: 'row-split' }, [
      h('div', { class: 'cap-label', text: 'Tastatur' }),
      h('div', { class: 'oct-grp' }, [
        chip(scope, { label: '−', ariaLabel: 'Tastatur Oktave tiefer', onClick: shift(-1) }),
        octLabel,
        chip(scope, { label: '+', ariaLabel: 'Tastatur Oktave höher', onClick: shift(1) }),
      ]),
    ]),
    h('div', { class: 'keys', attrs: { role: 'group', 'aria-label': 'Tastatur' } }, keys),
  ]);
}
