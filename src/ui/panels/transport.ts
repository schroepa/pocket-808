import { computed } from '../../store/signals.ts';
import type { UiContext } from '../context.ts';
import { holdButton } from '../controls/hold.ts';
import { segment } from '../controls/segment.ts';
import { bind, h } from '../dom.ts';
import './transport.css';

const SVG = 'http://www.w3.org/2000/svg';
const ICON_PLAY = 'M4 2.5v13l11-6.5z';
const ICON_STOP = 'M3 4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z';

/** Pattern/Song und Start/Stopp (Legacy-Leiste unten). */
export function transport(c: UiContext): HTMLElement {
  const { store, scope, audio } = c;
  const path = document.createElementNS(SVG, 'path');
  path.setAttribute('fill', 'currentColor');
  const svg = document.createElementNS(SVG, 'svg');
  for (const [k, v] of [
    ['viewBox', '0 0 18 18'],
    ['width', '18'],
    ['height', '18'],
    ['aria-hidden', 'true'],
  ] as const) {
    svg.setAttribute(k, v);
  }
  svg.append(path);
  const label = h('span');
  const play = h(
    'button',
    {
      class: 'play',
      attrs: { type: 'button' },
      on: {
        click: () => {
          if (audio.playing.peek()) audio.stop();
          else audio.start();
        },
      },
    },
    [svg, label],
  );
  bind(
    scope,
    () => audio.playing.value,
    (on) => {
      play.classList.toggle('on', on);
      play.setAttribute('aria-pressed', String(on));
      path.setAttribute('d', on ? ICON_STOP : ICON_PLAY);
      label.textContent = on ? 'Stopp' : 'Start';
    },
  );
  return h('div', { class: 'transport', attrs: { 'data-area': 'transport' } }, [
    segment(scope, {
      label: 'Wiedergabe',
      options: [
        { value: 'pattern', label: 'Pattern' },
        { value: 'song', label: 'Song' },
      ],
      value: computed(() => store.state.value.mode),
      write: (m) => {
        store.setMode(m);
      },
    }),
    holdButton(scope, {
      class: 'fill-btn',
      text: 'Fill',
      ariaLabel: 'Fill halten',
      on: () => {
        audio.setFill(true);
      },
      off: () => {
        audio.setFill(false);
      },
    }),
    play,
  ]);
}
