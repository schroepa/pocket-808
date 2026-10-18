import type { State } from '../core/types.ts';
import { must } from '../core/util.ts';
import { signal, type ReadonlySignal } from '../store/signals.ts';
import type { UiContext } from './context.ts';
import { bind, h, listen, type Scope } from './dom.ts';
import type { Layout } from './layout.ts';
import './devices.css';

export type DeviceId = keyof State['open'];

export interface Device {
  id: DeviceId;
  name: string;
  summary: ReadonlySignal<string>;
  body(scope: Scope): HTMLElement;
}

const ROLE_ATTRS = [
  'role',
  'aria-selected',
  'aria-expanded',
  'aria-controls',
  'aria-labelledby',
  'tabindex',
];
const ARROWS: Readonly<Partial<Record<string, number>>> = { ArrowRight: 1, ArrowLeft: -1 };

/** Geräte (Synth, Sampler, Mixer, FX): Akkordeon (mobile), Tabs (tablet) oder alle offen (desktop). */
export function devices(
  c: UiContext,
  layout: ReadonlySignal<Layout>,
  list: readonly Device[],
): HTMLElement {
  const { store, scope } = c;
  const tab = signal<DeviceId | null>(list[0]?.id ?? null);
  const items = list.map((d) => {
    const sum = h('span', { class: 'dev-sum' });
    bind(
      scope,
      () => d.summary.value,
      (t) => {
        sum.textContent = t;
      },
    );
    const head = h(
      'button',
      { class: 'dev-head', attrs: { type: 'button', id: `dev-head-${d.id}` } },
      [
        h('span', { class: 'led', attrs: { 'aria-hidden': 'true' } }),
        h('span', { class: 'plate', text: d.name }),
        sum,
      ],
    );
    const body = h(
      'section',
      { class: 'dev-body', attrs: { id: `dev-${d.id}`, 'data-area': d.id, 'aria-label': d.name } },
      [h('h2', { class: 'dev-name', text: d.name }), d.body(scope)],
    );
    return { id: d.id, head, body };
  });
  const headBox = h(
    'div',
    { class: 'dev-heads' },
    items.map((it) => it.head),
  );
  const root = h('section', { class: 'devices', attrs: { 'data-area': 'devices' } }, [
    headBox,
    h(
      'div',
      { class: 'dev-bodies' },
      items.map((it) => it.body),
    ),
  ]);
  root.hidden = items.length === 0;

  listen(scope, headBox, 'click', (e) => {
    const it = items.find((x) => x.head.contains(e.target as Node));
    if (!it) return;
    if (layout.peek() === 'mobile') {
      store.update((s) => ({ ...s, open: { ...s.open, [it.id]: !s.open[it.id] } }));
    } else tab.value = it.id;
  });
  listen(scope, headBox, 'keydown', (e) => {
    const d = ARROWS[e.key];
    if (layout.peek() !== 'tablet' || !d) return;
    e.preventDefault();
    const i = items.findIndex((x) => x.id === tab.peek());
    const next = must(items[(i + d + items.length) % items.length], 'Gerät');
    tab.value = next.id;
    next.head.focus();
  });

  // Vor dem Darstellen: Gerät mit Fokus bleibt sichtbar (als Tab gewählt bzw. aufgeklappt)
  bind(
    scope,
    () => layout.value,
    (l) => {
      const f = items.find((x) => x.body.contains(document.activeElement))?.id;
      if (!f) return;
      if (l === 'tablet') tab.value = f;
      if (l === 'mobile' && !store.state.peek().open[f]) {
        store.update((s) => ({ ...s, open: { ...s.open, [f]: true } }));
      }
    },
  );
  bind(
    scope,
    () => ({ l: layout.value, open: store.state.value.open, t: tab.value }),
    ({ l, open, t }) => {
      headBox.hidden = l === 'desktop';
      if (l === 'tablet') {
        headBox.setAttribute('role', 'tablist');
        headBox.setAttribute('aria-label', 'Geräte');
      } else {
        headBox.removeAttribute('role');
        headBox.removeAttribute('aria-label');
      }
      for (const { id, head, body } of items) {
        for (const a of ROLE_ATTRS) {
          head.removeAttribute(a);
          body.removeAttribute(a);
        }
        if (l === 'mobile') {
          head.setAttribute('aria-expanded', String(open[id] === true));
          head.setAttribute('aria-controls', body.id);
          body.hidden = open[id] !== true;
        } else if (l === 'tablet') {
          head.setAttribute('role', 'tab');
          head.setAttribute('aria-selected', String(t === id));
          head.setAttribute('aria-controls', body.id);
          head.tabIndex = t === id ? 0 : -1;
          body.setAttribute('role', 'tabpanel');
          body.setAttribute('aria-labelledby', head.id);
          body.hidden = t !== id;
        } else body.hidden = false;
      }
    },
  );
  return root;
}
