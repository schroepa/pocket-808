import { describe, expect, it } from 'vitest';
import { TEMPLATES } from '../../src/core/templates/index.ts';
import type { TemplateLevels } from './next/scenarios.ts';
import { runNext } from './run.ts';

/*
 * Jede Vorlage wird mit der echten Engine offline gerendert (Song-Modus, sechs Takte). Geprüft wird,
 * was sich messen lässt: kein Übersteuern, keine kaputten Samples, hörbarer Pegel im üblichen
 * Bereich, keine langen Löcher. Wie gut eine Vorlage klingt, entscheidet das Ohr.
 */
describe('Vorlagen: Pegel mit der echten Engine', () => {
  it.concurrent.each(TEMPLATES.map((t) => [t.id] as const))('%s', async (id) => {
    const r = await runNext<TemplateLevels>('templateLevels', { id });
    expect(r.nonFinite).toBe(0);
    // Limiter und Sicherheits-Shaper halten die Spitze beim abgestimmten Master-Pegel
    expect(r.peak).toBeLessThanOrEqual(0.8);
    expect(r.peak).toBeGreaterThan(0.5);
    // weder zu leise noch platt gedrückt
    expect(r.rmsDb).toBeGreaterThan(-16);
    expect(r.rmsDb).toBeLessThan(-6);
    expect(r.active).toBeGreaterThan(0.6);
  });
});
