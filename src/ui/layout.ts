import { signal, type ReadonlySignal } from '../store/signals.ts';
import { bind, listen, type Scope } from './dom.ts';

export type Layout = 'mobile' | 'tablet' | 'desktop';

export const QUERIES = {
  tablet: '(min-width: 768px)',
  desktop: '(min-width: 1024px)',
  coarse: '(pointer: coarse)',
  /** niedrig: ein Telefon quer (iPads sind auch quer mindestens 744 px hoch) */
  short: '(max-height: 599px)',
} as const;

/**
 * Touch-Geräte ab 768 px sind Tablet (auch quer), ein Telefon quer (Touch, niedrig) bleibt Mobile;
 * Desktop braucht Breite und feinen Zeiger.
 */
export function layoutFor(m: {
  tablet: boolean;
  desktop: boolean;
  coarse: boolean;
  short: boolean;
}): Layout {
  if (!m.tablet || (m.coarse && m.short)) return 'mobile';
  return m.desktop && !m.coarse ? 'desktop' : 'tablet';
}

export function watchLayout(
  scope: Scope,
  win: Pick<Window, 'matchMedia'>,
  root: HTMLElement,
): ReadonlySignal<Layout> {
  const mq = {
    tablet: win.matchMedia(QUERIES.tablet),
    desktop: win.matchMedia(QUERIES.desktop),
    coarse: win.matchMedia(QUERIES.coarse),
    short: win.matchMedia(QUERIES.short),
  };
  const read = (): Layout =>
    layoutFor({
      tablet: mq.tablet.matches,
      desktop: mq.desktop.matches,
      coarse: mq.coarse.matches,
      short: mq.short.matches,
    });
  const layout = signal(read());
  for (const m of Object.values(mq)) {
    listen(scope, m, 'change', () => {
      layout.value = read();
    });
  }
  bind(
    scope,
    () => layout.value,
    (l) => {
      root.dataset.layout = l;
    },
  );
  return layout;
}
