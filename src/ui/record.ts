import type { RecHit } from '../core/record.ts';
import type { Slot } from '../core/types.ts';
import type { Store } from '../store/store.ts';
import type { UiContext } from './context.ts';

/** Welcher Take schon seinen Zurück-Schritt hat, je Store */
const taken = new WeakMap<Store, number>();

/**
 * Live-Aufnahme (Etappe 8b): Ein Tipp auf eine Spiel-Fläche wird bei scharfer Aufnahme und laufender
 * Wiedergabe auf den nächsten Step gerastet und ins Pattern gesetzt. Das erste Ereignis eines Takes
 * legt den Zurück-Schritt an. `make` baut den Schlag aus Step und Slot, `label` nennt ihn im LCD.
 */
export function recordInput(
  c: UiContext,
  make: (pos: { step: number; slot: Slot }) => RecHit,
  label: string,
): void {
  const { audio, store, readout } = c;
  if (!audio.recording.peek() || !audio.playing.peek()) return;
  const pos = audio.nearestStep();
  if (!pos) return;
  const take = audio.takeId.peek();
  if (taken.get(store) !== take) {
    store.beginTake();
    taken.set(store, take);
  }
  store.recordHit(make(pos));
  readout.flash(`REC · ${label} · Step ${String(pos.step + 1)}`);
}
