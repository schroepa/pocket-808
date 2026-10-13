import { describe, it } from 'vitest';
import { expectStereo } from './expect.ts';
import type { StereoPrint } from './legacy/scenarios.ts';
import { runLegacy } from './run.ts';

const PADS = [
  [0, 'Stab'],
  [1, 'Zap'],
  [2, 'Riser'],
  [3, 'Bell'],
] as const;

describe.concurrent('Referenz: Fabrik-Samples', () => {
  for (const [pad, name] of PADS) {
    it(name, async ({ expect }) => {
      const print = await runLegacy<StereoPrint>('samplerPad', { pad });
      expectStereo(expect, `sampler/${pad}-${name}`, print);
    });
  }
});
