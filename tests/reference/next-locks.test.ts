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

  it('Fill: „Fill“ nur gehalten, „Nicht Fill“ nur losgelassen', async ({ expect }) => {
    const t = await runNext<number[]>('fillHits', {});
    expect(t.map((x) => Math.round((x - 0.08) * 8))).toEqual([8, 16, 40]);
  });
});
