import { PARTS, PRESETS, VOICE_IDS } from '../../core/constants.ts';
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
  type Template,
  type TemplateScope,
} from '../../core/templates/index.ts';
import type { State } from '../../core/types.ts';
import { must } from '../../core/util.ts';
import { computed, signal, type ReadonlySignal } from '../../store/signals.ts';
import type { UiContext } from '../context.ts';
import { chip } from '../controls/chip.ts';
import { segment } from '../controls/segment.ts';
import { viewTabs } from '../controls/view-tabs.ts';
import { show } from '../controls/visible.ts';
import { bind, createScope, h } from '../dom.ts';
import type { Layout } from '../layout.ts';
import { partName } from './synth/format.ts';
import { synthSoundList } from './synth/presets.ts';
import './library.css';

/*
 * Modus „Sound“: die Plattenkiste mit Synth-Sounds, Vorlagen, Basis-Mustern und Kits. Neue Stile und
 * Vorlagen erscheinen allein durch die Daten in core/templates.
 */

type Section = 'synth' | 'vorlagen' | 'basis' | 'kits';
const SECTIONS: readonly Section[] = ['synth', 'vorlagen', 'basis', 'kits'];
const NAMES: Readonly<Record<Section, string>> = {
  synth: 'Synth-Sound',
  vorlagen: 'Vorlagen',
  basis: 'Basis-Muster',
  kits: 'Kits',
};
/** mobile eine Seite zur Zeit, sonst alle nebeneinander */
const SINGLE: readonly (readonly Section[])[] = SECTIONS.map((s) => [s]);
const VIEWS: Readonly<Record<Layout, readonly (readonly Section[])[]>> = {
  mobile: SINGLE,
  tablet: [SECTIONS],
  desktop: [SECTIONS],
};
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

const group = (label: string, className: string, children: readonly Node[] = []): HTMLElement =>
  h(
    'div',
    { class: `chips ${className}`, attrs: { role: 'group', 'aria-label': label } },
    children,
  );

/** Umschalter Bass/Lead und die Presets des gewählten Parts */
function synthSection(c: UiContext): Node[] {
  const { store, scope, readout } = c;
  return [
    segment(scope, {
      label: 'Stimme',
      options: PARTS.map((p) => ({ value: p, label: partName(p) })),
      value: store.select((s) => s.part),
      write: (p) => {
        store.update((s) => ({ ...s, part: p }));
      },
    }),
    synthSoundList(c, (part, name) => {
      readout.flash(`${partName(part)} · ${name}`.toUpperCase());
    }),
  ];
}

/** Stil, Vorlagen des Stils, Hinweiszeile und was das Laden ersetzt */
function templateSection(c: UiContext): Node[] {
  const { store, scope, readout } = c;
  const loaded = store.state.peek().preset;
  // Start beim Stil der zuletzt geladenen Vorlage, sonst beim ersten
  const genre = signal<Genre>(
    TEMPLATES.find((t) => t.name === loaded)?.genre ?? must(GENRES[0], 'Stil').id,
  );
  // markiert die zuletzt angetippte Vorlage, auch wenn nur ihr Sound geladen wurde
  const picked = signal(loaded);
  const range = signal<TemplateScope>('all');

  const load = (t: Template): void => {
    const what = range.peek();
    const next = applyTemplate(store.state.peek(), t, what);
    // sonst bliebe nach „Drums“ ein Pattern offen, an dem sich nichts geändert hat; nicht über
    // selectSlot, das würde die Markierung der geladenen Vorlage (preset) löschen
    const stray = what === 'drums' && !t.pat[next.cur];
    picked.value = t.name;
    store.replaceState(stray ? { ...next, cur: 'A' } : next);
    const name = t.name.toUpperCase();
    if (what === 'sound') readout.flash('NUR SOUND GELADEN');
    else if (what === 'drums') readout.flash(`${name} · DRUMS GELADEN`);
    else readout.flash(`${name} · ${String(t.tempo)} BPM`);
  };

  const list = group('Vorlagen des Stils', 'library-templates');
  // Die Liste hängt vom Stil ab: eigener Unter-Scope, der beim Neuaufbau aufgeräumt wird
  let inner = createScope();
  scope.add(() => {
    inner.dispose();
  });
  bind(
    scope,
    () => genre.value,
    (g) => {
      inner.dispose();
      inner = createScope();
      list.replaceChildren(
        ...templatesOf(g).map((t) =>
          chip(inner, {
            label: t.name,
            ariaLabel: `${t.name}: ${t.hint}`,
            active: computed(() => picked.value === t.name),
            onClick: () => {
              load(t);
            },
          }),
        ),
      );
    },
  );
  // Hinweiszeile: die geladene Vorlage des gewählten Stils, sonst wie viele es gibt
  const hint = h('p', { class: 'tpl-hint', attrs: { 'aria-live': 'polite' } });
  bind(
    scope,
    () => {
      const all = templatesOf(genre.value);
      const active = all.find((t) => t.name === store.state.value.preset);
      return active
        ? `${active.name}: ${active.hint} (${String(active.tempo)} BPM)`
        : `${String(all.length)} Vorlagen. Laden ersetzt Pattern A–C, Sounds, Mixer und Song; Zurück macht es rückgängig.`;
    },
    (t) => {
      hint.textContent = t;
    },
  );
  return [
    group(
      'Stil',
      'library-genres',
      GENRES.map((g) =>
        chip(scope, {
          label: g.name,
          active: computed(() => genre.value === g.id),
          onClick: () => {
            genre.value = g.id;
          },
        }),
      ),
    ),
    list,
    hint,
    h('div', { class: 'tpl-scope' }, [
      h('span', { class: 'tpl-scope-label', text: 'Laden' }),
      segment(scope, {
        label: 'Was die Vorlage ersetzt',
        options: TEMPLATE_SCOPES.map((o) => ({ value: o.id, label: o.name })),
        value: range,
        write: (v) => {
          range.value = v;
        },
      }),
    ]),
  ];
}

/** die vier einfachen Drum-Muster */
function basisSection(c: UiContext): Node[] {
  const { store, scope } = c;
  return [
    group(
      NAMES.basis,
      'library-basis',
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
    h('p', { class: 'tpl-hint', text: BASIS_HINT }),
  ];
}

function kitSection(c: UiContext): Node[] {
  const { store, scope, readout } = c;
  return [
    group(
      'Drum-Kit',
      'library-kits',
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
  ];
}

export function library(c: UiContext, layout: ReadonlySignal<Layout>): HTMLElement {
  const { scope } = c;
  const page = signal<Section>('vorlagen');
  const views = computed(() => VIEWS[layout.value]);
  const view = computed(() =>
    must(
      views.value.find((v) => v.includes(page.value)),
      'Ansicht',
    ),
  );
  const bodies: Readonly<Record<Section, (c: UiContext) => Node[]>> = {
    synth: synthSection,
    vorlagen: templateSection,
    basis: basisSection,
    kits: kitSection,
  };
  const sections = SECTIONS.map((id) => {
    // die Überschrift braucht es nur ohne Reiter
    const title = h('div', { class: 'cap-label library-title', text: NAMES[id] });
    const el = h('section', { attrs: { 'data-page': id, 'aria-label': NAMES[id] } }, [
      title,
      ...bodies[id](c),
    ]);
    bind(
      scope,
      () => views.value.length > 1,
      (tabbed) => {
        title.hidden = tabbed;
      },
    );
    bind(
      scope,
      () => view.value.includes(id),
      (on) => {
        show(el, on);
      },
    );
    return el;
  });
  const bar = viewTabs(scope, {
    label: 'Plattenkiste',
    names: NAMES,
    views,
    view,
    write: (p) => {
      page.value = p;
    },
  });
  return h('div', { class: 'library' }, [bar, h('div', { class: 'library-pages' }, sections)]);
}
