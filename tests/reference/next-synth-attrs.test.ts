import { describe, it } from 'vitest';
import { runNext } from './run.ts';

interface Osc {
  start: number;
  first: number;
  ramps: number[];
}
interface Result {
  peak: number;
  oscs: Osc[];
}
const run = (notes: [number, number, number, Record<string, unknown>][]) =>
  runNext<Result>('synthAttrs', { notes });

describe.concurrent('Synth: Akzent, Akkord, Slide', () => {
  it('Akzent: lauter (Spitze ≥ 1,2 ×)', async ({ expect }) => {
    const [plain, acc] = await Promise.all([run([[0, 0, 4, {}]]), run([[0, 0, 4, { a: true }]])]);
    expect(acc.peak).toBeGreaterThan(plain.peak * 1.2);
  });

  it('Akkord: drei Töne mit je zwei Oszillatoren, Sub nur für den Grundton', async ({ expect }) => {
    const plain = await run([[0, 0, 4, {}]]);
    const tri = await run([[0, 0, 4, { ch: 'tri' }]]);
    const subs = plain.oscs.length - 2;
    expect(tri.oscs).toHaveLength(6 + subs);
    const tones = new Set(tri.oscs.map((o) => Math.round(o.first)));
    expect(tones.size).toBe(3 + subs);
  });

  it('Slide: die neue Note beginnt bei der Tonhöhe der vorigen und gleitet', async ({ expect }) => {
    const r = await run([
      [0, 0, 2, {}],
      [2, 4, 2, { s: true }],
    ]);
    const first = r.oscs.filter((o) => o.start < 0.2);
    const second = r.oscs.filter((o) => o.start > 0.2);
    const base = first[0]?.first ?? 0;
    expect(second[0]?.first).toBeCloseTo(base, 3);
    expect(second[0]?.ramps[0]).toBeGreaterThan(base * 1.3);
  });

  it('ohne vorige Note spielt Slide normal', async ({ expect }) => {
    const r = await run([[4, 2, 2, { s: true }]]);
    expect(r.oscs[0]?.ramps).toEqual([]);
  });
});
