import { describe, it } from 'vitest';
import { runNext } from './run.ts';

interface Hit {
  time: number;
  buffer: number;
  rate: number;
  offset: number;
  pad: boolean;
}

describe.concurrent('Parameter-Locks und Fill in der Engine', () => {
  it('Tune-Lock spielt eine eigene Variante, der Normalschlag den Normal-Buffer', async ({
    expect,
  }) => {
    const h = await runNext<Hit[]>('lockHits', {});
    const bd = h.filter((x) => !x.pad);
    expect(bd.map((x) => Math.round((x.time - 0.08) * 8))).toEqual([0, 8, 16, 24]);
    const [a, b, c, d] = bd.map((x) => x.buffer);
    expect(a).not.toBe(b);
    expect(c).toBe(a);
    expect(d).toBe(b);
  });

  it('Pad-Lock: Tune ändert die Rate, Start den Versatz', async ({ expect }) => {
    const h = await runNext<Hit[]>('lockHits', {});
    const pad = h.filter((x) => x.pad);
    expect(pad).toHaveLength(2);
    expect(pad[0]?.rate).toBeCloseTo(Math.pow(2, 0.6), 5);
    expect(pad[0]?.offset).toBeGreaterThan(0);
  });

  it('Chop und Pitch: Slice setzt den Startversatz, Pitch die Rate (±12 Halbtöne = ×2 bzw. ×½)', async ({
    expect,
  }) => {
    // zwei Takte: der erste Durchlauf zählt
    const h = (await runNext<Hit[]>('chopHits', {})).filter((x) => x.pad).slice(0, 4);
    expect(h).toHaveLength(4);
    const [k1, up, down, k3] = h;
    expect(k1?.offset).toBeGreaterThan(0);
    expect(k3?.offset).toBeCloseTo((k1?.offset ?? 0) * 3, 5);
    expect(up?.rate).toBeCloseTo(2, 5);
    expect(up?.offset).toBe(0); // ohne k das ganze Pad
    expect(down?.rate).toBeCloseTo(0.5, 5);
    expect(down?.offset).toBe(0); // Slice 0 beginnt am Anfang
    expect(k1?.rate).toBeCloseTo(1, 5);
  });

  it('Fill: „Fill“ nur gehalten, „Nicht Fill“ nur losgelassen', async ({ expect }) => {
    const t = await runNext<number[]>('fillHits', {});
    expect(t.map((x) => Math.round((x - 0.08) * 8))).toEqual([8, 16, 40]);
  });
});
