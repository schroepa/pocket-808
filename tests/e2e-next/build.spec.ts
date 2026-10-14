import { readFileSync, statSync } from 'node:fs';
import { expect, test } from '@playwright/test';

// Ausgangsgröße von dist-next/index.html nach 5a (70 855 B) plus 20 % Puffer
const BUDGET_BYTES = 85_030;
const DIST = new URL('../../dist-next/index.html', import.meta.url);

test.describe('gebaute dist-next/index.html', () => {
  test.beforeEach(() => {
    test.skip(test.info().project.name !== 'next-desktop', 'nur einmal prüfen');
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
