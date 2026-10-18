import { afterEach, describe, expect, it, vi } from 'vitest';
import { initialState } from '../../core/initial.ts';
import { makeContext } from '../test-utils.ts';
import { lcdScope } from './lcd-scope.ts';

function fakeRaf() {
  const queue: (() => void)[] = [];
  return {
    request: vi.fn((fn: () => void) => {
      queue.push(fn);
      return queue.length;
    }),
    cancel: vi.fn(),
    step: () => {
      const fns = queue.splice(0);
      for (const f of fns) f();
    },
  };
}
function fakeCanvas() {
  const ctx = {
    setTransform: vi.fn(),
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    lineWidth: 0,
    strokeStyle: '',
    fillStyle: '',
    globalAlpha: 1,
  };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as never);
  return ctx;
}
afterEach(() => {
  vi.restoreAllMocks();
});

describe('LCD-Streifen', () => {
  it('dekorativ; im Stand einmal ruhig gezeichnet, kein Animationslauf', () => {
    const ctx = fakeCanvas();
    const raf = fakeRaf();
    const { c, scope } = makeContext({ state: initialState() });
    const el = lcdScope(c, raf, false);
    expect(el.getAttribute('aria-hidden')).toBe('true');
    expect(raf.request).not.toHaveBeenCalled();
    expect(ctx.stroke).toHaveBeenCalled();
    // 16 Step-Punkte
    expect(ctx.arc).toHaveBeenCalledTimes(16);
    scope.dispose();
  });

  it('beim Spielen: Animationslauf mit Oszilloskop; Stopp beendet ihn', () => {
    const ctx = fakeCanvas();
    const raf = fakeRaf();
    const { c, audio, scope } = makeContext();
    audio.scope.mockImplementation((into: Float32Array) => {
      into.fill(0.5);
      return true;
    });
    lcdScope(c, raf, false);
    audio.playing.value = true;
    expect(raf.request).toHaveBeenCalledTimes(1);
    raf.step();
    expect(audio.scope).toHaveBeenCalled();
    expect(ctx.lineTo.mock.calls.length).toBeGreaterThan(100);
    expect(raf.request).toHaveBeenCalledTimes(2);
    audio.playing.value = false;
    expect(raf.cancel).toHaveBeenCalled();
    scope.dispose();
  });

  it('weniger Bewegung: kein Animationslauf, Neuzeichnen nur beim Step-Wechsel', () => {
    const ctx = fakeCanvas();
    const raf = fakeRaf();
    const { c, audio, scope } = makeContext();
    lcdScope(c, raf, true);
    audio.playing.value = true;
    expect(raf.request).not.toHaveBeenCalled();
    const before = ctx.clearRect.mock.calls.length;
    audio.playhead.value = { step: 3, songIndex: -1 };
    expect(ctx.clearRect.mock.calls.length).toBe(before + 1);
    expect(audio.scope).not.toHaveBeenCalled();
    scope.dispose();
  });

  it('ohne Canvas-Kontext (alte Browser, Tests) passiert nichts', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const raf = fakeRaf();
    const { c, audio, scope } = makeContext();
    lcdScope(c, raf, false);
    audio.playing.value = true;
    raf.step();
    expect(audio.scope).toHaveBeenCalled();
    scope.dispose();
  });
});

describe('LCD-Streifen: Größe', () => {
  it('zeichnet nach einer Größenänderung neu (ResizeObserver) und trennt ihn beim Abbau', () => {
    const ctx = fakeCanvas();
    let cb: () => void = () => undefined;
    const disconnect = vi.fn();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(fn: () => void) {
          cb = fn;
        }
        observe() {
          return undefined;
        }
        disconnect = disconnect;
      },
    );
    const { c, scope } = makeContext();
    lcdScope(c, fakeRaf(), false);
    const before = ctx.clearRect.mock.calls.length;
    cb();
    expect(ctx.clearRect.mock.calls.length).toBe(before + 1);
    scope.dispose();
    expect(disconnect).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
