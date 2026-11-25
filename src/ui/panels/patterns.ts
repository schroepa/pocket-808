import { PRESETS, VOICE_IDS } from '../../core/constants.ts';
import {
  applyKit,
  applyTemplate,
  GENRES,
  kitParams,
  KITS,
  TEMPLATE_SCOPES,
  TEMPLATES,
  templatesOf,
  type Genre,
  type TemplateScope,
} from '../../core/templates/index.ts';
import type { State } from '../../core/types.ts';
import { computed, signal } from '../../store/signals.ts';
import type { UiContext } from '../context.ts';
import { chip } from '../controls/chip.ts';
import { segment } from '../controls/segment.ts';
import { bind, createScope, h } from '../dom.ts';

/** Stil-Auswahl: „Basis“ sind die vier einfachen Drum-Muster, der Rest komplette Vorlagen */
type Group = 'basis' | Genre;
const GROUPS: readonly { id: Group; name: string }[] = [{ id: 'basis', name: 'Basis' }, ...GENRES];
const BASIS_HINT = 'Einfache Drum-Muster: ersetzen nur die Drum-Spuren des aktuellen Patterns.';

/** Trägt der Zustand genau dieses Kit? */
const hasKit = (s: State, kit: (typeof KITS)[number]): boolean => {
  const want = kitParams(kit.v);
  return VOICE_IDS.every(
    (id) =>
      s.params[id].level === want[id].level &&
      s.params[id].tune === want[id].tune &&
      s.params[id].decay === want[id].decay,
  );
};

/** Vorlagen und Pattern-Werkzeuge (Legacy buildPresets, copyPattern, pastePattern, clearAll, undoLast) */
export function patternsPanel(c: UiContext): HTMLElement {
  const { store, scope, readout } = c;
  // Start beim Stil der zuletzt geladenen Vorlage, sonst bei den Basis-Mustern
  const group = signal<Group>(
    TEMPLATES.find((t) => t.name === store.state.peek().preset)?.genre ?? 'basis',
  );
  const range = signal<TemplateScope>('all');
  const list = h('div', {
    class: 'chips presets',
    attrs: { role: 'group', 'aria-label': 'Vorlagen des Stils' },
  });
  const hint = h('p', { class: 'tpl-hint', attrs: { 'aria-live': 'polite' } });
  const scopeRow = h('div', { class: 'tpl-scope' }, [
    h('span', { class: 'tpl-scope-label', text: 'Laden' }),
    segment(scope, {
      label: 'Was die Vorlage ersetzt',
      options: TEMPLATE_SCOPES.map((o) => ({ value: o.id, label: o.name })),
      value: range,
      write: (v) => {
        range.value = v;
      },
    }),
  ]);
  // Die Liste hängt vom Stil ab: eigener Unter-Scope, der beim Neuaufbau aufgeräumt wird
  let inner = createScope();
  scope.add(() => {
    inner.dispose();
  });
  bind(
    scope,
    () => group.value,
    (g) => {
      inner.dispose();
      inner = createScope();
      scopeRow.hidden = g === 'basis';
      if (g === 'basis') {
        list.replaceChildren(
          ...PRESETS.map((p) =>
            chip(inner, {
              label: p.name,
              active: store.select((s) => s.preset === p.name),
              onClick: () => {
                store.loadPreset(p);
              },
            }),
          ),
        );
        return;
      }
      list.replaceChildren(
        ...templatesOf(g).map((t) =>
          chip(inner, {
            label: t.name,
            ariaLabel: `${t.name}: ${t.hint}`,
            active: store.select((s) => s.preset === t.name),
            onClick: () => {
              store.replaceState(applyTemplate(store.state.peek(), t, range.peek()));
              readout.flash(`${t.name.toUpperCase()} · ${String(t.tempo)} BPM`);
            },
          }),
        ),
      );
    },
  );
  // Hinweiszeile: die geladene Vorlage des gewählten Stils, sonst wie viele es gibt
  bind(
    scope,
    () => {
      const g = group.value;
      if (g === 'basis') return BASIS_HINT;
      const active = templatesOf(g).find((t) => t.name === store.state.value.preset);
      return active
        ? `${active.name}: ${active.hint} (${String(active.tempo)} BPM)`
        : `${String(templatesOf(g).length)} Vorlagen. Laden ersetzt Pattern A–C, Sounds, Mixer und Song; Zurück macht es rückgängig.`;
    },
    (t) => {
      hint.textContent = t;
    },
  );
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
        { class: 'chips genres', attrs: { role: 'group', 'aria-label': 'Stil' } },
        GROUPS.map((g) =>
          chip(scope, {
            label: g.name,
            active: computed(() => group.value === g.id),
            onClick: () => {
              group.value = g.id;
            },
          }),
        ),
      ),
      list,
      hint,
      scopeRow,
      h('div', { class: 'cap-label', text: 'Kit' }),
      h(
        'div',
        { class: 'chips kits', attrs: { role: 'group', 'aria-label': 'Drum-Kit' } },
        KITS.map((k) =>
          chip(scope, {
            label: k.name,
            ariaLabel: `Kit ${k.name}: ${k.hint}`,
            active: store.select((s) => hasKit(s, k)),
            onClick: () => {
              store.replaceState(applyKit(store.state.peek(), k.v));
              readout.flash(`KIT ${k.name.toUpperCase()}`);
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
