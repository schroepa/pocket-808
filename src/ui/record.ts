import type { RecHit } from '../core/record.ts';
import type { Slot } from '../core/types.ts';
import type { UiContext } from './context.ts';
import { listen } from './dom.ts';

/**
 * Live-Aufnahme (Etappe 8b): Ein Tipp auf eine Spiel-Fläche wird bei scharfer Aufnahme und laufender
 * Wiedergabe auf den nächsten Step gerastet und ins Pattern gesetzt. `make` baut den Schlag aus Step
 * und Slot, `label` nennt ihn im LCD.
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
  store.recordHit(make(pos), audio.takeId.peek());
  readout.flash(`REC · ${label} · Step ${String(pos.step + 1)}`);
}

/**
 * Spiel-Fläche anschließen: Der Schlag zählt beim Antippen (pointerdown), nicht erst beim Loslassen;
 * auf dem iPhone feuert click erst beim Abheben und würde den Schlag um 50–120 ms verspäten. Eine
 * Bedienung per Tastatur (click ohne Zeiger) nimmt ebenfalls auf. `build` liest den Zustand erst
 * beim Tipp und liefert null, wenn nichts aufzunehmen ist.
 */
export function recordTap(
  c: UiContext,
  el: HTMLElement,
  build: () => { make: (pos: { step: number; slot: Slot }) => RecHit; label: string } | null,
): void {
  const fire = (): void => {
    const b = build();
    if (b) recordInput(c, b.make, b.label);
  };
  listen(c.scope, el, 'pointerdown', fire);
  listen(c.scope, el, 'click', (e) => {
    if (e.detail === 0) fire();
  });
}
