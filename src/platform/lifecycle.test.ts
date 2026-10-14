import { describe, expect, it, vi } from 'vitest';
import { watchLifecycle } from './lifecycle.ts';

describe('watchLifecycle', () => {
  it('stoppt beim Verbergen und weckt beim Tippen', () => {
    const hidden = vi.fn();
    const pointer = vi.fn();
    const stop = watchLifecycle(document, { hidden, pointer });
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(hidden).toHaveBeenCalledTimes(1);
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(hidden).toHaveBeenCalledTimes(1);
    document.dispatchEvent(new Event('pointerdown'));
    expect(pointer).toHaveBeenCalledTimes(1);
    stop();
    document.dispatchEvent(new Event('pointerdown'));
    expect(pointer).toHaveBeenCalledTimes(1);
  });
});
