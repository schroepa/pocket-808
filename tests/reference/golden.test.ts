import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readGolden } from './golden.ts';

describe('readGolden', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('scheitert, wenn die Referenz fehlt und nicht aktualisiert wird', () => {
    vi.stubEnv('REF_UPDATE', '');
    const dir = mkdtempSync(join(tmpdir(), 'golden-'));
    expect(() => readGolden('drums/BD', { a: 1 }, dir)).toThrow(/Referenz fehlt/);
  });

  it('schreibt nur mit REF_UPDATE=1 und liest danach die gespeicherte Referenz', () => {
    const dir = mkdtempSync(join(tmpdir(), 'golden-'));
    vi.stubEnv('REF_UPDATE', '1');
    expect(readGolden('drums/BD', { a: 1 }, dir)).toEqual({ a: 1 });
    expect(JSON.parse(readFileSync(join(dir, 'drums/BD.json'), 'utf8'))).toEqual({ a: 1 });
    vi.stubEnv('REF_UPDATE', '');
    // gespeicherter Wert gewinnt, nicht der aktuelle
    expect(readGolden('drums/BD', { a: 2 }, dir)).toEqual({ a: 1 });
  });
});
