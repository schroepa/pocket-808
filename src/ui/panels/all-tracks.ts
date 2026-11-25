import { CHANNEL_NAMES, PAD_COUNT, VOICE_IDS } from '../../core/constants.ts';
import { currentPattern } from '../../core/pattern.ts';
import { selectPad } from '../../core/sampler.ts';
import { stepIsOn } from '../../core/stepopts.ts';
import type { Part, VoiceId } from '../../core/types.ts';
import { computed } from '../../store/signals.ts';
import type { UiContext } from '../context.ts';
import { stepButton } from '../controls/step-button.ts';
import { bind, createScope, h, type Scope } from '../dom.ts';
import type { Nav } from '../nav.ts';
import { trackTap } from '../track.ts';
import {
  markPlayhead,
  markSteps,
  noteButton,
  padHasSub,
  padKeyOf,
  padOn,
  pressDrumStep,
  pressPadStep,
  sixteen,
} from './step-area.ts';
import { optLook } from './step-opts.ts';
import { drumOn, drumSub } from './voice.ts';
import './all-tracks.css';

/*
 * „Alle Spuren“: Drums, Bass, Lead und Sampler-Pads als Raster mit je 16 Steps. Ein Tipp in eine Zelle
 * wählt die Spur; bei Drums und Pads schaltet er den Step, bei Bass und Lead öffnet er die Noten.
 */

const PARTS: readonly Part[] = ['BA', 'LD'];
const PADS: readonly number[] = Array.from({ length: PAD_COUNT }, (_, i) => i);

const label = (text: string, name: string): HTMLButtonElement =>
  h('button', {
    class: 'at-lab',
    text,
    attrs: { type: 'button', 'aria-label': `Zeile ${name}` },
  });

/** Beschriftung und 16 Zellen; die Zeile der gewählten Spur ist markiert */
function row(
  c: UiContext,
  lab: HTMLButtonElement,
  cells: readonly HTMLButtonElement[],
  selected: () => boolean,
): HTMLElement {
  const el = h('div', { class: 'at-row' }, [lab, h('div', { class: 'at-cells' }, cells)]);
  bind(c.scope, selected, (on) => {
    el.classList.toggle('sel', on);
    lab.setAttribute('aria-pressed', String(on));
  });
  return el;
}

function drumRow(c: UiContext, nav: Nav, voice: VoiceId): HTMLElement {
  const { store, scope } = c;
  const name = CHANNEL_NAMES[voice];
  const selected = (): boolean => nav.track.value === voice;
  const cells = sixteen((s) => {
    const b = stepButton(scope, {
      label: `${name} Step ${s + 1}`,
      class: 'at-cell',
      on: drumOn(store, () => voice, s),
      sub: drumSub(store, () => voice, s),
      onPress: () => {
        nav.selectTrack(voice);
        pressDrumStep(c, nav, voice, s);
      },
    });
    optLook(scope, store, () => voice, s, b);
    return b;
  });
  markSteps(c, cells, nav.drumSub, nav.drumOpt, selected);
  const lab = label(voice, name);
  trackTap(c, nav, lab, voice);
  return row(c, lab, cells, selected);
}

function partRow(c: UiContext, nav: Nav, part: Part): HTMLElement {
  const name = CHANNEL_NAMES[part];
  const cells = sixteen((s) =>
    noteButton(c, () => part, s, {
      label: `${name} Step ${s + 1}`,
      class: 'at-cell',
      onPress: () => {
        // openNotes wählt keine Spur
        nav.selectTrack(part);
        nav.openNotes(s);
      },
    }),
  );
  markPlayhead(c, cells);
  const lab = label(part, name);
  trackTap(c, nav, lab, part);
  return row(c, lab, cells, () => nav.track.value === part);
}

function padRow(c: UiContext, nav: Nav, pad: number): HTMLElement {
  const { store, scope } = c;
  const name = `Pad ${String(pad + 1)}`;
  const key = padKeyOf(pad);
  const sel = store.select((s) => s.smp.sel === pad);
  const selected = (): boolean => nav.track.value === 'SM' && sel.value;
  const pick = (): void => {
    store.update((s) => selectPad(s, pad));
    nav.selectTrack('SM');
  };
  const cells = sixteen((s) => {
    const b = stepButton(scope, {
      label: `${name} Step ${s + 1}`,
      class: 'at-cell',
      on: padOn(store, () => key, s),
      sub: padHasSub(store, () => key, s),
      onPress: () => {
        pick();
        pressPadStep(c, nav, pad, s);
      },
    });
    optLook(scope, store, () => key, s, b);
    return b;
  });
  markSteps(c, cells, nav.padSub, nav.padOpt, selected);
  const lab = label(`P${String(pad + 1)}`, name);
  trackTap(c, nav, lab, 'SM', pad);
  return row(c, lab, cells, selected);
}

/**
 * Die Pad-Zeilen: Pads mit Inhalt (Sample oder Steps im offenen Pattern) und immer das gewählte. Nur
 * was dazukommt oder wegfällt, wird gebaut bzw. abgeräumt; bestehende Zeilen bleiben stehen.
 */
function padRows(c: UiContext, nav: Nav, root: HTMLElement): void {
  const listed = computed(() => {
    const s = c.store.state.value;
    const p = currentPattern(s);
    const samples = c.samples.pads.value;
    return PADS.filter(
      (i) =>
        i === s.smp.sel ||
        !!samples[i] ||
        sixteen((step) => stepIsOn(p, padKeyOf(i), step)).includes(true),
    ).join();
  });
  const rows = new Map<number, { el: HTMLElement; scope: Scope }>();
  bind(
    c.scope,
    () => listed.value,
    (keys) => {
      const want = keys.split(',').map(Number);
      for (const [i, r] of rows) {
        if (want.includes(i)) continue;
        r.scope.dispose();
        r.el.remove();
        rows.delete(i);
      }
      // von hinten einfügen, damit bestehende Zeilen nicht bewegt werden (Fokus)
      let next: HTMLElement | null = null;
      for (const i of want.reverse()) {
        let r = rows.get(i);
        if (!r) {
          const scope = createScope();
          r = { scope, el: padRow({ ...c, scope }, nav, i) };
          rows.set(i, r);
          root.insertBefore(r.el, next);
        }
        next = r.el;
      }
    },
  );
  c.scope.add(() => {
    for (const r of rows.values()) r.scope.dispose();
  });
}

export function allTracks(c: UiContext, nav: Nav): HTMLElement {
  const root = h('section', { class: 'all-tracks', attrs: { 'aria-label': 'Alle Spuren' } }, [
    ...VOICE_IDS.map((v) => drumRow(c, nav, v)),
    ...PARTS.map((p) => partRow(c, nav, p)),
  ]);
  padRows(c, nav, root);
  return root;
}
