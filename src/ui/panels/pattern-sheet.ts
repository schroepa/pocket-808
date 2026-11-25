import { computed } from '../../store/signals.ts';
import type { UiContext } from '../context.ts';
import { chip } from '../controls/chip.ts';
import { h } from '../dom.ts';
import type { Nav } from '../nav.ts';
import { slots } from './slots.ts';
import './pattern-sheet.css';

/**
 * Inhalt der Pattern-Fläche: Plätze A–H und die Pattern-Werkzeuge. Eine Slot-Wahl schließt die Fläche,
 * die Werkzeuge lassen sie offen.
 */
export function patternSheetContent(c: UiContext, nav: Pick<Nav, 'sheet'>): HTMLElement {
  const { store, scope, readout } = c;
  return h('div', { class: 'pattern-sheet' }, [
    slots(c, () => {
      nav.sheet.value = null;
    }),
    h('div', { class: 'chips' }, [
      chip(scope, {
        label: 'Kopieren',
        onClick: () => {
          store.copy();
          readout.flash(`PATTERN ${store.state.peek().cur} KOPIERT`);
        },
      }),
      chip(scope, {
        label: 'Einfügen',
        disabled: computed(() => !store.canPaste.value),
        onClick: () => {
          store.paste();
          readout.flash(`EINGEFÜGT IN ${store.state.peek().cur}`);
        },
      }),
      chip(scope, {
        label: 'Würfeln',
        ariaLabel: 'Variation würfeln',
        onClick: () => {
          store.vary(Math.random);
          readout.flash('Variation gewürfelt');
        },
      }),
      chip(scope, {
        label: 'Pattern leeren',
        onClick: () => {
          store.clearPattern();
        },
      }),
    ]),
  ]);
}
