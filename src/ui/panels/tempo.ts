import type { UiContext } from '../context.ts';
import { chip } from '../controls/chip.ts';
import { knob } from '../controls/knob.ts';
import { h } from '../dom.ts';
import { tap } from '../tap.ts';
import './tempo.css';

const toTempo = (v: number): number => Math.round(60 + v * 140);

/** Inhalt der Tempo-Fläche: Regler Tempo, Swing, Master und Tap-Tempo (Legacy buildKnobs). */
export function tempoControls(c: UiContext): HTMLElement {
  const { store, scope, readout } = c;
  return h(
    'div',
    { class: 'tempo-controls', attrs: { role: 'group', 'aria-label': 'Tempo und Master' } },
    [
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
      chip(scope, {
        label: 'Tap',
        ariaLabel: 'Tap – Tempo antippen',
        onClick: () => {
          tap(c);
        },
      }),
    ],
  );
}
