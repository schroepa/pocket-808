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
  paramLinks: number;
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

describe.concurrent('Synth: Arpeggiator und LFO', () => {
  it('Arp Auf, 1/16: ein Dreiklang über 4 Steps spielt Grundton, Terz, Quinte, Grundton', async ({
    expect,
  }) => {
    const plain = await run([[0, 0, 4, { ch: 'tri' }]]);
    const tones = [...new Set(plain.oscs.map((o) => Math.round(o.first)))].sort((a, b) => a - b);
    const r = await runNext<Result>('synthAttrs', {
      notes: [[0, 0, 4, { ch: 'tri' }]],
      patch: { arp: { m: 'up', r: 1, o: 1 } },
    });
    const starts = [...new Set(r.oscs.map((o) => o.start))];
    expect(starts.map((t) => Math.round(t * 1000))).toEqual([80, 205, 330, 455]);
    const first = starts.map((t) => Math.round(r.oscs.find((o) => o.start === t)?.first ?? 0));
    expect(first).toEqual([tones[1], tones[2], tones[3], tones[1]]); // tones[0] ist der Sub
  });

  it('Arp 1/32 verdoppelt die Töne', async ({ expect }) => {
    const r = await runNext<Result>('synthAttrs', {
      notes: [[0, 0, 2, {}]],
      patch: { arp: { m: 'up', r: 2, o: 2 } },
    });
    expect(new Set(r.oscs.map((o) => o.start)).size).toBe(4);
  });

  it('ohne LFO keine Param-Verbindungen; LFO Cutoff: eine je Note, Pitch: eine je Oszillator', async ({
    expect,
  }) => {
    const notes: [number, number, number, Record<string, unknown>][] = [[0, 0, 8, {}]];
    const [none, cut, pit] = await Promise.all([
      run(notes),
      runNext<Result>('synthAttrs', { notes, patch: { lfo: { r: 0.6, d: 0.8, t: 'cut' } } }),
      runNext<Result>('synthAttrs', { notes, patch: { lfo: { r: 0.6, d: 0.8, t: 'pit' } } }),
    ]);
    expect(none.paramLinks).toBe(0);
    expect(cut.paramLinks).toBe(1);
    expect(pit.paramLinks).toBe(none.oscs.length);
    expect(cut.oscs.length).toBe(none.oscs.length);
  });

  it('LFO auf Cutoff bewegt den Pegel einer gehaltenen Note hörbar', async ({ expect }) => {
    const notes: [number, number, number, Record<string, unknown>][] = [[0, 0, 8, {}]];
    const patch = { as: 1, ad: 0 };
    const [still, wob] = await Promise.all([
      runNext<Result>('synthAttrs', { notes, patch }),
      runNext<Result>('synthAttrs', {
        notes,
        patch: { ...patch, lfo: { r: 0.55, d: 1, t: 'cut' } },
      }),
    ]);
    const spread = (r: Result) => {
      const v = span(r, 0.3, 0.9);
      return Math.max(...v) / Math.min(...v);
    };
    expect(spread(wob)).toBeGreaterThan(spread(still) * 1.5);
  });
});
