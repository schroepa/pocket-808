import type { ReadonlySignal } from '../../store/signals.ts';
import { bind, h, listen, type Scope } from '../dom.ts';
import './select.css';

/** Beschriftete Auswahlliste (natives <select>, ideal für Touch und Screenreader). */
export function selectField(
  scope: Scope,
  o: {
    label: string;
    options: readonly string[];
    value: ReadonlySignal<number>;
    write(i: number): void;
  },
): HTMLElement {
  const sel = h(
    'select',
    {},
    o.options.map((name, i) => h('option', { text: name, attrs: { value: String(i) } })),
  );
  bind(
    scope,
    () => o.value.value,
    (i) => {
      sel.value = String(i);
    },
  );
  listen(scope, sel, 'change', () => {
    o.write(Number(sel.value));
  });
  return h('label', { class: 'fld' }, [h('span', { text: o.label }), sel]);
}
