import { describe, expect, it, vi } from 'vitest';
import { baseState } from '../core/defaults.ts';
import { createStore } from '../store/store.ts';
import { createEngine } from './engine.ts';
import type { EngineTimer } from './timer.ts';

type Mock = ReturnType<typeof vi.fn>;

/** Minimaler Schein-Kontext: zeichnet nur auf, was geplant wird. */
function fakeContext() {
  const param = () => ({
    value: 0,
    setValueAtTime: vi.fn(),
    setTargetAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(),
    cancelAndHoldAtTime: vi.fn(),
  });
  const node = () => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    gain: param(),
    pan: param(),
    frequency: param(),
    Q: param(),
    detune: param(),
    playbackRate: param(),
    delayTime: param(),
    threshold: param(),
    knee: param(),
    ratio: param(),
    attack: param(),
    release: param(),
    buffer: null,
    curve: null,
    type: '',
    loop: false,
  });
  const buffer = (len: number) => ({
    duration: len / 44100,
    getChannelData: () => new Float32Array(len),
  });
  return {
    sampleRate: 44100,
    currentTime: 0,
    state: 'suspended',
    destination: node(),
    resume: vi.fn(() => Promise.resolve()),
    createGain: vi.fn(node),
    createStereoPanner: vi.fn(node),
    createBiquadFilter: vi.fn(node),
    createDynamicsCompressor: vi.fn(node),
    createWaveShaper: vi.fn(node),
    createDelay: vi.fn(node),
    createConvolver: vi.fn(node),
    createOscillator: vi.fn(node),
    createBufferSource: vi.fn(node),
    createBuffer: vi.fn((_c: number, n: number) => buffer(n)),
  };
}

function manualTimer(): EngineTimer & { fire(): void } {
  let interval: (() => void) | null = null;
  return {
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (h) => {
      clearTimeout(h as ReturnType<typeof setTimeout>);
    },
    setInterval: (fn) => {
      interval = fn;
      return 1;
    },
    clearInterval: () => {
      interval = null;
    },
    fire: () => interval?.(),
  };
}

const gainCalls = (ctx: ReturnType<typeof fakeContext>): number[] =>
  (ctx.createGain.mock.results as { value: { gain: { setTargetAtTime: Mock } } }[]).map(
    (r) => r.value.gain.setTargetAtTime.mock.calls.length,
  );

describe('createEngine', () => {
  it('legt den Kontext erst bei prepare an und nur einmal', () => {
    const store = createStore(baseState());
    const make = vi.fn(fakeContext);
    const engine = createEngine({ store, createContext: make as never, prerender: false });
    expect(make).not.toHaveBeenCalled();
    expect(engine.prepare()).toBe(true);
    expect(engine.prepare()).toBe(true);
    expect(make).toHaveBeenCalledTimes(1);
    engine.dispose();
  });

  it('start plant Steps, stop leert; Abspielposition folgt tick', () => {
    const store = createStore(baseState());
    const timer = manualTimer();
    let now = 0;
    const steps: number[] = [];
    const engine = createEngine({
      store,
      createContext: () => fakeContext() as never,
      timer,
      clock: () => now,
      prerender: false,
      onScheduled: (s) => steps.push(s.step),
    });
    engine.start();
    expect(engine.playing.value).toBe(true);
    expect(steps.length).toBeGreaterThan(0);
    now = 0.3;
    timer.fire();
    engine.tick(0.3);
    expect(engine.playhead.value.step).toBeGreaterThanOrEqual(0);
    engine.stop();
    expect(engine.playing.value).toBe(false);
    expect(engine.playhead.value.step).toBe(-1);
    engine.dispose();
  });

  it('beforeStart läuft vor dem Start (iOS-Entsperren aus platform)', () => {
    const store = createStore(baseState());
    const beforeStart = vi.fn();
    const engine = createEngine({
      store,
      createContext: () => fakeContext() as never,
      timer: manualTimer(),
      prerender: false,
      beforeStart,
    });
    engine.start();
    engine.start();
    expect(beforeStart).toHaveBeenCalledTimes(1);
    engine.dispose();
  });

  it('Song-Modus: tick wählt den gespielten Slot im Store', () => {
    const s = baseState();
    s.song = [{ p: 'B', n: 1 }];
    s.mode = 'song';
    const store = createStore(s);
    const engine = createEngine({
      store,
      createContext: () => fakeContext() as never,
      timer: manualTimer(),
      clock: () => 0,
      prerender: false,
    });
    engine.start();
    engine.tick(1);
    expect(store.state.value.cur).toBe('B');
    expect(engine.playhead.value.songIndex).toBe(0);
    engine.dispose();
  });

  it('Live-Parameter: Master-Änderung plant den neuen Wert, ohne Änderung nichts', () => {
    const store = createStore(baseState());
    const ctx = fakeContext();
    const engine = createEngine({ store, createContext: () => ctx as never, prerender: false });
    engine.prepare();
    const before = gainCalls(ctx);
    store.toggleStep('BD', 0);
    expect(gainCalls(ctx)).toEqual(before);
    store.update((st) => ({ ...st, master: 0.5 }));
    expect(gainCalls(ctx).some((n, i) => n > (before[i] ?? 0))).toBe(true);
    engine.dispose();
  });

  it('Tune/Decay lösen entprellt ein Neu-Rendern aus, Level nicht', () => {
    vi.useFakeTimers();
    try {
      const store = createStore(baseState());
      const createOffline = vi.fn(() => {
        throw new Error('kein Offline-Rendern im Test');
      });
      const engine = createEngine({
        store,
        createContext: () => fakeContext() as never,
        createOffline: createOffline,
        prerender: false,
      });
      engine.prepare();
      const setParam = (k: 'tune' | 'level', v: number) => {
        store.update((st) => ({
          ...st,
          params: { ...st.params, SD: { ...st.params.SD, [k]: v } },
        }));
      };
      setParam('level', 0.3);
      vi.advanceTimersByTime(200);
      expect(createOffline).not.toHaveBeenCalled();
      setParam('tune', 0.6);
      setParam('tune', 0.7);
      vi.advanceTimersByTime(89);
      expect(createOffline).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(createOffline).toHaveBeenCalledTimes(1);
      engine.dispose();
    } finally {
      vi.useRealTimers();
    }
  });
});
