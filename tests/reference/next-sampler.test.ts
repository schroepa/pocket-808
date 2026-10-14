import { describe, it } from 'vitest';
import { expectStereo } from './expect.ts';
import type { StereoPrint } from './next/scenarios.ts';
import { runNext } from './run.ts';

const PADS = [
  [0, 'Stab'],
  [1, 'Zap'],
  [2, 'Riser'],
  [3, 'Bell'],
] as const;

describe.concurrent('Neue Engine: Fabrik-Samples', () => {
  for (const [pad, name] of PADS) {
    it(name, async ({ expect }) => {
      const print = await runNext<StereoPrint>('samplerPad', { pad });
      expectStereo(expect, `sampler/${pad}-${name}`, print);
    });
  }
});
