import { describe, expect, it } from 'vitest';
import { setPartFx } from '../core/synth.ts';
import { baseState } from '../core/defaults.ts';
import { audibleChannels } from '../core/mix.ts';
import { seededRandom } from '../core/random.ts';
import { must } from '../core/util.ts';
import { createGraph } from './graph.ts';
import { createPartFx } from './partfx.ts';
import { fakeContext, type SimParam } from './test-utils.ts';

interface Node {
  targets: unknown[];
  gain: SimParam;
  frequency: SimParam;
  curve: unknown;
  oversample?: string;
  start: { mock: { calls: unknown[] } };
  stop: { mock: { calls: unknown[] } };
  disconnect: { mock: { calls: unknown[][] } };
  listeners: [string, () => void][];
}
type Ctx = ReturnType<typeof fakeContext>;
const made = (f: { mock: { results: { value: unknown }[] } }): Node[] =>
  f.mock.results.map((r) => r.value as Node);
const setup = () => {
  const ctx = fakeContext();
  const input = ctx.createGain();
  const output = ctx.createGain();
  input.connect(output);
  ctx.createGain.mockClear();
  const chain = createPartFx(ctx as never, input as never, output as never);
  return { ctx, input, output, chain };
};
const graphFor = (s = baseState()) => {
  const ctx: Ctx = fakeContext();
  const g = createGraph(ctx as never, s, audibleChannels(s.mix), seededRandom(1));
  return { ctx, g };
};

describe('createPartFx', () => {
  it('nur Chorus: zwei laufende LFOs, kein WaveShaper', () => {
    const { ctx, chain } = setup();
    chain.set({ chorus: 0.5 }, 0);
    expect(ctx.createWaveShaper).not.toHaveBeenCalled();
    expect(made(ctx.createOscillator)).toHaveLength(2);
    for (const o of made(ctx.createOscillator)) expect(o.start.mock.calls).toHaveLength(1);
    expect(chain.idle).toBe(false);
  });

  it('nur Drive: ein WaveShaper mit Oversampling, keine Oszillatoren', () => {
    const { ctx, chain } = setup();
    chain.set({ drive: 0.5 }, null);
    expect(made(ctx.createWaveShaper)).toHaveLength(1);
    expect(must(made(ctx.createWaveShaper)[0], 'Shaper').oversample).toBe('2x');
    expect(ctx.createOscillator).not.toHaveBeenCalled();
    chain.set({ drive: 0.9 }, 1);
    expect(made(ctx.createWaveShaper)).toHaveLength(1);
  });

  it('Chorus aus: LFOs stoppen erst nach der Blende, danach getrennt; wieder an legt neue an', () => {
    const { ctx, chain } = setup();
    chain.set({ chorus: 1 }, 0);
    chain.set({}, 1);
    expect(chain.idle).toBe(true);
    const first = made(ctx.createOscillator);
    for (const o of first) {
      const at = must(o.stop.mock.calls[0], 'stop') as [number];
      expect(at[0]).toBeGreaterThan(1.02);
      for (const [, fn] of o.listeners) fn();
    }
    chain.set({ chorus: 0.3 }, 2);
    expect(chain.idle).toBe(false);
    expect(made(ctx.createOscillator)).toHaveLength(4);
  });

  it('dispose stellt den direkten Weg her und stoppt die LFOs', () => {
    const { ctx, input, output, chain } = setup();
    chain.set({ drive: 1, chorus: 1 }, 0);
    input.targets.length = 0;
    chain.dispose();
    expect(input.targets).toContain(output);
    for (const o of made(ctx.createOscillator)) expect(o.stop.mock.calls.length).toBeGreaterThan(0);
  });
});

describe('Graph: Effekte je Part', () => {
  it('ohne Effekte: kein zusätzlicher WaveShaper, Oszillator oder Delay', () => {
    const plain = graphFor();
    const fx = graphFor(setPartFx(setPartFx(baseState(), 'BA', 'drive', 1), 'BA', 'chorus', 1));
    expect(fx.ctx.createWaveShaper.mock.calls.length).toBe(
      plain.ctx.createWaveShaper.mock.calls.length + 1,
    );
    expect(fx.ctx.createDelay.mock.calls.length).toBe(plain.ctx.createDelay.mock.calls.length + 2);
    expect(plain.ctx.createOscillator).not.toHaveBeenCalled();
  });

  it('gespeicherte Effekte wirken beim Aufbau sofort, ohne Blende', () => {
    const { ctx } = graphFor(setPartFx(baseState(), 'LD', 'chorus', 1));
    for (const n of made(ctx.createGain))
      expect(n.gain.linearRampToValueAtTime.mock.calls).toHaveLength(0);
  });

  it('der Pegel liegt hinter den Effekten (lvl), der Eingang bleibt 1', () => {
    const s = baseState();
    const { g } = graphFor(s);
    g.syncSynth(s, { ...audibleChannels(s.mix), BA: false }, 1);
    const inp = g.parts.BA.inp.gain as unknown as SimParam;
    const lvl = g.parts.BA.lvl.gain as unknown as SimParam;
    expect(inp.setTargetAtTime.mock.calls).toHaveLength(0);
    expect(lvl.setTargetAtTime.mock.calls.at(-1)?.[0]).toBe(0);
  });

  it('der Panner-Ausgleich folgt Kette und Panorama', () => {
    const s = baseState();
    const { g } = graphFor(s);
    const trim = g.parts.LD.trim.gain as unknown as SimParam;
    const law = (p: number) => 1 / (2 * Math.cos(((1 - Math.abs(p)) * Math.PI) / 4));
    expect(trim.value).toBe(1);
    g.setPartFx('LD', { chorus: 0.5 }, 1);
    expect(trim.at(1)).toBeCloseTo(law(0));
    g.applyChannel('LD', { ...s.mix.LD, p: 0.8 }, true, 2);
    expect(trim.setTargetAtTime.mock.calls.at(-1)?.[0]).toBeCloseTo(law(0.6));
    g.setPartFx('LD', {}, 3);
    g.releasePartFx('LD');
    expect(trim.setValueAtTime.mock.calls.at(-1)?.[0]).toBe(1);
    g.applyChannel('LD', { ...s.mix.LD, p: 0.2 }, true, 4);
    expect(trim.setTargetAtTime.mock.calls).toHaveLength(1);
  });

  it('gespeicherte Effekte: der Ausgleich stimmt ab dem ersten Sample', () => {
    const s = setPartFx(baseState(), 'BA', 'drive', 1);
    const { g } = graphFor({ ...s, mix: { ...s.mix, BA: { ...s.mix.BA, p: 1 } } });
    expect((g.parts.BA.trim.gain as unknown as SimParam).value).toBeCloseTo(0.5);
  });

  it('setPartFx meldet eine leere Kette; wieder an vor dem Abbau behält sie', () => {
    const { ctx, g } = graphFor();
    expect(g.setPartFx('BA', {}, 0)).toBe(false);
    expect(g.setPartFx('BA', { drive: 0.5 }, 1)).toBe(false);
    expect(g.setPartFx('BA', {}, 2)).toBe(true);
    expect(g.setPartFx('BA', { drive: 0.5 }, 2.01)).toBe(false);
    g.releasePartFx('BA');
    const before = ctx.createWaveShaper.mock.calls.length;
    g.setPartFx('BA', { drive: 0.7 }, 3);
    expect(ctx.createWaveShaper.mock.calls.length).toBe(before);
    g.setPartFx('BA', {}, 4);
    g.releasePartFx('BA');
    g.releasePartFx('BA');
    g.setPartFx('BA', { drive: 0.7 }, 5);
    expect(ctx.createWaveShaper.mock.calls.length).toBe(before + 1);
  });
});
