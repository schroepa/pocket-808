import { describe, expect, it, vi } from 'vitest';
import { VOICE_IDS } from '../core/constants.ts';
import { baseState } from '../core/defaults.ts';
import { audibleChannels } from '../core/mix.ts';
import { seededRandom } from '../core/random.ts';
import { setDrumDrive } from '../core/tone.ts';
import { must } from '../core/util.ts';
import { createStore } from '../store/store.ts';
import { createEngine } from './engine.ts';
import { createGraph } from './graph.ts';
import { fakeContext, type SimParam } from './test-utils.ts';

interface Node {
  targets: unknown[];
  gain: SimParam;
  oversample?: string;
  connect: { mock: { calls: unknown[][] } };
  disconnect: { mock: { calls: unknown[][] } };
}
type Ctx = ReturnType<typeof fakeContext>;
const made = (f: { mock: { results: { value: unknown }[] } }): Node[] =>
  f.mock.results.map((r) => r.value as Node);
const graphFor = (s = baseState()) => {
  const ctx: Ctx = fakeContext();
  const g = createGraph(ctx as never, s, audibleChannels(s.mix), seededRandom(1));
  const pan = (id: (typeof VOICE_IDS)[number] | 'BA' | 'LD' | 'SM') =>
    g.chan[id].pan as unknown as Node;
  return { ctx, g, bus: g.bus as unknown, pan, drums: VOICE_IDS.map(pan) };
};
const counts = (ctx: Ctx) => ({
  gains: ctx.createGain.mock.calls.length,
  shapers: ctx.createWaveShaper.mock.calls.length,
});
/** wie oft der Knoten mit `target` verbunden bzw. von ihm gelöst wurde */
const calls = (f: { mock: { calls: unknown[][] } }, target: unknown): number =>
  f.mock.calls.filter((c) => c[0] === target).length;

describe('Drum Drive im Graphen', () => {
  it('bei 0 entsteht nichts', () => {
    const plain = graphFor();
    const off = graphFor(setDrumDrive(baseState(), 0));
    expect(off.g.setDrumDrive(0, 1)).toBe(false);
    off.g.releaseDrumDrive();
    expect(counts(off.ctx)).toEqual(counts(plain.ctx));
    for (const p of off.drums) expect(p.disconnect.mock.calls).toHaveLength(0);
  });

  it('ein: ein WaveShaper für alle zehn Drums, BA, LD und SM bleiben am Bus', () => {
    const { ctx, g, bus, pan, drums } = graphFor();
    const before = counts(ctx).shapers;
    expect(g.setDrumDrive(0.5, 1)).toBe(false);
    const added = made(ctx.createWaveShaper).slice(before);
    expect(added).toHaveLength(1);
    expect(must(added[0], 'Shaper').oversample).toBe('2x');
    expect(drums).toHaveLength(10);
    const sum = must(drums[0], 'Panner').targets.at(-1);
    expect(sum).not.toBe(bus);
    for (const p of drums) {
      expect(p.targets.at(-1)).toBe(sum);
      expect(calls(p.disconnect, bus)).toBe(1);
    }
    for (const id of ['BA', 'LD', 'SM'] as const) {
      expect(pan(id).targets).not.toContain(sum);
      expect(calls(pan(id).disconnect, bus)).toBe(0);
    }
  });

  it('Pegel: trocken blendet aus, Vorverstärkung und Ausgleich folgen dem Regler', () => {
    const { ctx, g } = graphFor();
    const before = counts(ctx).gains;
    g.setDrumDrive(0.5, 1);
    const [, dry, pre, post] = made(ctx.createGain).slice(before);
    const drive = 1 + 0.5 * 50;
    expect(dry?.gain.at(0.99)).toBe(1);
    expect(post?.gain.at(0.99)).toBe(0);
    expect(dry?.gain.at(1.03)).toBe(0);
    expect(pre?.gain.at(1.03)).toBeCloseTo((0.7 * drive) / 4, 6);
    expect(post?.gain.at(1.03)).toBeCloseTo(0.13 / Math.tanh(0.7 * drive * 0.13), 6);
    g.setDrumDrive(0, 2);
    expect(dry?.gain.at(2.03)).toBe(1);
    expect(post?.gain.at(2.03)).toBe(0);
  });

  it('Drehen legt keine neuen Knoten an', () => {
    const { ctx, g } = graphFor();
    g.setDrumDrive(0.5, 1);
    const before = counts(ctx);
    expect(g.setDrumDrive(0.9, 2)).toBe(false);
    expect(counts(ctx)).toEqual(before);
  });

  it('aus: true, nach release hängen die Panner wieder am Bus', () => {
    const { ctx, g, bus, drums } = graphFor();
    g.setDrumDrive(0.5, 1);
    const sum = must(drums[0], 'Panner').targets.at(-1);
    const chain = [sum as Node, ...made(ctx.createWaveShaper).slice(-1)];
    expect(g.setDrumDrive(0, 3)).toBe(true);
    g.releaseDrumDrive();
    for (const p of drums) {
      expect(p.targets.at(-1)).toBe(bus);
      expect(calls(p.disconnect, sum)).toBe(1);
    }
    for (const n of chain) expect(n.disconnect.mock.calls.length).toBeGreaterThan(0);
    const before = counts(ctx).shapers;
    g.releaseDrumDrive();
    g.setDrumDrive(0.5, 4);
    expect(counts(ctx).shapers).toBe(before + 1);
  });

  it('schnell aus und wieder an: release baut nichts ab', () => {
    const { g, drums } = graphFor();
    g.setDrumDrive(0.5, 1);
    g.setDrumDrive(0, 1.01);
    g.setDrumDrive(0.5, 1.02);
    const snapshot = () =>
      drums.map((p) => [p.connect.mock.calls.length, p.disconnect.mock.calls.length]);
    const before = snapshot();
    g.releaseDrumDrive();
    expect(snapshot()).toEqual(before);
  });

  it('Anfangszustand direkt', () => {
    const plain = graphFor();
    const { ctx } = graphFor(setDrumDrive(baseState(), 1));
    expect(counts(ctx).shapers).toBe(counts(plain.ctx).shapers + 1);
    for (const n of made(ctx.createGain))
      expect(n.gain.linearRampToValueAtTime.mock.calls).toHaveLength(0);
  });
});

describe('Drum Drive in der Engine', () => {
  const setup = () => {
    const store = createStore(baseState());
    const ctx = fakeContext();
    const engine = createEngine({ store, createContext: () => ctx as never, prerender: false });
    engine.prepare();
    // die ersten Panner gehören den Kanälen, in der Reihenfolge der Drum-Stimmen
    const pan = must(made(ctx.createStereoPanner)[0], 'Panner');
    const bus = must(pan.targets[0], 'Bus');
    const before = counts(ctx).shapers;
    const set = (v: number) => {
      store.update((s) => setDrumDrive(s, v));
    };
    return {
      engine,
      set,
      added: () => counts(ctx).shapers - before,
      atBus: () => pan.targets.at(-1) === bus,
    };
  };

  it('Engine: Regler live, Abbau nach 100 ms', async () => {
    vi.useFakeTimers();
    try {
      const { engine, set, added, atBus } = setup();
      set(0.5);
      expect(added()).toBe(1);
      expect(atBus()).toBe(false);
      set(0);
      await vi.advanceTimersByTimeAsync(99);
      expect(atBus()).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      expect(atBus()).toBe(true);
      set(0.5);
      set(0);
      expect(() => {
        engine.dispose();
      }).not.toThrow();
      await vi.advanceTimersByTimeAsync(200);
      expect(atBus()).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('aus, an, aus innerhalb von 100 ms: Abbau erst 100 ms nach dem letzten Aus', async () => {
    vi.useFakeTimers();
    try {
      const { engine, set, added, atBus } = setup();
      set(0.5);
      set(0);
      await vi.advanceTimersByTimeAsync(60);
      set(0.5);
      await vi.advanceTimersByTimeAsync(30);
      set(0);
      // der Zeitgeber des ersten Aus wäre jetzt fällig, mitten in der Blende
      await vi.advanceTimersByTimeAsync(15);
      expect(atBus()).toBe(false);
      await vi.advanceTimersByTimeAsync(85);
      expect(atBus()).toBe(true);
      expect(added()).toBe(1);
      engine.dispose();
    } finally {
      vi.useRealTimers();
    }
  });
});
