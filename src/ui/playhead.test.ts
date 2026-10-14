import { describe, expect, it, vi } from 'vitest';
import { signal } from '../store/signals.ts';
import { createScope } from './dom.ts';
import { drivePlayhead } from './playhead.ts';

describe('drivePlayhead', () => {
  it('tickt pro Bild nur während der Wiedergabe', () => {
    const scope = createScope();
    const playing = signal(false);
    const tick = vi.fn();
    let pending: (() => void) | null = null;
    const raf = {
      request: vi.fn((fn: () => void) => {
        pending = fn;
        return 1;
      }),
      cancel: vi.fn(() => {
        pending = null;
      }),
    };
    const run = () => {
      pending?.();
    };
    drivePlayhead(scope, { playing, tick }, raf);
    expect(raf.request).not.toHaveBeenCalled();
    playing.value = true;
    run();
    run();
    expect(tick).toHaveBeenCalledTimes(2);
    playing.value = false;
    expect(raf.cancel).toHaveBeenCalledTimes(1);
    playing.value = true;
    scope.dispose();
    expect(raf.cancel).toHaveBeenCalledTimes(2);
  });
});
