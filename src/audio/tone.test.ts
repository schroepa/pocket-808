import { describe, expect, it, vi } from 'vitest';
import { baseState } from '../core/defaults.ts';
import { audibleChannels } from '../core/mix.ts';
import { setTape, setWarm } from '../core/tone.ts';
import type { State, VoiceId } from '../core/types.ts';
import { createStore } from '../store/store.ts';
import { createDrumBank } from './drums.ts';
import { tapeCurve, tapeSettings, TAPE_RANGE, vinylNoise } from './dsp.ts';
import { createEngine } from './engine.ts';
import { createGraph } from './graph.ts';
import { synthNote } from './synth.ts';
import { fakeContext } from './test-utils.ts';
import { VOICE_FN } from './voices.ts';

type Ctx = ReturnType<typeof fakeContext>;
type Mock = ReturnType<typeof vi.fn>;
interface FakeNode {
  targets: unknown[];
  type: string;
  curve: Float32Array | null;
  stop: Mock;
  disconnect: Mock;
  frequency: { value: number; setTargetAtTime: Mock };
  gain: { value: number; setTargetAtTime: Mock };
  playbackRate: { value: number };
}
const made = (m: Mock): FakeNode[] => (m.mock.results as { value: FakeNode }[]).map((r) => r.value);
const rnd = () => () => 0.5;
const graphOf = (ctx: Ctx, s: State) => createGraph(ctx as never, s, audibleChannels(s.mix), rnd);

describe('Tape-Rechnung', () => {
  it('Kennlinie: ungerade, bei kleinen Pegeln Verstärkung 1, Spitzen weich begrenzt', () => {
    const c = tapeCurve(1);
    const mid = c.length / 2;
    expect(c[0]).toBeCloseTo(-(c[c.length - 1] ?? 0), 6);
    // Steigung in der Mitte: Ausgang ≈ Eingang (Eingang in Einheiten von TAPE_RANGE)
    const dx = (2 / (c.length - 1)) * TAPE_RANGE;
    expect(((c[mid] ?? 0) - (c[mid - 1] ?? 0)) / dx).toBeCloseTo(1, 2);
    expect(c[c.length - 1]).toBeLessThan(TAPE_RANGE * 0.6);
    // ohne Tape praktisch linear
    expect(tapeCurve(0)[c.length - 1]).toBeGreaterThan(TAPE_RANGE * 0.98);
  });

  it('Regler: mehr Tape = dumpfer, mehr Eiern, mehr Rauschen; begrenzt auf 0..1', () => {
    const off = tapeSettings(0);
    const full = tapeSettings(1);
    expect(off).toEqual({ lp: 18000, wow: 0, flutter: 0, noise: 0 });
    expect(full.lp).toBeCloseTo(4200, 6);
    expect(full.wow).toBeGreaterThan(tapeSettings(0.5).wow);
    expect(full.noise).toBeGreaterThan(tapeSettings(0.5).noise);
    expect(tapeSettings(5)).toEqual(full);
    expect(tapeSettings(-1)).toEqual(off);
  });

  it('Rauschen: leise mit vereinzelten Knacksern, wiederholbar', () => {
    let seed = 1;
    const lcg = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    const a = vinylNoise(8000, 2, lcg);
    expect(a).toHaveLength(16000);
    const loud = a.filter((x) => Math.abs(x) > 0.3).length;
    expect(loud).toBeGreaterThan(0);
    expect(loud).toBeLessThan(400);
    expect(a.every((x) => Math.abs(x) <= 1.3)).toBe(true);
    seed = 1;
    expect(Array.from(vinylNoise(8000, 2, lcg).subarray(0, 50))).toEqual(
      Array.from(a.subarray(0, 50)),
    );
  });
});

describe('Master-Klang im Graphen', () => {
  it('ohne Warm und Tape entsteht keine Kette', () => {
    const ctx = fakeContext();
    graphOf(ctx, baseState());
    expect(ctx.createBufferSource).not.toHaveBeenCalled();
    // nur das Synth-Delay
    expect(ctx.createDelay).toHaveBeenCalledTimes(1);
  });

  it('Warm im Startzustand: Kette im Signalweg, Kuhschwänze gesetzt, Tape neutral', () => {
    const ctx = fakeContext();
    graphOf(ctx, setWarm(baseState(), true));
    const shelves = made(ctx.createBiquadFilter).filter((n) => n.type.endsWith('shelf'));
    expect(shelves.map((n) => [n.type, n.gain.value])).toEqual([
      ['lowshelf', 2],
      ['highshelf', -3],
    ]);
    expect(made(ctx.createBufferSource)).toHaveLength(1);
    const lp = made(ctx.createBiquadFilter).find((n) => n.frequency.value === 18000);
    expect(lp?.type).toBe('lowpass');
  });

  it('Tape live: Kette wird angelegt, geändert und wieder abgebaut', () => {
    const ctx = fakeContext();
    const g = graphOf(ctx, baseState());
    g.setTone({ warm: false, tape: 0.5 }, 1);
    const [src] = made(ctx.createBufferSource);
    const shaper = made(ctx.createWaveShaper).at(-1);
    const first = shaper?.curve;
    expect(first).toBeInstanceOf(Float32Array);
    // gleiche Einstellung: nichts passiert
    g.setTone({ warm: false, tape: 0.5 }, 1.5);
    expect(made(ctx.createBufferSource)).toHaveLength(1);
    // stärker: neue Kennlinie, Tiefpass weich nachgeführt
    g.setTone({ warm: true, tape: 1 }, 2);
    expect(shaper?.curve).not.toBe(first);
    const lp = made(ctx.createBiquadFilter).find((n) =>
      n.frequency.setTargetAtTime.mock.calls.some((c) => Math.abs((c[0] as number) - 4200) < 1e-6),
    );
    expect(lp).toBeDefined();
    // zurück auf dieselbe Stufe: Kennlinie aus dem Zwischenspeicher
    g.setTone({ warm: true, tape: 0.5 }, 2.5);
    expect(shaper?.curve).toBe(first);
    // aus: Quellen stoppen, beim nächsten Einschalten entsteht eine neue Kette
    g.setTone({ warm: false, tape: 0 }, 3);
    expect(src?.stop).toHaveBeenCalledWith(3);
    g.setTone({ warm: true, tape: 0 }, 4);
    expect(made(ctx.createBufferSource)).toHaveLength(2);
  });

  it('Abbau übersteht Knoten, die sich nicht trennen oder stoppen lassen', () => {
    const ctx = fakeContext();
    const g = graphOf(ctx, setTape(baseState(), 0.3));
    for (const n of [...made(ctx.createBiquadFilter), ...made(ctx.createOscillator)]) {
      n.disconnect.mockImplementation(() => {
        throw new Error('nicht verbunden');
      });
      n.stop.mockImplementation(() => {
        throw new Error('schon gestoppt');
      });
    }
    expect(() => {
      g.setTone({ warm: false, tape: 0 }, 1);
    }).not.toThrow();
    expect(() => {
      g.setTone({ warm: true, tape: 0 }, 2);
    }).not.toThrow();
  });

  it('Bandrauschen nur während der Wiedergabe, Zeiten nie negativ', () => {
    const ctx = fakeContext();
    const g = graphOf(ctx, setTape(baseState(), 1));
    const hiss = made(ctx.createGain).find((n) =>
      (made(ctx.createBufferSource)[0]?.targets ?? []).includes(n),
    );
    expect(hiss?.gain.value).toBe(0);
    g.setPlaying(true, -0.08);
    expect(hiss?.gain.setTargetAtTime).toHaveBeenLastCalledWith(tapeSettings(1).noise, 0, 0.05);
    // Regler während der Wiedergabe: Rauschen folgt
    g.setTone({ warm: false, tape: 0.5 }, 1);
    expect(hiss?.gain.setTargetAtTime).toHaveBeenLastCalledWith(tapeSettings(0.5).noise, 1, 0.03);
    g.setPlaying(false, 2);
    expect(hiss?.gain.setTargetAtTime).toHaveBeenLastCalledWith(0, 2, 0.05);
    // ohne Kette passiert nichts
    const plain = graphOf(fakeContext(), baseState());
    expect(() => {
      plain.setPlaying(true, 0);
    }).not.toThrow();
  });
});

describe('Warm in den Stimmen', () => {
  const note = (ctx: Ctx, warm: boolean, drift?: number) =>
    synthNote({
      ctx: ctx as never,
      dest: ctx.createGain() as never,
      patch: baseState().synth.BA,
      midis: [45],
      time: 0,
      duration: 0.2,
      previous: undefined,
      ...(warm ? { warm } : {}),
      ...(drift === undefined ? {} : { drift }),
    });

  it('Synth: zweiter Tiefpass, Sättigung vor dem Filter und Driften nur mit Warm', () => {
    const plain = fakeContext();
    note(plain, false, 1);
    expect(plain.createBiquadFilter).toHaveBeenCalledTimes(1);
    expect(plain.createWaveShaper).not.toHaveBeenCalled();
    const warm = fakeContext();
    const v = note(warm, true, 1);
    expect(warm.createBiquadFilter).toHaveBeenCalledTimes(2);
    expect(warm.createWaveShaper).toHaveBeenCalledTimes(1);
    const detunes = (c: Ctx) =>
      (c.createOscillator.mock.results as { value: { detune: { value: number } } }[]).map(
        (r) => r.value.detune.value,
      );
    // Verstimmung der beiden Oszillatoren gemeinsam um das Driften verschoben
    expect((detunes(warm)[0] ?? 0) - (detunes(plain)[0] ?? 0)).toBeCloseTo(5, 6);
    expect(v.oscs.length).toBeGreaterThan(1);
    // ohne Zufallswert kein Driften
    const still = fakeContext();
    note(still, true);
    expect(detunes(still)[0]).toBeCloseTo(detunes(plain)[0] ?? 0, 6);
  });

  it('Drums: mit Warm zusätzliche Filter bzw. Sättigung', () => {
    const count = (voice: VoiceId, warm: boolean) => {
      const ctx = fakeContext();
      VOICE_FN[voice](
        {
          ctx: ctx as never,
          out: ctx.createGain() as never,
          noise: ctx.createBuffer(1, 10) as never,
          kick: new Float32Array(2),
          rnd: () => 0.5,
          choke: { gain: null },
          warm,
        },
        0,
        { level: 1, tune: 0.5, decay: 0.5 },
      );
      return {
        filters: ctx.createBiquadFilter.mock.calls.length,
        shapers: ctx.createWaveShaper.mock.calls.length,
      };
    };
    expect(count('CH', true).filters).toBe(count('CH', false).filters + 2);
    expect(count('SD', true).filters).toBe(count('SD', false).filters + 1);
    expect(count('LT', true).shapers).toBe(count('LT', false).shapers + 1);
    expect(count('BD', true)).toEqual(count('BD', false));
  });

  const bank = (ctx: Ctx, warm: boolean, createOffline: Mock) =>
    createDrumBank({
      graph: graphOf(ctx, baseState()),
      createOffline: createOffline as never,
      random: () => () => 1,
      timer: {
        setTimeout: (fn) => {
          fn();
          return 0;
        },
        clearTimeout: () => undefined,
        setInterval: () => 0,
        clearInterval: () => undefined,
      },
      params: () => baseState().params,
      ...(warm ? { warm: () => true } : {}),
    });
  const offline = () =>
    vi.fn(() => {
      const oc = fakeContext();
      return { ...oc, startRendering: () => Promise.resolve(oc.createBuffer(1, 100)) };
    });

  it('Treffer: mit Warm leicht andere Tonhöhe und anderer Pegel, ohne nicht', async () => {
    for (const warm of [false, true]) {
      const ctx = fakeContext();
      const b = bank(ctx, warm, offline());
      await b.prerenderAll();
      b.hit('BD', 0, { level: 0.5, tune: 0.5, decay: 0.5 });
      const src = made(ctx.createBufferSource).at(-1);
      const g = made(ctx.createGain).at(-1);
      expect(src?.playbackRate.value).toBe(warm ? 1.003 : 0);
      if (warm) expect(g?.gain.value).toBeCloseTo(0.5 * 1.03, 6);
      else expect(g?.gain.value).toBe(0.5);
    }
  });

  it('ohne fertigen Buffer spielt die Live-Stimme mit dem gewählten Charakter', () => {
    const ctx = fakeContext();
    const fail = vi.fn(() => {
      throw new Error('kein Offline-Rendern');
    });
    bank(ctx, true, fail).hit('CH', 0, { level: 1, tune: 0.5, decay: 0.5 });
    expect(made(ctx.createBiquadFilter).filter((n) => n.type === 'bandpass')).toHaveLength(2);
  });

  it('refresh rendert alle Stimmen und die gewünschten Varianten neu', async () => {
    const createOffline = offline();
    const b = bank(fakeContext(), true, createOffline);
    await b.prerenderAll();
    b.wantVariants([{ voice: 'SD', tune: 0.2, decay: 0.4 }]);
    await b.prerenderAll();
    const before = createOffline.mock.calls.length;
    expect(before).toBe(11);
    b.refresh();
    // eine noch ausstehende Variante wird nicht doppelt eingereiht
    b.wantVariants([
      { voice: 'SD', tune: 0.2, decay: 0.4 },
      { voice: 'BD', tune: 0.9, decay: 0.1 },
    ]);
    b.refresh();
    await b.prerenderAll();
    expect(createOffline.mock.calls.length).toBe(before + 10 + 1 + 1 + 10);
  });
});

describe('Engine und Klangcharakter', () => {
  it('Warm umschalten rendert die Drums neu und stellt den Master um; Noten klingen warm', async () => {
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
      engine.schedule.note('BA', [45], 0, 0.1);
      expect(ctx.createWaveShaper).toHaveBeenCalledTimes(2);
      store.update((s) => setWarm(s, true));
      await vi.advanceTimersByTimeAsync(10);
      expect(createOffline).toHaveBeenCalledTimes(10);
      expect(made(ctx.createBufferSource)).toHaveLength(1);
      const shapers = ctx.createWaveShaper.mock.calls.length;
      engine.schedule.note('BA', [45], 1, 0.1);
      expect(ctx.createWaveShaper.mock.calls.length).toBe(shapers + 1);
      // Tape ändert nur den Master, die Drums bleiben
      store.update((s) => setTape(s, 0.5));
      await vi.advanceTimersByTimeAsync(10);
      expect(createOffline).toHaveBeenCalledTimes(10);
      engine.dispose();
    } finally {
      vi.useRealTimers();
    }
  });

  it('Start und Stopp schalten das Bandrauschen', () => {
    const store = createStore(setTape(baseState(), 1));
    const ctx = fakeContext();
    const engine = createEngine({ store, createContext: () => ctx as never, prerender: false });
    engine.start();
    const hiss = made(ctx.createGain).find((n) =>
      (made(ctx.createBufferSource)[0]?.targets ?? []).includes(n),
    );
    expect(hiss?.gain.setTargetAtTime.mock.calls.at(-1)?.[0]).toBe(tapeSettings(1).noise);
    engine.stop();
    expect(hiss?.gain.setTargetAtTime.mock.calls.at(-1)?.[0]).toBe(0);
    engine.dispose();
  });
});
