import { describe, expect, it } from 'vitest';
import { runLegacy } from './run.ts';

describe('Referenz-Infrastruktur', () => {
  it('Kindprozess rendert einen Legacy-Synth-Ton', async () => {
    const r = await runLegacy<{ errors: string[]; peak: number }>('smoke', {});
    expect(r.errors).toEqual([]);
    expect(r.peak).toBeGreaterThan(0.01);
  });

  it('unbekanntes Szenario scheitert mit klarer Meldung', async () => {
    await expect(runLegacy('gibtEsNicht', {}, 1)).rejects.toThrow(/gibtEsNicht/);
  });
});
