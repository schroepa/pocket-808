import { CHANNEL_NAMES } from '../../core/constants.ts';
import { mixDefaults } from '../../core/defaults.ts';
import { setChannelValue, toggleSolo } from '../../core/mixer.ts';
import { toggleMute } from '../../core/synth.ts';
import type { ChannelId } from '../../core/types.ts';
import { computed, type ReadonlySignal } from '../../store/signals.ts';
import type { UiContext } from '../context.ts';
import { knob } from '../controls/knob.ts';
import { bind, h } from '../dom.ts';
import { panText } from './mixer/format.ts';
import './channel.css';

/* Bedienung eines Mischpult-Kanals: Seite Mix jeder Spur und der gewählte Kanal im Mixer. */

const DEFAULTS = mixDefaults();

type Id = ReadonlySignal<ChannelId>;

/** Mute und Solo des Kanals; `text` ist die sichtbare Beschriftung beider Tasten */
export function muteSolo(c: UiContext, id: Id, text: { m: string; s: string }): HTMLElement[] {
  const { store, scope } = c;
  return (
    [
      ['m', 'stumm', toggleMute],
      ['s', 'solo', toggleSolo],
    ] as const
  ).map(([key, word, toggle]) => {
    const b = h('button', {
      class: `mb ${key}`,
      text: text[key],
      attrs: { type: 'button' },
      on: {
        click: () => {
          const now = id.peek();
          store.update((s) => toggle(s, now));
        },
      },
    });
    bind(
      scope,
      () => `${CHANNEL_NAMES[id.value]} ${word}`,
      (label) => {
        b.setAttribute('aria-label', label);
      },
    );
    bind(
      scope,
      () => store.state.value.mix[id.value][key],
      (on) => {
        b.classList.toggle('on', on);
        b.setAttribute('aria-pressed', String(on));
      },
    );
    return b;
  });
}

const pct = (v: number): string => `${Math.round(v * 100)}%`;

/** Drehregler auf einen Wert des Kanals; die Meldung nennt den Kanal */
function channelKnob(
  c: UiContext,
  id: Id,
  key: 'v' | 'p' | 'r',
  label: string,
  format: (v: number) => string,
  snap?: number,
): HTMLElement {
  const { store, scope, readout } = c;
  return knob(scope, {
    label,
    value: computed(() => store.state.value.mix[id.value][key]),
    write: (v) => {
      const now = id.peek();
      store.update((s) => setChannelValue(s, now, key, v));
    },
    def: () => DEFAULTS[id.peek()][key],
    format,
    readout,
    tag: () => CHANNEL_NAMES[id.peek()].toUpperCase(),
    ...(snap === undefined ? {} : { snap }),
  });
}

/** Pan (rastet in der Mitte) und Reverb-Send */
export function panReverb(c: UiContext, id: Id): HTMLElement[] {
  return [channelKnob(c, id, 'p', 'Pan', panText, 0.5), channelKnob(c, id, 'r', 'Reverb', pct)];
}

/** Level, Pan, Reverb, Mute und Solo eines Kanals; ohne `level`, wo schon ein Fader steht */
export function channelPage(c: UiContext, id: Id, o: { level?: boolean } = {}): HTMLElement {
  const level =
    o.level === false ? [] : [channelKnob(c, id, 'v', 'Level', (v) => String(Math.round(v * 100)))];
  return h('div', { class: 'channel-page' }, [
    h('div', { class: 'ch-buttons' }, muteSolo(c, id, { m: 'Mute', s: 'Solo' })),
    h('div', { class: 'ch-knobs' }, [...level, ...panReverb(c, id)]),
  ]);
}
