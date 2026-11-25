import { currentPattern, subStepsOf } from '../../core/pattern.ts';
import { stepIsOn } from '../../core/stepopts.ts';
import { noteAt } from '../../core/synth.ts';
import type { Part, State, SubKey, VoiceId } from '../../core/types.ts';
import { must } from '../../core/util.ts';
import { computed, type ReadonlySignal, type Signal } from '../../store/signals.ts';
import type { Store } from '../../store/store.ts';
import type { UiContext } from '../context.ts';
import { markColumn } from '../controls/marker.ts';
import { stepButton, type StepButtonOptions } from '../controls/step-button.ts';
import { show } from '../controls/visible.ts';
import { bind, h } from '../dom.ts';
import { kindOf, type EditorSub, type Nav, type TrackKind } from '../nav.ts';
import { hearPad } from './sampler/common.ts';
import { optLook, type EditorOpt } from './step-opts.ts';
import { drumOn, drumSub, selectedVoice, toggleWithAudition } from './voice.ts';
import './step-area.css';

/*
 * Der Step-Bereich des Geräts: je Spurart ein Raster aus 16 Steps. Drums und Pads schalten Steps,
 * bei Bass und Lead zeigt das Raster, wo Noten liegen.
 */

/** Ein Tipp auf einen Step: im Sub-Modus wählen, im Opt-Modus wählen und einschalten, sonst schalten */
function pressStep(
  c: UiContext,
  sub: Signal<EditorSub>,
  opt: Signal<EditorOpt>,
  key: SubKey,
  step: number,
  toggle: () => void,
): void {
  if (sub.peek().on) sub.value = { on: true, step };
  else if (opt.peek().on) {
    if (!stepIsOn(currentPattern(c.store.state.peek()), key, step)) toggle();
    opt.value = { on: true, step };
  } else toggle();
}

export function pressDrumStep(
  c: UiContext,
  nav: Pick<Nav, 'drumSub' | 'drumOpt'>,
  voice: VoiceId,
  step: number,
): void {
  pressStep(c, nav.drumSub, nav.drumOpt, voice, step, () => {
    toggleWithAudition(c, voice, step);
  });
}

export function pressPadStep(
  c: UiContext,
  nav: Pick<Nav, 'padSub' | 'padOpt'>,
  pad: number,
  step: number,
): void {
  pressStep(c, nav.padSub, nav.padOpt, padKeyOf(pad), step, () => {
    c.store.toggleSampleStep(pad, step);
    // nur vorhören, wenn der Step dadurch an ist und nichts läuft
    const row = must(currentPattern(c.store.state.peek()).smp[pad], 'Sampler-Reihe');
    if (row[step] === 1 && !c.audio.playing.peek()) hearPad(c, pad);
  });
}

/**
 * Auswahl (Sub bzw. Opt) und Lauflicht einer Step-Reihe; ohne Modus keine Auswahl. `active` sagt, ob
 * die Auswahl diese Reihe meint.
 */
export function markSteps(
  c: UiContext,
  buttons: readonly HTMLElement[],
  sub: ReadonlySignal<EditorSub>,
  opt: ReadonlySignal<EditorOpt>,
  active: () => boolean = () => true,
): void {
  bind(
    c.scope,
    () => {
      if (!active()) return -1;
      return sub.value.on ? sub.value.step : opt.value.on ? opt.value.step : -1;
    },
    (n) => {
      buttons.forEach((b, i) => b.classList.toggle('subsel', i === n));
    },
  );
  markPlayhead(c, buttons);
}

export function markPlayhead(c: UiContext, buttons: readonly HTMLElement[]): void {
  markColumn(
    c.scope,
    computed(() => c.audio.playhead.value.step),
    (s) => buttons.slice(s, s + 1),
  );
}

export const sixteen = <T>(fn: (step: number) => T): T[] =>
  Array.from({ length: 16 }, (_, s) => fn(s));
/** jeder vierte Step ist heller */
const beat = (base: string, step: number): string => (step % 4 === 0 ? `${base} q` : base);

export const padKeyOf = (pad: number): SubKey => `P${pad}` as SubKey;

/** Pad-Step klingt: gesetzt oder mit Sub-Steps belegt */
export const padOn = (
  store: Store,
  key: (s: State) => SubKey,
  step: number,
): ReadonlySignal<boolean> => store.select((s) => stepIsOn(currentPattern(s), key(s), step));

export const padHasSub = (
  store: Store,
  key: (s: State) => SubKey,
  step: number,
): ReadonlySignal<boolean> =>
  store.select((s) => subStepsOf(currentPattern(s), key(s), step) !== null);

/** Step-Taste eines Parts: an beim Notenanfang, Klasse tail im Ausklang */
export function noteButton(
  c: UiContext,
  part: (s: State) => Part,
  step: number,
  o: Omit<StepButtonOptions, 'on'>,
): HTMLButtonElement {
  const note = c.store.select((s) => {
    const hit = noteAt(currentPattern(s).notes[part(s)], step);
    if (!hit) return 'off';
    return hit.start === step ? 'on' : 'tail';
  });
  const b = stepButton(c.scope, { ...o, on: computed(() => note.value === 'on') });
  bind(
    c.scope,
    () => note.value === 'tail',
    (tail) => {
      b.classList.toggle('tail', tail);
    },
  );
  return b;
}

/** 16 Steps der gewählten Drum in Gruppen zu vier */
export function drumSteps(c: UiContext, nav: Pick<Nav, 'drumSub' | 'drumOpt'>): HTMLElement {
  const { store, scope } = c;
  const voice = selectedVoice(store);
  const buttons = sixteen((s) => {
    const b = stepButton(scope, {
      label: `Step ${s + 1}`,
      text: String(s + 1),
      class: 'step',
      on: drumOn(store, () => voice.value, s),
      sub: drumSub(store, () => voice.value, s),
      onPress: () => {
        pressDrumStep(c, nav, voice.peek(), s);
      },
    });
    optLook(scope, store, () => voice.value, s, b);
    return b;
  });
  markSteps(c, buttons, nav.drumSub, nav.drumOpt);
  return h(
    'div',
    { class: 'drum-steps' },
    [0, 1, 2, 3].map((g) => h('div', { class: 'step-group' }, buttons.slice(g * 4, g * 4 + 4))),
  );
}

/** 16 Steps des gewählten Sampler-Pads */
export function padSteps(c: UiContext, nav: Pick<Nav, 'padSub' | 'padOpt'>): HTMLElement {
  const { store, scope } = c;
  const sel = store.select((s) => s.smp.sel);
  const selKey = (s: State): SubKey => padKeyOf(s.smp.sel);
  const key = computed(() => padKeyOf(sel.value));
  const buttons = sixteen((s) => {
    const b = stepButton(scope, {
      label: `Sampler Step ${s + 1}`,
      text: String(s + 1),
      class: beat('ss', s),
      on: padOn(store, selKey, s),
      sub: padHasSub(store, selKey, s),
      onPress: () => {
        pressPadStep(c, nav, sel.peek(), s);
      },
    });
    optLook(scope, store, () => key.value, s, b);
    return b;
  });
  markSteps(c, buttons, nav.padSub, nav.padOpt);
  return h('div', { class: 'smp-steps' }, buttons);
}

/** 16 Steps des Parts: Notenanfang und Ausklang; ein Tipp öffnet die Rolle an dieser Stelle */
export function noteSteps(c: UiContext, nav: Nav): HTMLElement {
  const buttons = sixteen((s) =>
    noteButton(c, (st) => st.part, s, {
      label: `Noten Step ${s + 1}`,
      text: String(s + 1),
      class: beat('ns', s),
      onPress: () => {
        nav.openNotes(s);
      },
    }),
  );
  markPlayhead(c, buttons);
  return h('div', { class: 'note-steps' }, buttons);
}

/** alle drei Raster; sichtbar ist das der gewählten Spur */
export function stepArea(c: UiContext, nav: Nav): HTMLElement {
  const grids: readonly (readonly [TrackKind, HTMLElement])[] = [
    ['drum', drumSteps(c, nav)],
    ['synth', noteSteps(c, nav)],
    ['smp', padSteps(c, nav)],
  ];
  for (const [kind, grid] of grids) {
    bind(
      c.scope,
      () => kindOf(nav.track.value) === kind,
      (on) => {
        show(grid, on);
      },
    );
  }
  return h(
    'div',
    { class: 'step-area' },
    grids.map(([, grid]) => grid),
  );
}
