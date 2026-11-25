import { DRUM_DEFAULTS, VOICES } from '../../core/constants.ts';
import type { DrumParams, SubKey } from '../../core/types.ts';
import { must } from '../../core/util.ts';
import { batch, computed, type ReadonlySignal, type Signal } from '../../store/signals.ts';
import type { UiContext } from '../context.ts';
import { chip } from '../controls/chip.ts';
import { knob } from '../controls/knob.ts';
import { show } from '../controls/visible.ts';
import { bind, h } from '../dom.ts';
import type { EditorSub, Nav } from '../nav.ts';
import { drumSampleRow } from './drum-sample.ts';
import { hearPad } from './sampler/common.ts';
import { fmtTune, stepOptsPanel, type EditorOpt } from './step-opts.ts';
import { subEditor } from './sub-editor.ts';
import { selectedVoice } from './voice.ts';
import './drum-pages.css';

/* Seiten der Drum-Spuren (Trig, Klang) und die Seite Trig der Sampler-Pads. */

export interface TrigParts {
  /** Umschalter Sub und Opt */
  readonly chips: readonly HTMLElement[];
  /** Sub-Editor und Step-Optionen, je nur im eigenen Modus sichtbar */
  readonly panels: readonly HTMLElement[];
}

interface TrigTarget {
  sub: Signal<EditorSub>;
  opt: Signal<EditorOpt>;
  key: ReadonlySignal<SubKey>;
  label: ReadonlySignal<string>;
  audition(): void;
}

/** Sub und Opt schließen sich aus: Beide ändern, was ein Step-Tipp tut. */
function trigParts(c: UiContext, o: TrigTarget): TrigParts {
  const { scope } = c;
  const { sub, opt, key, label } = o;
  const chips = [
    chip(scope, {
      label: 'Sub',
      ariaLabel: 'Sub-Steps bearbeiten',
      active: computed(() => sub.value.on),
      onClick: () => {
        const s = sub.peek();
        batch(() => {
          sub.value = { on: !s.on, step: !s.on && s.step < 0 ? 0 : s.step };
          if (!s.on) opt.value = { ...opt.peek(), on: false };
        });
      },
    }),
    chip(scope, {
      label: 'Opt',
      ariaLabel: 'Step-Optionen bearbeiten',
      active: computed(() => opt.value.on),
      onClick: () => {
        const v = opt.peek();
        batch(() => {
          opt.value = { ...v, on: !v.on };
          if (!v.on) sub.value = { ...sub.peek(), on: false };
        });
      },
    }),
  ];
  const subPanel = subEditor(c, {
    key,
    step: computed(() => sub.value.step),
    label,
    audition: () => {
      o.audition();
    },
  });
  const optPanel = stepOptsPanel(c, { key, step: computed(() => opt.value.step), label });
  for (const [panel, mode] of [
    [subPanel, sub],
    [optPanel, opt],
  ] as const) {
    bind(
      scope,
      () => mode.value.on,
      (on) => {
        show(panel, on);
      },
    );
  }
  return { chips, panels: [subPanel, optPanel] };
}

/** Trig-Teile des gewählten Sampler-Pads (auch für die Steps im Sampler-Gerät) */
export function padTrigParts(c: UiContext, nav: Pick<Nav, 'padSub' | 'padOpt'>): TrigParts {
  const sel = c.store.select((s) => s.smp.sel);
  return trigParts(c, {
    sub: nav.padSub,
    opt: nav.padOpt,
    key: computed(() => `P${sel.value}` as SubKey),
    label: computed(() => `Pad ${String(sel.value + 1)}`),
    audition: () => {
      hearPad(c, sel.peek());
    },
  });
}

/** Seite Trig: Sub, Opt und „Spur leeren“ in einer Reihe, darunter die Felder */
function trigPage(c: UiContext, parts: TrigParts, clear: () => void): HTMLElement {
  const clearChip = chip(c.scope, { label: 'Leeren', ariaLabel: 'Spur leeren', onClick: clear });
  return h('div', { class: 'trig-page' }, [
    h('div', { class: 'chips' }, [...parts.chips, clearChip]),
    ...parts.panels,
  ]);
}

export function drumTrigPage(c: UiContext, nav: Pick<Nav, 'drumSub' | 'drumOpt'>): HTMLElement {
  const voice = selectedVoice(c.store);
  const parts = trigParts(c, {
    sub: nav.drumSub,
    opt: nav.drumOpt,
    key: voice,
    label: voice,
    audition: () => {
      c.audio.audition(voice.peek());
    },
  });
  return trigPage(c, parts, () => {
    c.store.clearTrack();
  });
}

export function padTrigPage(c: UiContext, nav: Pick<Nav, 'padSub' | 'padOpt'>): HTMLElement {
  return trigPage(c, padTrigParts(c, nav), () => {
    c.store.clearPadTrack(c.store.state.peek().smp.sel);
  });
}

const pct = (v: number): string => String(Math.round(v * 100));

/**
 * Seite Klang der gewählten Drum: Level, Tune, Decay und eigenes Sample. `nav` gehört zur Signatur
 * der Seite; die Stimme steht im Zustand.
 */
export const drumSoundPage: (c: UiContext, nav: Nav) => HTMLElement = (c) => {
  const { store, scope, audio } = c;
  const voice = selectedVoice(store);
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
  // Name des eigenen Samples (höchstens 10 Zeichen); ohne eigenes Sample keine Zeile
  const sampleName = h('p', { class: 'drum-smp-name' });
  bind(
    scope,
    () => c.samples.drums.value.get(voice.value)?.name.slice(0, 10),
    (name) => {
      sampleName.textContent = name ?? '';
      sampleName.hidden = name === undefined;
    },
  );
  return h('div', { class: 'drum-sound' }, [
    h('div', { class: 'drum-knobs' }, [
      param('level', 'Level', pct),
      param('tune', 'Tune', fmtTune),
      param('decay', 'Decay', pct),
    ]),
    drumSampleRow(c, voice),
    sampleName,
  ]);
};
