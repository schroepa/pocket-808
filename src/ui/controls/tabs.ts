import { must } from '../../core/util.ts';
import type { ReadonlySignal } from '../../store/signals.ts';
import { bind, h, listen, type Scope } from '../dom.ts';
import './tabs.css';

export interface TabsOptions<T extends string> {
  label: string;
  items: ReadonlySignal<readonly { value: T; label: string }[]>;
  value: ReadonlySignal<T>;
  write(v: T): void;
}

const STEP: Readonly<Partial<Record<string, number>>> = { ArrowRight: 1, ArrowLeft: -1 };

/** Reiter als tablist: ein Tab-Stopp, Pfeile links/rechts wählen und fokussieren (WAI-ARIA). */
export function tabs<T extends string>(scope: Scope, o: TabsOptions<T>): HTMLElement {
  const list = h('div', { class: 'tabs', attrs: { role: 'tablist', 'aria-label': o.label } });
  let items: readonly { value: T; button: HTMLButtonElement }[] = [];
  const indexOf = (v: T): number => items.findIndex((it) => it.value === v);
  const mark = (v: T): void => {
    // ohne passenden Reiter bleibt der erste per Tab erreichbar
    const stop = Math.max(0, indexOf(v));
    items.forEach((it, i) => {
      it.button.setAttribute('aria-selected', String(it.value === v));
      it.button.tabIndex = i === stop ? 0 : -1;
    });
  };
  bind(
    scope,
    () => o.items.value,
    (next) => {
      const focused = list.contains(document.activeElement);
      items = next.map((item) => ({
        value: item.value,
        button: h('button', {
          text: item.label,
          attrs: { type: 'button', role: 'tab' },
          on: {
            click: () => {
              o.write(item.value);
            },
          },
        }),
      }));
      list.replaceChildren(...items.map((it) => it.button));
      mark(o.value.peek());
      if (focused) list.querySelector<HTMLElement>('[tabindex="0"]')?.focus();
    },
  );
  bind(scope, () => o.value.value, mark);
  listen(scope, list, 'keydown', (e) => {
    const d = STEP[e.key];
    if (!d || !items.length) return;
    e.preventDefault();
    const i = Math.max(0, indexOf(o.value.peek()));
    const { value } = must(items[(i + d + items.length) % items.length], 'Reiter');
    o.write(value);
    // erst nach write suchen: write darf die Liste ersetzen
    items[indexOf(value)]?.button.focus();
  });
  return list;
}
