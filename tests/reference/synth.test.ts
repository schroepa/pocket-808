import { describe, it } from 'vitest';
import { expectStereo } from './expect.ts';
import type { StereoPrint } from './legacy/scenarios.ts';
import { runLegacy } from './run.ts';

// Bass auf A2 (MIDI 45), Lead auf A4 (MIDI 69)
const CASES = [
  ['BA', 'Sub', 45],
  ['BA', 'Acid', 45],
  ['BA', 'Pluck', 45],
  ['LD', 'Saw', 69],
  ['LD', 'Pulse', 69],
  ['LD', 'Soft', 69],
] as const;

describe.concurrent('Referenz: Synth-Presets', () => {
  for (const [part, preset, midi] of CASES) {
    it(`${part} ${preset}`, async ({ expect }) => {
      const print = await runLegacy<StereoPrint>('synthPreset', { part, preset, midi });
      expectStereo(expect, `synth/${part}-${preset}`, print);
    });
  }
});
