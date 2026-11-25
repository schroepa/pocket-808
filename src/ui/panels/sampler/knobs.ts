import { PAD_DEFAULT } from '../../../core/constants.ts';
import { setPadValue } from '../../../core/sampler.ts';
import { computed } from '../../../store/signals.ts';
import type { UiContext } from '../../context.ts';
import { knob } from '../../controls/knob.ts';
import { h } from '../../dom.ts';
import { hearPad, padState } from './common.ts';

const LABELS = { att: 'Attack', dec: 'Decay', tune: 'Tune', lvl: 'Level' } as const;
type PadKnob = keyof typeof LABELS;
const ORDER: readonly PadKnob[] = ['att', 'dec', 'tune', 'lvl'];

const fmtTune = (v: number): string => {
  const n = Math.round((v - 0.5) * 24);
  return `${n > 0 ? '+' : ''}${n} ST`;
};

/** Attack, Decay, Tune (±12 Halbtöne), Level des gewählten Pads (Legacy smpKnobs) */
export function samplerKnobs(c: UiContext, order: readonly PadKnob[] = ORDER): HTMLElement {
  const { store, scope, readout } = c;
  const { sel, pad } = padState(c);
  return h(
    'div',
    { class: 'knob-grid' },
    order.map((k) =>
      knob(scope, {
        label: LABELS[k],
        value: computed(() => pad.value[k]),
        write: (v) => {
          const i = sel.peek();
          store.update((s) => setPadValue(s, i, k, v));
        },
        def: () => PAD_DEFAULT[k],
        format: k === 'tune' ? fmtTune : (v) => String(Math.round(v * 100)),
        readout,
        tag: () => `PAD ${sel.peek() + 1}`,
        onEnd: () => {
          hearPad(c, sel.peek());
        },
      }),
    ),
  );
}
