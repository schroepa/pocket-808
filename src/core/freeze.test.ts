import { describe, expect, it } from 'vitest';
import { deepFreeze } from './freeze.ts';

describe('deepFreeze', () => {
  it('friert verschachtelte Objekte ein und gibt sie zurück', () => {
    const o = { a: [1, { b: 2 }] };
    expect(deepFreeze(o)).toBe(o);
    expect(Object.isFrozen(o.a[1])).toBe(true);
  });
  it('lässt Primitive und schon eingefrorene Objekte durch', () => {
    expect(deepFreeze(3)).toBe(3);
    const f = Object.freeze({ x: { y: 1 } });
    deepFreeze(f);
    expect(Object.isFrozen(f.x)).toBe(false);
  });
});
