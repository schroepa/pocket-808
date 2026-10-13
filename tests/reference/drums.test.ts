import { describe, it } from 'vitest';
import type { Fingerprint } from '../support/fingerprint.ts';
import { expectPrint } from './expect.ts';
import { runLegacy } from './run.ts';

const VOICES = ['BD', 'SD', 'LT', 'HT', 'RS', 'CP', 'CB', 'CH', 'OH', 'CY'] as const;
const VARIANTS = {
  default: {},
  tune0: { tune: 0 },
  tune1: { tune: 1 },
  decay0: { decay: 0 },
  decay1: { decay: 1 },
};

describe.concurrent('Referenz: Drum-Stimmen', () => {
  for (const voice of VOICES) {
    it(voice, async ({ expect }) => {
      const prints = await runLegacy<Record<string, Fingerprint>>('drumVariants', {
        voice,
        variants: VARIANTS,
      });
      for (const [variant, print] of Object.entries(prints)) {
        expectPrint(expect, `drums/${voice}-${variant}`, print);
      }
    });
  }
});
