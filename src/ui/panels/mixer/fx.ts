import { fxDefaults } from '../../../core/defaults.ts';
import { setFxValue } from '../../../core/mixer.ts';
import { setDrumDrive, setTape, setWarm } from '../../../core/tone.ts';
import type { Fx } from '../../../core/types.ts';
import { computed } from '../../../store/signals.ts';
import type { UiContext } from '../../context.ts';
import { chip } from '../../controls/chip.ts';
import { holdButton } from '../../controls/hold.ts';
import { knob } from '../../controls/knob.ts';
import { h } from '../../dom.ts';
import { djText, sizeText } from './format.ts';
import './mixer.css';

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
    h('div', { class: 'cap-label', text: 'Klang' }),
    h('div', { class: 'tone-row' }, [
      chip(scope, {
        label: 'Warm',
        ariaLabel: 'Warmer, analoger Klang',
        active: store.select((s) => s.warm === true),
        onClick: () => {
          store.update((s) => setWarm(s, s.warm !== true));
          readout.flash(store.state.peek().warm ? 'WARM AN' : 'WARM AUS');
        },
      }),
      knob(scope, {
        label: 'Tape',
        value: computed(() => store.state.value.tape ?? 0),
        write: (v) => {
          store.update((s) => setTape(s, v));
        },
        def: () => 0,
        format: pct,
        readout,
        tag: () => 'TAPE',
      }),
      knob(scope, {
        label: 'Drum Drive',
        value: computed(() => store.state.value.drumDrive ?? 0),
        write: (v) => {
          store.update((s) => setDrumDrive(s, v));
        },
        def: () => 0,
        format: pct,
        readout,
      }),
    ]),
    h('div', { class: 'cap-label', text: 'Stutter (halten)' }),
    h('div', { class: 'st-row', attrs: { role: 'group', 'aria-label': 'Stutter' } }, stutter),
  ]);
}
