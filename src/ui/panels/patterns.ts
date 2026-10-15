import { PRESETS } from '../../core/constants.ts';
import { computed } from '../../store/signals.ts';
import type { UiContext } from '../context.ts';
import { chip } from '../controls/chip.ts';
import { h } from '../dom.ts';

/** Vorlagen und Pattern-Werkzeuge (Legacy buildPresets, copyPattern, pastePattern, clearAll, undoLast) */
export function patternsPanel(c: UiContext): HTMLElement {
  const { store, scope, readout } = c;
  return h(
    'section',
    {
      class: 'patterns',
      attrs: { 'aria-label': 'Vorlagen und Pattern-Werkzeuge', 'data-area': 'patterns' },
    },
    [
      h('div', { class: 'cap-label', text: 'Vorlagen' }),
      h(
        'div',
        { class: 'chips presets' },
        PRESETS.map((p) =>
          chip(scope, {
            label: p.name,
            active: store.select((s) => s.preset === p.name),
            onClick: () => {
              store.loadPreset(p);
            },
          }),
        ),
      ),
      h('div', { class: 'cap-label', text: 'Pattern' }),
      h('div', { class: 'chips tools' }, [
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
          label: 'Pattern leeren',
          onClick: () => {
            store.clearPattern();
          },
        }),
        chip(scope, {
          label: 'Zurück',
          disabled: computed(() => !store.canUndo.value),
          onClick: () => {
            store.undo();
          },
        }),
      ]),
    ],
  );
}
