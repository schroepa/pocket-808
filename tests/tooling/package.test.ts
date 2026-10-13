import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as {
  dependencies?: Record<string, string>;
  engines?: { node?: string };
};

describe('package.json', () => {
  it('hat keine Laufzeit-Abhängigkeiten', () => {
    expect(pkg.dependencies ?? {}).toEqual({});
  });
  it('verlangt Node 24', () => {
    expect(pkg.engines?.node).toBe('>=24');
  });
});
