import { must } from '../../core/util.ts';
import type { ReadonlySignal } from '../../store/signals.ts';
import { bind, h, listen, type Scope } from '../dom.ts';
import './segment.css';

export interface SegmentOptions<T extends string> {
  label: string;
  options: readonly { value: T; label: string }[];
  value: ReadonlySignal<T>;
  write(v: T): void;
}

const STEP: Readonly<Partial<Record<string, number>>> = {
  ArrowRight: 1,
  ArrowDown: 1,
  ArrowLeft: -1,
  ArrowUp: -1,
};

/** Umschalter als radiogroup: ein Tab-Stopp, Pfeiltasten wählen und fokussieren (WAI-ARIA). */
export function segment<T extends string>(scope: Scope, o: SegmentOptions<T>): HTMLElement {
  const g = h('div', { class: 'seg', attrs: { role: 'radiogroup', 'aria-label': o.label } });
  const items = o.options.map((opt) => ({
    value: opt.value,
    button: h('button', {
      text: opt.label,
      attrs: { type: 'button', role: 'radio' },
      on: {
        click: () => {
          o.write(opt.value);
        },
      },
    }),
  }));
  g.append(...items.map((it) => it.button));
  bind(
    scope,
    () => o.value.value,
    (v) => {
      for (const it of items) {
        it.button.setAttribute('aria-checked', String(it.value === v));
        it.button.tabIndex = it.value === v ? 0 : -1;
      }
    },
  );
  listen(scope, g, 'keydown', (e) => {
    const d = STEP[e.key];
    if (!d) return;
    e.preventDefault();
    const i = items.findIndex((it) => it.value === o.value.peek());
    const next = must(items[(i + d + items.length) % items.length], 'Option');
    o.write(next.value);
    next.button.focus();
  });
  return g;
}
