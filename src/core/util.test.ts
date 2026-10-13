import { describe, expect, it } from 'vitest';
import { must } from './util.ts';

describe('must', () => {
  it('gibt vorhandene Werte zurück, auch falsy', () => {
    expect(must(0, 'x')).toBe(0);
    expect(must('', 'x')).toBe('');
    expect(must(null, 'x')).toBeNull();
  });
  it('wirft mit Beschreibung, wenn der Wert fehlt', () => {
    expect(() => must([1][3], 'Eintrag 3')).toThrow('Fehlt: Eintrag 3');
  });
});
