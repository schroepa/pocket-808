import { SLOTS } from '../../core/constants.ts';
import { patternHasContent } from '../../core/pattern.ts';
import type { UiContext } from '../context.ts';
import { bind, h } from '../dom.ts';
import './deck.css';

/** Pattern-Plätze A–H: wählen, Auswahl und Inhaltspunkt (Legacy buildSlots). */
export function slots(c: UiContext): HTMLElement {
  const group = h('div', {
    class: 'slots',
    attrs: { role: 'group', 'aria-label': 'Pattern wählen', 'data-area': 'slots' },
  });
  for (const k of SLOTS) {
    const sel = c.store.select((s) => s.cur === k);
    const has = c.store.select((s) => patternHasContent(s.patterns[k]));
    const b = h('button', {
      class: 'slot',
      text: k,
      attrs: { type: 'button', 'aria-label': `Pattern ${k}` },
      on: {
        click: () => {
          c.store.selectSlot(k);
        },
      },
    });
    bind(
      c.scope,
      () => sel.value,
      (v) => {
        b.classList.toggle('sel', v);
        b.setAttribute('aria-pressed', String(v));
      },
    );
    bind(
      c.scope,
      () => has.value,
      (v) => {
        b.classList.toggle('has', v);
      },
    );
    group.append(b);
  }
  return group;
}
