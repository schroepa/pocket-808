import { vi, type Mock } from 'vitest';
import { baseState } from '../core/defaults.ts';
import type { State } from '../core/types.ts';
import type { Timer } from '../store/persist.ts';
import { createSampleBank } from '../store/samples.ts';
import { signal } from '../store/signals.ts';
import { createStore } from '../store/store.ts';
import type { UiAudio, UiContext } from './context.ts';
import { createScope } from './dom.ts';
import { createReadout, voiceLine } from './readout.ts';

export interface ManualTimer extends Timer {
  advance(ms: number): void;
  pending(): number;
}

export function manualTimer(): ManualTimer {
  let now = 0;
  let next = 1;
  const jobs = new Map<number, { at: number; fn: () => void }>();
  return {
    set(fn, ms) {
      const id = next++;
      jobs.set(id, { at: now + ms, fn });
      return id;
    },
    clear(h) {
      jobs.delete(h as number);
    },
    advance(ms) {
      now += ms;
      for (const [id, j] of [...jobs].sort((a, b) => a[1].at - b[1].at)) {
        if (j.at <= now) {
          jobs.delete(id);
          j.fn();
        }
      }
    },
    pending: () => jobs.size,
  };
}

export function fakeAudio(available = true) {
  const playing = signal(false);
  const playhead = signal({ step: -1, songIndex: -1 });
  const audio = {
    available,
    playing,
    playhead,
    start: vi.fn(() => {
      playing.value = true;
    }),
    stop: vi.fn(() => {
      playing.value = false;
    }),
    tick: vi.fn(),
    audition: vi.fn(),
    auditionNote: vi.fn(),
    auditionPad: vi.fn(),
    decode: vi.fn(() => Promise.resolve(Float32Array.from([0, 0, 0.5, 0.2]))),
  } satisfies UiAudio;
  return audio;
}

export function makeContext(opts: { state?: State; available?: boolean } = {}) {
  const store = createStore(opts.state ?? baseState());
  const scope = createScope();
  const timer = manualTimer();
  const audio = fakeAudio(opts.available ?? true);
  const storage = new Map<string, string>();
  const samples = createSampleBank(
    {
      getItem: (k) => storage.get(k) ?? null,
      setItem: (k, v) => {
        storage.set(k, v);
      },
    },
    {},
  );
  const files = {
    pickAudio: vi.fn(() =>
      Promise.resolve<{ data: ArrayBuffer; name: string } | null>({
        data: new ArrayBuffer(8),
        name: 'Kick',
      }),
    ),
  };
  const readout = createReadout(scope, voiceLine(store, audio.available), timer);
  const recording: { stop: Mock<() => void>; finish: (b: ArrayBuffer | null) => void } = {
    stop: vi.fn<() => void>(),
    finish: () => undefined,
  };
  const recorder = {
    start: vi.fn(() => {
      const done = new Promise<ArrayBuffer | null>((resolve) => {
        recording.finish = resolve;
      });
      return Promise.resolve<
        { done: Promise<ArrayBuffer | null>; stop(): void } | { error: 'unavailable' | 'denied' }
      >({ done, stop: recording.stop });
    }),
  };
  const c: UiContext = { store, samples, audio, files, recorder, readout, scope };
  return { c, store, audio, files, recorder, recording, timer, scope, storage };
}

/** Zeiger-Ereignis für jsdom (kennt PointerEvent nicht überall) */
export function pointer(
  type: string,
  init: { clientX?: number; clientY?: number; pointerId?: number } = {},
): Event {
  const e = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: init.clientX ?? 0,
    clientY: init.clientY ?? 0,
  });
  Object.defineProperty(e, 'pointerId', { value: init.pointerId ?? 1 });
  return e;
}

/** Anzahl der geänderten DOM-Knoten während fn (für „ändert genau eine Zelle“) */
export async function countMutations(root: Node, fn: () => void): Promise<number> {
  const seen: MutationRecord[] = [];
  const mo = new MutationObserver((r) => seen.push(...r));
  mo.observe(root, { subtree: true, attributes: true, childList: true, characterData: true });
  fn();
  await Promise.resolve();
  seen.push(...mo.takeRecords());
  mo.disconnect();
  return new Set(seen.map((r) => r.target)).size;
}
