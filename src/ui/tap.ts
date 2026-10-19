import { tapTempo } from '../core/tap.ts';
import type { Store } from '../store/store.ts';
import type { UiContext } from './context.ts';

/** Tipp-Zeiten je Store: Knopf und Taste T teilen sich dieselbe Folge */
const folds = new WeakMap<Store, number[]>();

/** Ein Tipp im Takt: setzt ab dem zweiten Tipp das Tempo (ohne Zurück) und meldet es im LCD. */
export function tap(c: UiContext, now = performance.now()): void {
  const r = tapTempo(folds.get(c.store) ?? [], now);
  folds.set(c.store, r.taps);
  const tempo = r.tempo;
  if (tempo === null) {
    c.readout.flash('TAP · weiter tippen');
    return;
  }
  c.store.update((s) => ({ ...s, tempo }));
  c.readout.flash(`TAP · ${String(tempo)} BPM`);
}
