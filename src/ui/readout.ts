import { VOICES } from '../core/constants.ts';
import { must } from '../core/util.ts';
import type { Timer } from '../store/persist.ts';
import { computed, signal, type ReadonlySignal } from '../store/signals.ts';
import type { Store } from '../store/store.ts';
import type { Scope } from './dom.ts';

/** LCD-Unterzeile: Grundzeile (gewählte Stimme) oder kurz eine Meldung (Legacy readout). */
export interface Readout {
  readonly text: ReadonlySignal<string>;
  flash(text: string): void;
}

export function createReadout(
  scope: Scope,
  base: ReadonlySignal<string>,
  timer: Timer,
  ms = 1400,
): Readout {
  const message = signal<string | null>(null);
  let handle: unknown = null;
  scope.add(() => {
    if (handle !== null) timer.clear(handle);
  });
  return {
    text: computed(() => message.value ?? base.value),
    flash(text) {
      if (handle !== null) timer.clear(handle);
      message.value = text;
      handle = timer.set(() => {
        handle = null;
        message.value = null;
      }, ms);
    },
  };
}

export function voiceLine(store: Store, available: boolean): ReadonlySignal<string> {
  if (!available) return signal('Kein Audio in diesem Browser');
  return store.select((s) => {
    const v = must(VOICES[s.sel], 'Stimme');
    return `${v.id} · ${v.name}`;
  });
}
