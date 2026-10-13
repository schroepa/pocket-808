import { describe, expect, it } from 'vitest';
import { readGolden } from './golden.ts';
import type { BenchResult } from './legacy/scenarios.ts';
import { runLegacy } from './run.ts';

// Renderzeit schwankt je nach Rechnerlast; Knotenzahl ist deterministisch und wird streng geprüft.
const RENDER_SLACK = 1.5;

describe('Performance-Budget', () => {
  for (const load of ['demo', 'worst'] as const) {
    it(load, async () => {
      const r = await runLegacy<BenchResult>('bench', { load });
      const g = readGolden(`bench/${load}`, r);
      expect(r.nodesPerSecond, 'Audio-Knoten pro Sekunde').toBeLessThanOrEqual(g.nodesPerSecond);
      expect(r.renderMs, 'Renderzeit 8 s Audio').toBeLessThanOrEqual(g.renderMs * RENDER_SLACK);
    });
  }
});
