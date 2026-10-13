import { readFileSync, statSync } from 'node:fs';
import { expect, test } from '@playwright/test';

// Ausgangsgröße der gebauten Legacy-App plus 10 % Puffer (Spezifikation: Größenbudget)
const BUDGET_BYTES = 135_140; // 122 854 B × 1,1
const DIST = new URL('../../dist/index.html', import.meta.url);

test.describe('gebaute dist/index.html', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'nur einmal prüfen');

  test('bleibt im Größenbudget', () => {
    expect(statSync(DIST).size).toBeLessThanOrEqual(BUDGET_BYTES);
  });

  test('ist eigenständig: nur Google Fonts als externe Ressource', () => {
    const html = readFileSync(DIST, 'utf8');
    expect(html).not.toMatch(/<script[^>]+src=/);
    const links = [...html.matchAll(/<link[^>]+href="([^"]+)"/g)].map((m) => m[1] ?? '');
    for (const href of links) expect(href).toMatch(/^https:\/\/fonts\.(googleapis|gstatic)\.com/);
  });
});
