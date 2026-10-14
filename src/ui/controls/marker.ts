import type { ReadonlySignal } from '../../store/signals.ts';
import { bind, type Scope } from '../dom.ts';

/** Markiert die Elemente des aktuellen Steps mit einer Klasse; ändert nur alte und neue Spalte. */
export function markColumn(
  scope: Scope,
  step: ReadonlySignal<number>,
  at: (s: number) => readonly Element[],
  cls = 'now',
): void {
  let prev = -1;
  bind(
    scope,
    () => step.value,
    (s) => {
      if (prev >= 0) for (const el of at(prev)) el.classList.remove(cls);
      if (s >= 0) for (const el of at(s)) el.classList.add(cls);
      prev = s;
    },
  );
}
