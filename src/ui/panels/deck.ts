import type { UiContext } from '../context.ts';
import { knob } from '../controls/knob.ts';
import { bind, h } from '../dom.ts';
import './deck.css';

const toTempo = (v: number): number => Math.round(60 + v * 140);

/** LCD (Tempo, Meldungen) und die Regler Tempo, Swing, Master (Legacy buildKnobs). */
export function deck(c: UiContext): HTMLElement {
  const { store, scope, readout } = c;
  const digits = h('span', { class: 'lcd-digits' });
  bind(
    scope,
    () => store.state.value.tempo,
    (t) => {
      digits.textContent = String(t).padStart(3, '0');
    },
  );
  const sub = h('div', { class: 'lcd-sub' });
  bind(
    scope,
    () => readout.text.value,
    (t) => {
      sub.textContent = t;
    },
  );
  const lcd = h('div', { class: 'lcd', attrs: { role: 'group', 'aria-label': 'Anzeige' } }, [
    h('div', { class: 'lcd-main' }, [digits, h('span', { class: 'lcd-unit', text: 'BPM' })]),
    sub,
  ]);
  const knobs = h('div', { class: 'knob-row' }, [
    knob(scope, {
      label: 'Tempo',
      value: store.select((s) => (s.tempo - 60) / 140),
      write: (v) => {
        store.update((s) => ({ ...s, tempo: toTempo(v) }));
      },
      def: () => (90 - 60) / 140,
      format: (v) => `${toTempo(v)} BPM`,
      readout,
    }),
    knob(scope, {
      label: 'Swing',
      value: store.select((s) => s.swing),
      write: (v) => {
        store.update((s) => ({ ...s, swing: v }));
      },
      def: () => 0,
      format: (v) => `${Math.round(v * 100)} %`,
      readout,
    }),
    knob(scope, {
      label: 'Master',
      value: store.select((s) => s.master),
      write: (v) => {
        store.update((s) => ({ ...s, master: v }));
      },
      def: () => 0.8,
      format: (v) => String(Math.round(v * 100)),
      readout,
    }),
  ]);
  return h(
    'section',
    { class: 'deck', attrs: { 'aria-label': 'Tempo und Master', 'data-area': 'deck' } },
    [lcd, knobs],
  );
}
