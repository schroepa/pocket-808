import { readFileSync, statSync } from 'node:fs';
import { expect, test } from '@playwright/test';

// Größe nach 5c (94 461 B, mit Synth und Sampler) plus 20 % Puffer; nach 5a waren es 70 855 B
const BUDGET_BYTES = 113_360;
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
