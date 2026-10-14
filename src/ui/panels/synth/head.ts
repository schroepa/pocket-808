import { NOTE_NAMES, PARTS, SCALES } from '../../../core/constants.ts';
import { toggleMute } from '../../../core/synth.ts';
import type { UiContext } from '../../context.ts';
import { chip } from '../../controls/chip.ts';
import { segment } from '../../controls/segment.ts';
import { selectField } from '../../controls/select.ts';
import { h } from '../../dom.ts';
import { partName } from './format.ts';

/** Bass/Lead, Stumm, Tonart und Skala (Legacy synBody oben). */
export function synthHead(c: UiContext): HTMLElement {
  const { store, scope } = c;
  return h('div', { class: 'syn-head' }, [
    h('div', { class: 'syn-row mid' }, [
      segment(scope, {
        label: 'Stimme',
        options: PARTS.map((p) => ({ value: p, label: partName(p) })),
        value: store.select((s) => s.part),
        write: (p) => {
          store.update((s) => ({ ...s, part: p }));
        },
      }),
      chip(scope, {
        label: 'Stumm',
        ariaLabel: 'Stimme stumm',
        active: store.select((s) => s.mix[s.part].m),
        onClick: () => {
          store.update((s) => toggleMute(s, s.part));
        },
      }),
    ]),
    h('div', { class: 'syn-row' }, [
      selectField(scope, {
        label: 'Tonart',
        options: NOTE_NAMES,
        value: store.select((s) => s.key),
        write: (k) => {
          store.update((s) => ({ ...s, key: k }));
        },
      }),
      selectField(scope, {
        label: 'Skala',
        options: SCALES.map((x) => x.name),
        value: store.select((s) => s.scale),
        write: (i) => {
          store.update((s) => ({ ...s, scale: i }));
        },
      }),
    ]),
  ]);
}
