import { describe, expect, it } from 'vitest';
import { createScope } from './dom.ts';
import { layoutFor, QUERIES, watchLayout } from './layout.ts';

describe('layoutFor', () => {
  it.each([
    [{ tablet: false, desktop: false, coarse: true }, 'mobile'], // iPhone
    [{ tablet: false, desktop: false, coarse: false }, 'mobile'], // schmales Fenster
    [{ tablet: true, desktop: false, coarse: true }, 'tablet'], // iPad hochkant
    [{ tablet: true, desktop: true, coarse: true }, 'tablet'], // iPad quer: bleibt Tablet
    [{ tablet: true, desktop: false, coarse: false }, 'tablet'], // Desktop-Fenster 768–1023
    [{ tablet: true, desktop: true, coarse: false }, 'desktop'],
  ] as const)('%o → %s', (m, expected) => {
    expect(layoutFor(m)).toBe(expected);
  });
});

function fakeMedia(initial: Record<string, boolean>) {
  const lists = new Map<string, { matches: boolean; fns: Set<() => void> }>();
  return {
    matchMedia(q: string) {
      const entry = lists.get(q) ?? { matches: initial[q] ?? false, fns: new Set<() => void>() };
      lists.set(q, entry);
      return {
        get matches() {
          return entry.matches;
        },
        addEventListener: (_: string, fn: () => void) => entry.fns.add(fn),
        removeEventListener: (_: string, fn: () => void) => entry.fns.delete(fn),
      } as unknown as MediaQueryList;
    },
    set(q: string, v: boolean) {
      const e = lists.get(q);
      if (!e) throw new Error(q);
      e.matches = v;
      for (const fn of e.fns) fn();
    },
    listeners: () => [...lists.values()].reduce((n, e) => n + e.fns.size, 0),
  };
}

describe('watchLayout', () => {
  it('folgt den Media Queries und setzt data-layout', () => {
    const scope = createScope();
    const win = fakeMedia({ [QUERIES.tablet]: true, [QUERIES.coarse]: true });
    const root = document.createElement('html');
    const layout = watchLayout(scope, win, root);
    expect(layout.value).toBe('tablet');
    expect(root.dataset.layout).toBe('tablet');
    win.set(QUERIES.tablet, false);
    expect(root.dataset.layout).toBe('mobile');
    scope.dispose();
    expect(win.listeners()).toBe(0);
  });
});
