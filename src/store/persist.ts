import { STORAGE_KEY } from '../core/constants.ts';
import { serialize } from '../core/persist.ts';
import type { State } from '../core/types.ts';
import { effect, type ReadonlySignal } from './signals.ts';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface Timer {
  set(fn: () => void, ms: number): unknown;
  clear(handle: unknown): void;
}

export const browserTimer: Timer = {
  set: (fn, ms) => setTimeout(fn, ms),
  clear: (handle) => {
    clearTimeout(handle as ReturnType<typeof setTimeout>);
  },
};

/** Liest einen Wert nur, um im Effekt eine Abhängigkeit anzulegen. */
const dependOn = (value: unknown): unknown => value;

/** Speichert den Zustand entprellt (Legacy save(): 250 ms), nicht beim Start. */
export function persistState(
  state: ReadonlySignal<State>,
  storage: StorageLike,
  opts: { key?: string; delay?: number; timer?: Timer } = {},
): { flush(): void; dispose(): void } {
  const { key = STORAGE_KEY, delay = 250, timer = browserTimer } = opts;
  let handle: unknown = null;
  let first = true;
  const write = (): void => {
    handle = null;
    try {
      storage.setItem(key, JSON.stringify(serialize(state.peek())));
    } catch {
      /* Speicher voll oder gesperrt: wie Legacy still weitermachen */
    }
  };
  const stop = effect(() => {
    dependOn(state.value);
    if (first) {
      first = false;
      return;
    }
    if (handle !== null) timer.clear(handle);
    handle = timer.set(write, delay);
  });
  return {
    flush: () => {
      if (handle === null) return;
      timer.clear(handle);
      write();
    },
    dispose: () => {
      stop();
      if (handle !== null) timer.clear(handle);
      handle = null;
    },
  };
}
