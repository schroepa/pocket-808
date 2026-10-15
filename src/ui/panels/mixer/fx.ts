import { fxDefaults } from '../../../core/defaults.ts';
import { setFxValue } from '../../../core/mixer.ts';
import type { Fx } from '../../../core/types.ts';
import { computed } from '../../../store/signals.ts';
import type { UiContext } from '../../context.ts';
import { holdButton } from '../../controls/hold.ts';
import { knob } from '../../controls/knob.ts';
import { h } from '../../dom.ts';
import { djText, sizeText } from './format.ts';

const DEFAULTS = fxDefaults();
const pct = (v: number): string => `${Math.round(v * 100)}%`;
const STUTTER = [
  ['1/4', 1],
  ['1/8', 0.5],
  ['1/16', 0.25],
  ['1/32', 0.125],
] as const;

/** Reverb, DJ-Filter, Stutter halten (Legacy buildMixFx, rvKnobs/djKnobs/stPads) */
export function fxPanel(c: UiContext): HTMLElement {
  const { store, scope, readout, audio } = c;
  const fxKnob = (
    key: keyof Fx,
    label: string,
    tag: string,
    format: (v: number) => string,
    snap?: number,
  ) =>
    knob(scope, {
      label,
      value: computed(() => store.state.value.fx[key]),
      write: (v) => {
        store.update((s) => setFxValue(s, key, v));
      },
      def: () => DEFAULTS[key],
      format,
      readout,
      tag: () => tag,
      ...(snap === undefined ? {} : { snap }),
    });
  const stutter = STUTTER.map(([t, fraction]) =>
    holdButton(scope, {
      class: 'stp',
      text: t,
      ariaLabel: `Stutter ${t} halten`,
      on: () => {
        audio.stutterOn(fraction);
      },
      off: () => {
        audio.stutterOff();
      },
    }),
  );
  return h('div', { class: 'fx-body' }, [
    h('div', { class: 'cap-label', text: 'Reverb' }),
    h('div', { class: 'knob-grid k3' }, [
      fxKnob('ret', 'Return', 'REVERB', pct),
      fxKnob('size', 'Size', 'REVERB', sizeText),
      fxKnob('damp', 'Damp', 'REVERB', pct),
    ]),
    h('div', { class: 'cap-label', text: 'DJ Filter' }),
    h('div', { class: 'knob-grid k3' }, [
      fxKnob('dj', 'Filter', 'DJ', djText, 0.5),
      fxKnob('djq', 'Reso', 'DJ', pct),
    ]),
    h('div', { class: 'cap-label', text: 'Stutter (halten)' }),
    h('div', { class: 'st-row', attrs: { role: 'group', 'aria-label': 'Stutter' } }, stutter),
  ]);
}
