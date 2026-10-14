import { DRUM_DEFAULTS, VOICES } from '../../core/constants.ts';
import type { DrumParams } from '../../core/types.ts';
import { must } from '../../core/util.ts';
import { computed, signal, type Signal } from '../../store/signals.ts';
import type { UiContext } from '../context.ts';
import { chip } from '../controls/chip.ts';
import { knob } from '../controls/knob.ts';
import { markColumn } from '../controls/marker.ts';
import { stepButton } from '../controls/step-button.ts';
import { bind, h } from '../dom.ts';
import { subEditor } from './sub-editor.ts';
import { drumOn, drumSub, selectedVoice, toggleWithAudition } from './voice.ts';
import './step-editor.css';

/** Sub-Modus des Editors: an/aus und der gewählte Step (nur in der Oberfläche, nicht gespeichert) */
export interface EditorSub {
  on: boolean;
  step: number;
}
export const createEditorSub = (): Signal<EditorSub> => signal({ on: false, step: -1 });

const fmtTune = (v: number): string => {
  const n = Math.round((v - 0.5) * 100);
  return `${n > 0 ? '+' : ''}${n}`;
};
const pct = (v: number): string => String(Math.round(v * 100));

/** Großer Step-Editor für die gewählte Drum-Spur (Legacy buildEditor/buildKnobs). */
export function stepEditor(c: UiContext, sub: Signal<EditorSub> = createEditorSub()): HTMLElement {
  const { store, scope, audio } = c;
  const voice = selectedVoice(store);
  const idEl = h('span');
  const name = h('small');
  bind(
    scope,
    () => voice.value,
    (id) => {
      idEl.textContent = id;
    },
  );
  bind(
    scope,
    () => {
      const v = must(
        VOICES.find((x) => x.id === voice.value),
        'Stimme',
      );
      const custom = c.samples.drums.value.get(v.id);
      return custom ? `${v.name} · ${custom.name.slice(0, 10)}` : v.name;
    },
    (t) => {
      name.textContent = t;
    },
  );
  const head = h('div', { class: 'ed-head' }, [
    h('h2', {}, [idEl, name]),
    h('div', { class: 'chips' }, [
      chip(scope, {
        label: 'Sub',
        ariaLabel: 'Sub-Steps bearbeiten',
        active: computed(() => sub.value.on),
        onClick: () => {
          const s = sub.peek();
          sub.value = { on: !s.on, step: !s.on && s.step < 0 ? 0 : s.step };
        },
      }),
      chip(scope, {
        label: 'Leeren',
        ariaLabel: 'Spur leeren',
        onClick: () => {
          store.clearTrack();
        },
      }),
    ]),
  ]);
  const buttons = Array.from({ length: 16 }, (_, s) =>
    stepButton(scope, {
      label: `Step ${s + 1}`,
      text: String(s + 1),
      class: 'step',
      on: drumOn(store, () => voice.value, s),
      sub: drumSub(store, () => voice.value, s),
      onPress: () => {
        if (sub.peek().on) sub.value = { on: true, step: s };
        else toggleWithAudition(c, voice.peek(), s);
      },
    }),
  );
  const groups = [0, 1, 2, 3].map((g) =>
    h('div', { class: 'group' }, buttons.slice(g * 4, g * 4 + 4)),
  );
  bind(
    scope,
    () => (sub.value.on ? sub.value.step : -1),
    (sel) => {
      buttons.forEach((b, i) => b.classList.toggle('subsel', i === sel));
    },
  );
  markColumn(
    scope,
    computed(() => audio.playhead.value.step),
    (s) => buttons.slice(s, s + 1),
  );
  const subPanel = subEditor(c, {
    key: voice,
    step: computed(() => sub.value.step),
    label: voice,
    audition: () => {
      audio.audition(voice.peek());
    },
  });
  bind(
    scope,
    () => sub.value.on,
    (on) => {
      subPanel.hidden = !on;
    },
  );
  const param = (key: keyof DrumParams, label: string, format: (v: number) => string) =>
    knob(scope, {
      label,
      value: store.select((s) => s.params[must(VOICES[s.sel], 'Stimme').id][key]),
      write: (v) => {
        const id = voice.peek();
        store.update((s) => ({
          ...s,
          params: { ...s.params, [id]: { ...s.params[id], [key]: v } },
        }));
      },
      def: () => DRUM_DEFAULTS[voice.peek()][key],
      format,
      readout: c.readout,
      tag: () => voice.peek(),
      onEnd: () => {
        if (!audio.playing.peek()) audio.audition(voice.peek());
      },
    });
  return h(
    'section',
    { class: 'panel editor', attrs: { 'aria-label': 'Step-Editor', 'data-area': 'editor' } },
    [
      head,
      h('div', { class: 'steps' }, groups),
      subPanel,
      h('div', { class: 'knob-row inst' }, [
        param('level', 'Level', pct),
        param('tune', 'Tune', fmtTune),
        param('decay', 'Decay', pct),
      ]),
      h('div', { class: 'smp-slot' }),
    ],
  );
}
