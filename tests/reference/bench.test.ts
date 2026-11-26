import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readGolden } from './golden.ts';
import type { BenchResult } from './legacy/scenarios.ts';
import { runLegacy, runNext } from './run.ts';

// Renderzeit schwankt je nach Rechnerlast; Knotenzahl ist deterministisch und wird streng geprüft.
const RENDER_SLACK = 1.5;

describe('Performance-Budget', () => {
  // Legacy und neue Engine messen sich an derselben Referenz (golden/bench)
  for (const [impl, run] of [
    ['Legacy', runLegacy],
    ['neue Engine', runNext],
  ] as const) {
    for (const load of ['demo', 'worst'] as const) {
      it(`${impl}: ${load}`, async () => {
        const r = await run<BenchResult>('bench', { load });
        const g = readGolden(`bench/${load}`, r);
        expect(r.nodesPerSecond, 'Audio-Knoten pro Sekunde').toBeLessThanOrEqual(g.nodesPerSecond);
        expect(r.renderMs, 'Renderzeit 8 s Audio').toBeLessThanOrEqual(g.renderMs * RENDER_SLACK);
      });
    }
  }

  // nur die neue Engine: Drum Drive darf keine Knoten pro Treffer kosten (Vergleich mit der Demo)
  it('neue Engine: Drum Drive', async () => {
    const r = await runNext<BenchResult>('bench', { load: 'drive' });
    // die Demo-Referenz hier nur lesen: readGolden würde sie mit REF_UPDATE=1 überschreiben
    const demo = JSON.parse(
      readFileSync(new URL('./golden/bench/demo.json', import.meta.url), 'utf8'),
    ) as BenchResult;
    const g = readGolden('bench/drive', r);
    expect(r.nodesPerSecond, 'Audio-Knoten pro Sekunde').toBeLessThanOrEqual(demo.nodesPerSecond);
    expect(r.renderMs, 'Renderzeit 8 s Audio').toBeLessThanOrEqual(g.renderMs * RENDER_SLACK);
  });
});
