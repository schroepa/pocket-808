import { describe, expect, it } from 'vitest';
import { mulberry32, seededRandom, tagHash } from './random.ts';

describe('Zufall', () => {
  it('mulberry32 ist reproduzierbar und liegt in [0, 1)', () => {
    const a = mulberry32(7);
    const b = mulberry32(7);
    const xs = Array.from({ length: 50 }, () => a());
    expect(xs).toEqual(Array.from({ length: 50 }, () => b()));
    for (const x of xs) expect(x >= 0 && x < 1).toBe(true);
  });
  it('tagHash ist FNV-1a', () => {
    expect(tagHash('')).toBe(0x811c9dc5);
    expect(tagHash('a')).toBe(0xe40c292c);
  });
  it('seededRandom: eigener Strom je Zweck, „factory“ = Grundstrom', () => {
    const r = seededRandom(1);
    expect(r('factory')()).toBe(mulberry32(1)());
    expect(r('ir')()).toBe(mulberry32(tagHash('1:ir'))());
    expect(r('voice:1')()).not.toBe(r('voice:2')());
  });
});
