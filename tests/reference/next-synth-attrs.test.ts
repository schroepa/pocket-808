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
  rms: number[];
}
const run = (
  notes: [number, number, number, Record<string, unknown>][],
  patch: Record<string, number> = {},
) => runNext<Result>('synthAttrs', { notes, patch });
/** RMS über gleitende 20-ms-Fenster (länger als eine Periode des Subs) zwischen a und b Sekunden */
const span = (r: Result, a: number, b: number) => {
  const out: number[] = [];
  for (let i = Math.round(a / 0.002); i < Math.round(b / 0.002); i++) {
    const w = r.rms.slice(i, i + 10);
    out.push(Math.sqrt(w.reduce((sum, x) => sum + x * x, 0) / w.length));
  }
  return out;
};

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

  it('Slide ist gebunden: kein Loch und kein Sprung beim Übergang (Sinus)', async ({ expect }) => {
    // Step 2 bei 120 BPM: Einsatz bei 0,08 + 0,25 = 0,33 s
    const r = await run(
      [
        [0, 0, 2, {}],
        [2, 4, 2, { s: true }],
      ],
      { wave: 3 },
    );
    const before = Math.max(...span(r, 0.25, 0.28));
    const around = span(r, 0.29, 0.36);
    expect(Math.min(...around)).toBeGreaterThan(before * 0.5);
    expect(Math.max(...around)).toBeLessThan(before * 1.6);
  });

  it('Slide gleitet nicht aus einer Note, die nur noch im Filter-Release steckt', async ({
    expect,
  }) => {
    const r = await run(
      [
        [0, 0, 1, {}],
        [4, 2, 2, { s: true }],
      ],
      { fr: 1, ar: 0 },
    );
    const second = r.oscs.filter((o) => o.start > 0.2);
    expect(second[0]?.ramps).toEqual([]);
  });

  it('ohne vorige Note spielt Slide normal', async ({ expect }) => {
    const r = await run([[4, 2, 2, { s: true }]]);
    expect(r.oscs[0]?.ramps).toEqual([]);
  });
});
