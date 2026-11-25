import { readFileSync, statSync } from 'node:fs';
import { expect, test } from '@playwright/test';

// Größe mit Vorlagen und Klangcharakter (182 373 B, davon rund 17 kB Vorlagen-Daten) plus 10 % Puffer;
// nach Etappe 8b waren es 153 840 B, nach 6a 140 455 B, nach Etappe 2 114 712 B, nach 5a 70 855 B
const BUDGET_BYTES = 200_000;
const DIST = new URL('../../dist/index.html', import.meta.url);

test.describe('gebaute dist/index.html', () => {
  test.beforeEach(() => {
    test.skip(test.info().project.name !== 'desktop', 'nur einmal prüfen');
  });

  test('bleibt im Größenbudget', () => {
    expect(statSync(DIST).size).toBeLessThanOrEqual(BUDGET_BYTES);
  });
  test('deklariert UTF-8', () => {
    expect(readFileSync(DIST, 'utf8').slice(0, 300)).toMatch(/<meta charset="utf-8"/i);
  });
  test('ist eigenständig: nur Google Fonts extern', () => {
    const html = readFileSync(DIST, 'utf8');
    expect(html).not.toMatch(/<script[^>]+src=/);
    const links = [...html.matchAll(/<link[^>]+href="([^"]+)"/g)].map((m) => m[1] ?? '');
    for (const href of links) expect(href).toMatch(/^https:\/\/fonts\.(googleapis|gstatic)\.com/);
  });
});
