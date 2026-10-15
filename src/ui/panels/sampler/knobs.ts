import { PAD_DEFAULT } from '../../../core/constants.ts';
import { setPadValue } from '../../../core/sampler.ts';
import { computed } from '../../../store/signals.ts';
import type { UiContext } from '../../context.ts';
import { knob } from '../../controls/knob.ts';
import { h } from '../../dom.ts';
import { hearPad, padState } from './common.ts';

const KNOBS = [
  ['att', 'Attack'],
  ['dec', 'Decay'],
  ['tune', 'Tune'],
  ['lvl', 'Level'],
] as const;

const fmtTune = (v: number): string => {
  const n = Math.round((v - 0.5) * 24);
  return `${n > 0 ? '+' : ''}${n} ST`;
};

/** Attack, Decay, Tune (±12 Halbtöne), Level des gewählten Pads (Legacy smpKnobs) */
export function samplerKnobs(c: UiContext): HTMLElement {
  const { store, scope, readout } = c;
  const { sel, pad } = padState(c);
  return h(
    'div',
    { class: 'knob-grid' },
    KNOBS.map(([k, label]) =>
      knob(scope, {
        label,
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
