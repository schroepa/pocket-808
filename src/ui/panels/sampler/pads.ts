import { PAD_COUNT } from '../../../core/constants.ts';
import { currentPattern } from '../../../core/pattern.ts';
import { selectPad } from '../../../core/sampler.ts';
import { must } from '../../../core/util.ts';
import type { UiContext } from '../../context.ts';
import { bind, h } from '../../dom.ts';
import { hearPad } from './common.ts';

/** Acht Pads: wählen und vorhören, Name bzw. „leer“, Inhaltspunkt (Legacy buildSmp/renderSmp) */
export function samplerPads(c: UiContext): HTMLElement {
  const { store, scope, samples } = c;
  const pads = Array.from({ length: PAD_COUNT }, (_, i) => {
    const small = h('small');
    const b = h(
      'button',
      {
        class: 'pad',
        attrs: { type: 'button', 'aria-label': `Pad ${i + 1}` },
        on: {
          click: () => {
            store.update((s) => selectPad(s, i));
            hearPad(c, i);
          },
        },
      },
      [String(i + 1), small],
    );
    bind(
      scope,
      () => store.state.value.smp.sel === i,
      (on) => {
        b.classList.toggle('sel', on);
      },
    );
    bind(
      scope,
      () => must(currentPattern(store.state.value).smp[i], 'Sampler-Reihe').some(Boolean),
      (on) => {
        b.classList.toggle('has', on);
      },
    );
    bind(
      scope,
      () => {
        const name = must(store.state.value.smp.pads[i], 'Pad').name;
        return samples.pads.value[i] ? name || 'Sample' : '';
      },
      (name) => {
        small.textContent = name || 'leer';
        b.classList.toggle('empty', !name);
      },
    );
    return b;
  });
  return h('div', { class: 'pads', attrs: { role: 'group', 'aria-label': 'Pads' } }, pads);
}
