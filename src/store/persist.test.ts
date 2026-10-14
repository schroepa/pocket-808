import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_KEY } from '../core/constants.ts';
import { baseState } from '../core/defaults.ts';
import { serialize } from '../core/persist.ts';
import { persistState, type StorageLike } from './persist.ts';
import { createStore } from './store.ts';

function memory(): StorageLike & { writes: string[] } {
  const data = new Map<string, string>();
  const writes: string[] = [];
  return {
    writes,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => {
      writes.push(k);
      data.set(k, v);
    },
  };
}

describe('persistState', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('speichert nicht beim Start, sondern 250 ms nach der letzten Änderung, einmal pro Folge', () => {
    const store = createStore(baseState());
    const mem = memory();
    persistState(store.state, mem);
    vi.advanceTimersByTime(1000);
    expect(mem.writes).toEqual([]);
    store.toggleStep('BD', 0);
    vi.advanceTimersByTime(200);
    store.toggleStep('BD', 1);
    vi.advanceTimersByTime(249);
    expect(mem.writes).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(mem.writes).toEqual([STORAGE_KEY]);
    expect(mem.getItem(STORAGE_KEY)).toBe(JSON.stringify(serialize(store.state.value)));
  });

  it('flush schreibt sofort, dispose verwirft Ausstehendes und beendet das Speichern', () => {
    const store = createStore(baseState());
    const mem = memory();
    const p = persistState(store.state, mem, { key: 'k', delay: 50 });
    store.toggleStep('SD', 2);
    p.flush();
    expect(mem.writes).toEqual(['k']);
    p.flush();
    expect(mem.writes).toEqual(['k']);
    store.toggleStep('SD', 3);
    p.dispose();
    vi.advanceTimersByTime(100);
    store.toggleStep('SD', 4);
    vi.advanceTimersByTime(100);
    expect(mem.writes).toEqual(['k']);
  });

  it('übersteht einen vollen Speicher', () => {
    const store = createStore(baseState());
    const full: StorageLike = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    persistState(store.state, full, { delay: 10 });
    store.toggleStep('BD', 0);
    expect(() => vi.advanceTimersByTime(20)).not.toThrow();
  });
});
