import { describe, it } from 'vitest';
import { must } from '../../src/core/util.ts';
import type { DriveProbe } from './next/scenarios.ts';
import { runNext } from './run.ts';

const probe = (drive: number, mute: 'none' | 'drums' | 'rest') =>
  runNext<DriveProbe>('drumDriveProbe', { drive, mute });

describe.concurrent('Drum Drive', () => {
  it('Drums: knapp über 0 kein Sprung, voll lauter in den Obertönen, Pegel etwa gleich', async ({
    expect,
  }) => {
    const results = await Promise.all([0, 0.02, 0.5, 1].map((d) => probe(d, 'rest')));
    const [dry, hint, half, full] = [0, 1, 2, 3].map((i) => must(results[i], `Messung ${i}`)) as [
      DriveProbe,
      DriveProbe,
      DriveProbe,
      DriveProbe,
    ];
    expect(Math.abs(hint.rmsDb - dry.rmsDb)).toBeLessThan(1);
    for (const r of [half, full]) {
      expect(Math.abs(r.rmsDb - dry.rmsDb)).toBeLessThanOrEqual(3);
      expect(r.peak).toBeLessThanOrEqual(0.8);
    }
    expect(full.brightness).toBeGreaterThan(dry.brightness * 1.1);
  });

  it('Drums: über den ganzen Regelweg gleich laut', async ({ expect }) => {
    const dry = await probe(0, 'rest');
    for (const d of [0.05, 0.2, 0.25, 0.45, 0.8, 1]) {
      const r = await probe(d, 'rest');
      expect(Math.abs(r.rmsDb - dry.rmsDb), `Drive ${String(d)}`).toBeLessThanOrEqual(1);
    }
  });

  it('Bass, Lead und Sampler klingen mit und ohne gleich', async ({ expect }) => {
    const [dry, full] = await Promise.all([probe(0, 'drums'), probe(1, 'drums')]);
    expect(full.peak).toBeCloseTo(dry.peak, 4);
    expect(full.rmsDb).toBeCloseTo(dry.rmsDb, 3);
  });

  it('ganzer Demo-Song voll aufgedreht übersteuert nicht', async ({ expect }) => {
    expect((await probe(1, 'none')).peak).toBeLessThanOrEqual(0.8);
  });
});
