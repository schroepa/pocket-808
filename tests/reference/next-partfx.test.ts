import { describe, it } from 'vitest';
import type { PartFxProbe } from './next/scenarios.ts';
import { runNext } from './run.ts';

const SOUNDS = [
  ['BA', 'Sub', 33],
  ['BA', 'Reese', 33],
  ['LD', 'Saw', 69],
] as const;
const run = (part: string, sound: string, midi: number, drive: number, chorus: number) =>
  runNext<PartFxProbe>('partFx', { part, sound, midi, drive, chorus });

describe.concurrent('Drive und Chorus je Part', () => {
  it.for(SOUNDS)('%s %s', async ([part, sound, midi], { expect }) => {
    const [dry, drive, chorus, both, hint] = await Promise.all([
      run(part, sound, midi, 0, 0),
      run(part, sound, midi, 1, 0),
      run(part, sound, midi, 0, 1),
      run(part, sound, midi, 1, 1),
      run(part, sound, midi, 0, 0.001),
    ]);
    expect(dry.side).toBeLessThan(0.001);
    // die stereo geführte Kette ändert den trockenen Pegel nicht
    expect(Math.abs(hint.rmsDb - dry.rmsDb)).toBeLessThan(0.2);
    for (const r of [drive, chorus, both]) {
      expect(Math.abs(r.rmsDb - dry.rmsDb)).toBeLessThanOrEqual(3);
      expect(r.peak).toBeLessThanOrEqual(0.8);
    }
    expect(drive.side).toBeLessThan(0.001);
    expect(chorus.monoDb).toBeGreaterThan(dry.monoDb - 3);
    // der reine Sinus-Sub liegt ganz unter dem Chorus-Hochpass und bleibt mittig
    if (sound === 'Sub') expect(drive.brightness).toBeGreaterThan(dry.brightness * 1.2);
    else expect(chorus.side).toBeGreaterThan(0.15);
    if (part === 'BA') expect(chorus.lowSide).toBeLessThan(0.1);
  });

  it.for([0.5, 0.6, 0.3, 0] as const)(
    'Einschalten ändert weder Pegel noch Delay und Reverb (Panorama %s)',
    async (pan, { expect }) => {
      const at = (chorus: number) =>
        runNext<PartFxProbe>('partFx', {
          part: 'LD',
          sound: 'Saw',
          midi: 69,
          drive: 0,
          chorus,
          send: 0.8,
          pan,
        });
      const [dry, hint] = await Promise.all([at(0), at(0.001)]);
      expect(Math.abs(hint.l - dry.l)).toBeLessThan(dry.l * 0.02);
      expect(Math.abs(hint.r - dry.r)).toBeLessThanOrEqual(dry.l * 0.02);
    },
  );

  it('Demo mit beiden am Anschlag übersteuert nicht', async ({ expect }) => {
    const r = await runNext<{ peak: number }>('partFxMix', {});
    expect(r.peak).toBeLessThanOrEqual(0.8);
  });
});
