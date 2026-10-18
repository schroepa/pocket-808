import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { baseState } from '../core/defaults.ts';
import type { State } from '../core/types.ts';
import { must } from '../core/util.ts';
import { createStore } from '../store/store.ts';
import { createEngine } from './engine.ts';
import type * as GraphModule from './graph.ts';
import type { Graph } from './graph.ts';
import { fakeContext } from './test-utils.ts';
import type { EngineTimer } from './timer.ts';

// Jeder erzeugte Graph bleibt echt, seine Live-Methoden werden nur mitgeschrieben.
const SPIED = vi.hoisted(
  () =>
    [
      'setMaster',
      'applyChannel',
      'applyFx',
      'syncSynth',
      'muteReverb',
      'replaceReverb',
      'stutterOn',
      'stutterOff',
      'punchOn',
      'punchOff',
    ] as const,
);
type Spies = { [K in (typeof SPIED)[number]]: MockInstance<Graph[K]> };
const graphs = vi.hoisted(() => [] as Spies[]);
vi.mock('./graph.ts', async (importOriginal) => {
  const mod = await importOriginal<typeof GraphModule>();
  return {
    ...mod,
    createGraph: (...args: Parameters<typeof mod.createGraph>) => {
      const g = mod.createGraph(...args);
      graphs.push(Object.fromEntries(SPIED.map((k) => [k, vi.spyOn(g, k)])) as unknown as Spies);
      return g;
    },
  };
});

type Mock = ReturnType<typeof vi.fn>;

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
    // Start bei 0,08 s, Tempo 90 mit Swing: Step 1 liegt bei etwa 0,26 s, Step 2 bei 0,41 s
    expect(engine.playhead.value.step).toBe(1);
    engine.stop();
    expect(engine.playing.value).toBe(false);
    expect(engine.playhead.value.step).toBe(-1);
    engine.dispose();
  });

  it('onGesture und resume beim Start, nur einmal', () => {
    const store = createStore(baseState());
    const onGesture = vi.fn();
    const ctx = fakeContext();
    const engine = createEngine({
      store,
      createContext: () => ctx as never,
      timer: manualTimer(),
      prerender: false,
      onGesture,
    });
    engine.start();
    engine.start();
    expect(onGesture).toHaveBeenCalledTimes(1);
    expect(ctx.resume).toHaveBeenCalledTimes(1);
    engine.dispose();
  });

  it('Vorhören und Stutter wecken einen schlafenden Kontext (Tipp vor dem ersten Play)', () => {
    const store = createStore(baseState());
    const onGesture = vi.fn();
    const ctx = fakeContext();
    const engine = createEngine({
      store,
      createContext: () => ctx as never,
      timer: manualTimer(),
      prerender: false,
      onGesture,
    });
    engine.prepare();
    engine.audition('BD');
    engine.auditionNote('BA', 0);
    engine.auditionPad(0);
    engine.stutterOn(0.25);
    expect(onGesture).toHaveBeenCalledTimes(4);
    expect(ctx.resume).toHaveBeenCalledTimes(4);
    engine.dispose();
  });

  it('Vorhören einer Note mit Akkord und Akzent spielt alle Töne, lauter', () => {
    const store = createStore(baseState());
    const ctx = fakeContext();
    const engine = createEngine({
      store,
      createContext: () => ctx as never,
      timer: manualTimer(),
      prerender: false,
    });
    engine.prepare();
    const gains = () =>
      ctx.createGain.mock.results.map((r) => (r.value as { gain: { value: number } }).gain.value);
    const count = (fn: () => void) => {
      const o = ctx.createOscillator.mock.calls.length;
      fn();
      return ctx.createOscillator.mock.calls.length - o;
    };
    const plain = count(() => {
      engine.auditionNote('BA', 0, 1);
    });
    expect(gains()).not.toContainEqual(expect.closeTo(0.81, 5));
    const chord = count(() => {
      engine.auditionNote('BA', 0, 1, { d: 0, l: 1, ch: 'tri', a: true });
    });
    expect(chord).toBe(plain + 4);
    expect(gains()).toContainEqual(expect.closeTo(0.81, 5));
    engine.dispose();
  });

  it('resume weckt nur einen nicht laufenden Kontext und legt keinen an', () => {
    const store = createStore(baseState());
    const ctx = fakeContext();
    const make = vi.fn(() => ctx);
    const engine = createEngine({ store, createContext: make as never, prerender: false });
    engine.resume();
    expect(make).not.toHaveBeenCalled();
    engine.prepare();
    engine.resume();
    expect(ctx.resume).toHaveBeenCalledTimes(1);
    ctx.state = 'running';
    engine.resume();
    expect(ctx.resume).toHaveBeenCalledTimes(1);
    engine.dispose();
  });

  it('dispose stoppt, schließt den Kontext und macht die Engine stumm', () => {
    const store = createStore(baseState());
    const make = vi.fn(fakeContext);
    const timer = manualTimer();
    const engine = createEngine({ store, createContext: make as never, timer, prerender: false });
    engine.start();
    engine.dispose();
    expect(engine.playing.value).toBe(false);
    expect(engine.playhead.value.step).toBe(-1);
    const ctx = must(make.mock.results[0], 'Kontext').value as ReturnType<typeof fakeContext>;
    expect(ctx.close).toHaveBeenCalledTimes(1);
    expect(engine.prepare()).toBe(false);
    engine.start();
    engine.audition('BD');
    expect(engine.playing.value).toBe(false);
    expect(make).toHaveBeenCalledTimes(1);
    engine.dispose();
    expect(ctx.close).toHaveBeenCalledTimes(1);
  });

  it('dispose bricht laufende Reverb- und Neu-Render-Zeitgeber ab', async () => {
    vi.useFakeTimers();
    try {
      const store = createStore(baseState());
      const ctx = fakeContext();
      const createOffline = vi.fn(() => {
        throw new Error('kein Offline-Rendern im Test');
      });
      const engine = createEngine({
        store,
        createContext: () => ctx as never,
        createOffline,
        prerender: false,
      });
      engine.prepare();
      const g = must(graphs.at(-1), 'Graph');
      store.update((st) => ({
        ...st,
        fx: { ...st.fx, size: 0.9 },
        params: { ...st.params, SD: { ...st.params.SD, tune: 0.8 } },
      }));
      await vi.advanceTimersByTimeAsync(160);
      expect(g.muteReverb).toHaveBeenCalledTimes(1);
      expect(createOffline).toHaveBeenCalledTimes(1);
      store.update((st) => ({
        ...st,
        params: { ...st.params, SD: { ...st.params.SD, tune: 0.2 } },
      }));
      engine.dispose();
      await vi.advanceTimersByTimeAsync(500);
      expect(g.replaceReverb).not.toHaveBeenCalled();
      expect(createOffline).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('Offline-Renderings laufen nie parallel, auch nicht mit Neu-Rendern dazwischen', async () => {
    vi.useFakeTimers();
    try {
      const store = createStore(baseState());
      let open = 0;
      let most = 0;
      let total = 0;
      const createOffline = vi.fn((_c: number, n: number) => {
        const oc = fakeContext();
        return {
          ...oc,
          startRendering: () => {
            open++;
            total++;
            most = Math.max(most, open);
            return new Promise((resolve) =>
              setTimeout(() => {
                open--;
                resolve(oc.createBuffer(1, n));
              }, 40),
            );
          },
        };
      });
      const engine = createEngine({
        store,
        createContext: () => fakeContext() as never,
        createOffline: createOffline as never,
        prerender: false,
      });
      const all = engine.prerenderAll();
      const again = engine.prerenderAll();
      await vi.advanceTimersByTimeAsync(100);
      for (const id of ['BD', 'SD', 'CH'] as const)
        store.update((st) => ({
          ...st,
          params: { ...st.params, [id]: { ...st.params[id], decay: 0.1 } },
        }));
      await vi.advanceTimersByTimeAsync(5000);
      await all;
      await again;
      expect(most).toBe(1);
      // zehn Stimmen einmal vorgerendert (zweiter Aufruf teilt den Lauf), drei neu gerendert
      expect(total).toBe(13);
      expect(engine.drumsReady()).toBe(true);
      engine.dispose();
    } finally {
      vi.useRealTimers();
    }
  });

  /** Offline-Fabrik, die jedes Rendering nach 40 ms mit einem leeren Buffer beendet und die Längen mitschreibt */
  const slowOffline = (lengths: number[]) =>
    vi.fn((_c: number, n: number) => {
      const oc = fakeContext();
      return {
        ...oc,
        startRendering: () => {
          lengths.push(n);
          return new Promise((resolve) =>
            setTimeout(() => {
              resolve(oc.createBuffer(1, n));
            }, 40),
          );
        },
      };
    });
  const withLock = (t: number): ReturnType<typeof baseState> => {
    const s = baseState();
    return { ...s, patterns: { ...s.patterns, A: { ...s.patterns.A, opt: { BD: { 0: { t } } } } } };
  };

  it('Lock drehen: nur die zuletzt gewünschte Variante wird gerendert (keine Flut)', async () => {
    vi.useFakeTimers();
    try {
      const lengths: number[] = [];
      const store = createStore(withLock(0.1));
      const engine = createEngine({
        store,
        createContext: () => fakeContext() as never,
        createOffline: slowOffline(lengths) as never,
        prerender: false,
      });
      engine.prepare();
      await vi.advanceTimersByTimeAsync(10);
      for (let i = 1; i <= 30; i++) {
        store.update(() => withLock(0.1 + i / 100));
        await vi.advanceTimersByTimeAsync(10);
      }
      const all = engine.prerenderAll();
      await vi.advanceTimersByTimeAsync(5000);
      await all;
      // zehn Grundstimmen, die erste Variante (0,1) und die letzte (0,4); keine Zwischenwerte
      expect(lengths.length).toBeLessThanOrEqual(13);
      engine.dispose();
    } finally {
      vi.useRealTimers();
    }
  });

  it('beim Start kommen die Grundstimmen vor den Varianten', async () => {
    vi.useFakeTimers();
    try {
      const lengths: number[] = [];
      const store = createStore(withLock(0.3));
      const engine = createEngine({
        store,
        createContext: () => fakeContext() as never,
        createOffline: slowOffline(lengths) as never,
      });
      engine.prepare();
      await vi.advanceTimersByTimeAsync(5000);
      expect(lengths).toHaveLength(11);
      // die Variante (BD, 1,7 s) ist das letzte Rendering, nicht das erste
      expect(lengths.at(-1)).toBe(Math.ceil(44100 * 1.7));
      expect(lengths.at(-2)).not.toBe(Math.ceil(44100 * 1.7));
      engine.dispose();
    } finally {
      vi.useRealTimers();
    }
  });

  it('Punch: ersetzende Effekte lösen sich ab, andere kombinieren; Stopp löst alles', () => {
    const store = createStore(baseState());
    const timer = manualTimer();
    const engine = createEngine({
      store,
      createContext: () => fakeContext() as never,
      timer,
      clock: () => 1,
      prerender: false,
    });
    engine.prepare();
    const g = must(graphs.at(-1), 'Graph');
    const offs = () => g.punchOff.mock.calls.map((c) => c[0]);
    engine.punchOn('tape');
    engine.punchOn('crush');
    expect(offs()).toEqual(['tape']);
    engine.stutterOn(0.5);
    expect(offs()).toEqual(['tape', 'crush']);
    engine.punchOn('loop8');
    expect(g.stutterOff).toHaveBeenCalledTimes(1);
    engine.punchOn('lp');
    engine.punchOn('echo');
    engine.punchOn('half');
    engine.punchOn('echo');
    expect(g.punchOn.mock.calls.map((c) => c[0])).toEqual(['tape', 'crush', 'lp', 'echo']);
    engine.punchOff('crush');
    expect(offs()).toEqual(['tape', 'crush']);
    engine.start();
    engine.stop();
    expect(offs().sort()).toEqual(['crush', 'echo', 'lp', 'tape']);
    expect(g.stutterOff).toHaveBeenCalledTimes(2);
    engine.stutterOff();
    expect(g.stutterOff).toHaveBeenCalledTimes(2);
    engine.dispose();
  });

  it('scope: ohne Kontext false; Analyser erst bei der ersten Anforderung', () => {
    const ctx = fakeContext();
    const engine = createEngine({
      store: createStore(baseState()),
      createContext: () => ctx as never,
      prerender: false,
    });
    const buf = new Float32Array(256);
    expect(engine.scope(buf)).toBe(false);
    engine.prepare();
    expect(ctx.createAnalyser).not.toHaveBeenCalled();
    expect(engine.scope(buf)).toBe(true);
    expect(engine.scope(buf)).toBe(true);
    expect(ctx.createAnalyser).toHaveBeenCalledTimes(1);
    engine.dispose();
  });

  it('prepare meldet einen Fehler beim Aufbau, schließt den Kontext und versucht es erneut', () => {
    const store = createStore(baseState());
    const broken = fakeContext();
    broken.createStereoPanner = vi.fn(() => {
      throw new Error('kein StereoPanner');
    });
    const ok = fakeContext();
    const make = vi.fn().mockReturnValueOnce(broken).mockReturnValueOnce(ok);
    const engine = createEngine({ store, createContext: make as never, prerender: false });
    expect(engine.prepare()).toBe(false);
    expect(broken.close).toHaveBeenCalledTimes(1);
    expect(engine.prepare()).toBe(true);
    expect(make).toHaveBeenCalledTimes(2);
    engine.dispose();
  });

  it('ohne Audio-Unterstützung meldet prepare false, statt zu werfen', () => {
    const store = createStore(baseState());
    const engine = createEngine({
      store,
      createContext: () => {
        throw new Error('kein AudioContext');
      },
      prerender: false,
    });
    expect(engine.prepare()).toBe(false);
    expect(() => {
      engine.start();
      engine.audition('BD');
    }).not.toThrow();
    expect(engine.playing.value).toBe(false);
    engine.dispose();
  });

  it('decode dekodiert über den Kontext und rechnet ins Sample-Format um', async () => {
    const store = createStore(baseState());
    const ctx = fakeContext();
    const engine = createEngine({ store, createContext: () => ctx as never, prerender: false });
    const pcm = await engine.decode(new ArrayBuffer(8));
    expect(ctx.decodeAudioData).toHaveBeenCalledTimes(1);
    expect(pcm.length).toBe(2);
    expect(Math.max(...pcm)).toBeCloseTo(0.9, 5);
    engine.dispose();
  });

  it('decode ohne Audio lehnt ab', async () => {
    const store = createStore(baseState());
    const engine = createEngine({
      store,
      createContext: () => {
        throw new Error('kein AudioContext');
      },
      prerender: false,
    });
    await expect(engine.decode(new ArrayBuffer(8))).rejects.toThrow('Kein Audio');
    engine.dispose();
  });

  it('ein vor prepare entferntes Drum-Sample spielt nicht', () => {
    const store = createStore(baseState());
    const ctx = fakeContext();
    const engine = createEngine({ store, createContext: () => ctx as never, prerender: false });
    engine.setDrumSample('BD', { name: 'x', pcm: new Float32Array(1234) });
    engine.setDrumSample('BD', null);
    engine.audition('BD');
    expect(ctx.createBuffer.mock.calls.some((c) => c[1] === 1234)).toBe(false);
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

  it('Tune/Decay lösen entprellt ein Neu-Rendern aus, Level nicht', async () => {
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
      await vi.advanceTimersByTimeAsync(200);
      expect(createOffline).not.toHaveBeenCalled();
      setParam('tune', 0.6);
      setParam('tune', 0.7);
      await vi.advanceTimersByTimeAsync(89);
      expect(createOffline).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      expect(createOffline).toHaveBeenCalledTimes(1);
      engine.dispose();
    } finally {
      vi.useRealTimers();
    }
  });

  describe('Live-Parameter wirken genau einmal und nur dort, wo sie sollen', () => {
    let store: ReturnType<typeof createStore>;
    let engine: ReturnType<typeof createEngine>;
    let g: Spies;
    const change = (fn: (s: State) => State) => {
      vi.clearAllMocks();
      store.update(fn);
    };
    beforeEach(() => {
      vi.useFakeTimers();
      store = createStore(baseState());
      engine = createEngine({
        store,
        createContext: () => fakeContext() as never,
        createOffline: () => {
          throw new Error('kein Offline-Rendern im Test');
        },
        prerender: false,
      });
      engine.prepare();
      g = must(graphs.at(-1), 'Graph');
    });
    afterEach(() => {
      engine.dispose();
      vi.useRealTimers();
    });

    it('Mute einer Spur betrifft nur diesen Kanal', () => {
      change((s) => ({ ...s, mix: { ...s.mix, BD: { ...s.mix.BD, m: true } } }));
      expect(g.applyChannel).toHaveBeenCalledTimes(1);
      expect(g.applyChannel).toHaveBeenCalledWith('BD', store.state.peek().mix.BD, false, 0);
      expect(g.applyFx).not.toHaveBeenCalled();
      expect(g.syncSynth).not.toHaveBeenCalled();
    });

    it('Pan ändert nur den Kanal, nicht die Hörbarkeit anderer', () => {
      change((s) => ({ ...s, mix: { ...s.mix, CP: { ...s.mix.CP, p: 0.2 } } }));
      expect(g.applyChannel).toHaveBeenCalledTimes(1);
      expect(g.applyChannel).toHaveBeenCalledWith('CP', store.state.peek().mix.CP, true, 0);
    });

    it('Solo schaltet jeden Kanal genau einmal, die Synths synchronisieren', () => {
      change((s) => ({ ...s, mix: { ...s.mix, SD: { ...s.mix.SD, s: true } } }));
      const calls = g.applyChannel.mock.calls;
      expect(calls.map((c) => c[0]).sort()).toEqual(Object.keys(store.state.peek().mix).sort());
      for (const [id, , aud] of calls) expect(aud).toBe(id === 'SD');
      expect(g.syncSynth).toHaveBeenCalledTimes(1);
    });

    it('DJ-Filter und Return gehen an applyFx, der Raum bleibt', () => {
      change((s) => ({ ...s, fx: { ...s.fx, dj: 0.2, ret: 0.4 } }));
      expect(g.applyFx).toHaveBeenCalledTimes(1);
      expect(g.applyFx).toHaveBeenCalledWith(store.state.peek().fx, 0);
      vi.advanceTimersByTime(500);
      expect(g.muteReverb).not.toHaveBeenCalled();
    });

    it('Raumgröße: entprellt ein neuer Hall, kein applyFx', () => {
      change((s) => ({ ...s, fx: { ...s.fx, size: 0.2 } }));
      store.update((s) => ({ ...s, fx: { ...s.fx, size: 0.3, damp: 0.1 } }));
      expect(g.applyFx).not.toHaveBeenCalled();
      vi.advanceTimersByTime(149);
      expect(g.muteReverb).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(g.muteReverb).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(49);
      expect(g.replaceReverb).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(g.replaceReverb).toHaveBeenCalledTimes(1);
      expect(g.replaceReverb.mock.calls[0]?.[1]).toEqual(store.state.peek().fx);
    });

    it('Tempo und Synth-Patch synchronisieren den Synth je einmal', () => {
      change((s) => ({ ...s, tempo: 128 }));
      expect(g.syncSynth).toHaveBeenCalledTimes(1);
      expect(g.syncSynth.mock.calls[0]?.[0].tempo).toBe(128);
      change((s) => ({ ...s, synth: { ...s.synth, LD: { ...s.synth.LD, lvl: 0.1 } } }));
      expect(g.syncSynth).toHaveBeenCalledTimes(1);
      expect(g.applyChannel).not.toHaveBeenCalled();
    });

    it('Master geht nur an setMaster', () => {
      change((s) => ({ ...s, master: 0.4 }));
      expect(g.setMaster).toHaveBeenCalledTimes(1);
      expect(g.setMaster).toHaveBeenCalledWith(0.4, 0);
      expect(g.applyChannel).not.toHaveBeenCalled();
    });

    it('Pattern-Änderungen lösen keinen Live-Parameter aus', () => {
      vi.clearAllMocks();
      store.toggleStep('BD', 3);
      store.placeNote(2, 4);
      for (const k of ['setMaster', 'applyChannel', 'applyFx', 'syncSynth'] as const)
        expect(g[k]).not.toHaveBeenCalled();
    });
  });

  it('Moduswechsel während der Wiedergabe: der Song beginnt wieder vorn', () => {
    const s = baseState();
    s.song = [
      { p: 'A', n: 1 },
      { p: 'B', n: 1 },
    ];
    s.mode = 'song';
    const store = createStore(s);
    const timer = manualTimer();
    let now = 0;
    const bars: number[] = [];
    const engine = createEngine({
      store,
      createContext: () => fakeContext() as never,
      timer,
      clock: () => now,
      prerender: false,
      onScheduled: (e) => {
        if (e.step === 0) bars.push(e.si);
      },
    });
    engine.start();
    const run = (until: number) => {
      for (; now < until; now += 0.025) timer.fire();
    };
    run(1);
    store.setMode('pattern');
    store.setMode('song');
    run(6);
    // ohne Neustart: 0, 1, 0 – mit Neustart beginnt der zweite Takt wieder bei 0
    expect(bars.slice(0, 3)).toEqual([0, 0, 1]);
    engine.dispose();
  });
});
