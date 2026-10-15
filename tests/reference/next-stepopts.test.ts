import { describe, it } from 'vitest';
import { runNext } from './run.ts';

interface Hits {
  bd: { time: number; gain: number }[];
  pad: { time: number; gain: number }[];
}
const bars = (h: Hits['bd']) => h.map((x) => Math.round((x.time - 0.08) / 2) + 1);

describe.concurrent('Step-Optionen in der Engine', () => {
  it('ohne Optionen: jeder Takt, voller Pegel', async ({ expect }) => {
    const h = await runNext<Hits>('stepOptsHits', { bars: 4 });
    expect(bars(h.bd)).toEqual([1, 2, 3, 4]);
    const full = h.bd[0]?.gain ?? 0;
    expect(full).toBeGreaterThan(0.5);
    expect(h.bd.every((x) => x.gain === full)).toBe(true);
  });

  it('Velocity 0,5: Pegel ein Viertel (v²); beim Pad ebenso über lvl', async ({ expect }) => {
    const full = await runNext<Hits>('stepOptsHits', { bars: 1, pad: {} });
    const half = await runNext<Hits>('stepOptsHits', { bars: 1, bd: { v: 0.5 }, pad: { v: 0.5 } });
    expect((half.bd[0]?.gain ?? 0) / (full.bd[0]?.gain ?? 1)).toBeCloseTo(0.25, 6);
    expect((half.pad[0]?.gain ?? 0) / (full.pad[0]?.gain ?? 1)).toBeCloseTo(0.25, 6);
  });

  it('Bedingungen zählen die Durchläufe ab Start', async ({ expect }) => {
    const a = await runNext<Hits>('stepOptsHits', { bars: 4, bd: { c: '1:2' } });
    expect(bars(a.bd)).toEqual([1, 3]);
    const b = await runNext<Hits>('stepOptsHits', {
      bars: 4,
      bd: { c: '4:4' },
      pad: { c: 'first' },
    });
    expect(bars(b.bd)).toEqual([4]);
    expect(b.pad).toHaveLength(1);
  });

  it('Wahrscheinlichkeit: 0 nie, 0,5 etwa die Hälfte', async ({ expect }) => {
    const never = await runNext<Hits>('stepOptsHits', { bars: 2, bd: { p: 0 } });
    expect(never.bd).toEqual([]);
    const some = await runNext<Hits>('stepOptsHits', { bars: 16, bd: { p: 0.5 }, seed: 3 });
    expect(some.bd.length).toBeGreaterThan(3);
    expect(some.bd.length).toBeLessThan(13);
  });
});

describe('Durchläufe bei Wechseln mitten im Takt', () => {
  it('ein angefangener Takt zählt als Durchlauf 1: „Erster“ spielt nur einmal', async ({
    expect,
  }) => {
    const t = await runNext<number[]>('condSwitchHits', {});
    expect(t).toHaveLength(1);
    expect(t[0]).toBeGreaterThan(0.9);
    expect(t[0]).toBeLessThan(2);
  });
});
