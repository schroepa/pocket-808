import { currentPattern } from '../../core/pattern.ts';
import {
  hasLock,
  STEP_CONDS,
  stepIsOn,
  stepOptOf,
  type StepOptPatch,
} from '../../core/stepopts.ts';
import { must } from '../../core/util.ts';
import type { SubKey, VoiceId } from '../../core/types.ts';
import { computed, signal, type ReadonlySignal, type Signal } from '../../store/signals.ts';
import type { Store } from '../../store/store.ts';
import type { UiContext } from '../context.ts';
import { chip } from '../controls/chip.ts';
import { knob } from '../controls/knob.ts';
import { selectField } from '../controls/select.ts';
import { bind, h, type Scope } from '../dom.ts';
import './step-opts.css';

/** Opt-Modus eines Step-Rasters: an/aus und der gewählte Step (nur in der Oberfläche) */
export interface EditorOpt {
  on: boolean;
  step: number;
}
export const createEditorOpt = (): Signal<EditorOpt> => signal({ on: false, step: -1 });

const fmtTune = (v: number): string => {
  const n = Math.round((v - 0.5) * 100);
  return `${n > 0 ? '+' : ''}${String(n)}`;
};
const semis = (v: number): string => {
  const n = Math.round((v - 0.5) * 24);
  return `${n > 0 ? '+' : ''}${String(n)} ST`;
};

/** Schnellwahl der Velocity */
const QUICK: readonly (readonly [string, number])[] = [
  ['Leise', 0.35],
  ['Mittel', 0.7],
  ['Voll', 1],
];

/** Velocity als Helligkeit (--vel) und Marke (Klasse opt) bei Chance < 100 % oder Bedingung */
export function optLook(
  scope: Scope,
  store: Store,
  key: () => SubKey,
  step: number,
  el: HTMLElement,
): void {
  bind(
    scope,
    () => stepOptOf(currentPattern(store.state.value), key(), step).v,
    (v) => {
      el.style.setProperty('--vel', String(v));
    },
  );
  bind(
    scope,
    () => {
      const o = stepOptOf(currentPattern(store.state.value), key(), step);
      return o.p < 1 || o.c !== 'all' || hasLock(o);
    },
    (on) => {
      el.classList.toggle('opt', on);
    },
  );
}

/** Feld unter dem Raster: Velocity, Chance und Bedingung des gewählten Steps. */
export function stepOptsPanel(
  c: UiContext,
  o: { key: ReadonlySignal<SubKey>; step: ReadonlySignal<number>; label: ReadonlySignal<string> },
): HTMLElement {
  const { store, scope } = c;
  const opt = computed(() =>
    stepOptOf(currentPattern(store.state.value), o.key.value, Math.max(0, o.step.value)),
  );
  const on = computed(
    () =>
      o.step.value >= 0 && stepIsOn(currentPattern(store.state.value), o.key.value, o.step.value),
  );
  const write = (patch: StepOptPatch) => {
    store.setStepOpt(o.key.peek(), o.step.peek(), patch);
  };
  const pct = (v: number): string => `${String(Math.round(v * 100))} %`;
  const tag = (): string => o.label.peek();

  // Spurwerte, denen ein Step ohne Lock folgt
  const padKey = computed(() => o.key.value.startsWith('P'));
  const track = computed(() => {
    const s = store.state.value;
    const key = o.key.value;
    if (key.startsWith('P')) {
      const pad = must(s.smp.pads[Number(key.slice(1))], 'Pad');
      return { t: pad.tune, d: pad.dec, s: pad.start };
    }
    const p = s.params[key as VoiceId];
    return { t: p.tune, d: p.decay, s: 0 };
  });
  const lockKnob = (k: 't' | 'd' | 's', label: string, format: (v: number) => string) => {
    const el = knob(scope, {
      label: `Lock ${label}`,
      value: computed(() => opt.value[k] ?? track.value[k]),
      write: (v) => {
        write({ [k]: v });
      },
      def: () => track.peek()[k],
      format,
      readout: c.readout,
      tag,
    });
    bind(
      scope,
      () => opt.value[k] !== undefined,
      (on) => {
        el.classList.toggle('locked', on);
      },
    );
    return el;
  };
  const lockStart = lockKnob('s', 'Start', pct);
  bind(
    scope,
    () => padKey.value,
    (pad) => {
      lockStart.hidden = !pad;
    },
  );
  const title = h('div', { class: 'cap-label' });
  bind(
    scope,
    () =>
      o.step.value >= 0
        ? `${o.label.value} · Step ${String(o.step.value + 1)}`
        : 'Tippe oben einen Step an',
    (t) => {
      title.textContent = t;
    },
  );
  const off = h('p', {
    class: 'opt-off',
    text: 'Step ist aus – im Opt-Modus antippen schaltet ihn ein.',
  });
  const controls = h('div', { class: 'opt-ctl' }, [
    h('div', { class: 'opt-row' }, [
      knob(scope, {
        label: 'Velocity',
        value: computed(() => opt.value.v),
        write: (v) => {
          write({ v });
        },
        def: () => 1,
        format: pct,
        readout: c.readout,
        tag,
      }),
      h(
        'div',
        { class: 'chips opt-quick' },
        QUICK.map(([label, v]) =>
          chip(scope, {
            label,
            active: computed(() => Math.abs(opt.value.v - v) < 0.005),
            onClick: () => {
              write({ v });
            },
          }),
        ),
      ),
    ]),
    h('div', { class: 'opt-row' }, [
      knob(scope, {
        label: 'Chance',
        value: computed(() => opt.value.p),
        write: (p) => {
          write({ p });
        },
        def: () => 1,
        format: pct,
        readout: c.readout,
        tag,
      }),
      selectField(scope, {
        label: 'Bedingung',
        options: STEP_CONDS.map((x) => x.label),
        value: computed(() => STEP_CONDS.findIndex((x) => x.value === opt.value.c)),
        write: (i) => {
          write({ c: STEP_CONDS[i]?.value ?? 'all' });
        },
      }),
    ]),
    h('div', { class: 'cap-label', text: 'Lock' }),
    h('div', { class: 'opt-row opt-locks' }, [
      lockKnob('t', 'Tune', (v) => (padKey.value ? semis(v) : fmtTune(v))),
      lockKnob('d', 'Decay', pct),
      lockStart,
      chip(scope, {
        label: 'Locks lösen',
        disabled: computed(() => !hasLock(opt.value)),
        onClick: () => {
          store.resetStepLocks(o.key.peek(), o.step.peek());
        },
      }),
    ]),
    h('div', { class: 'opt-row opt-end' }, [
      chip(scope, {
        label: 'Zurücksetzen',
        onClick: () => {
          store.resetStepOpt(o.key.peek(), o.step.peek());
        },
      }),
    ]),
  ]);
  bind(
    scope,
    () => on.value,
    (v) => {
      controls.hidden = !v;
    },
  );
  bind(
    scope,
    () => o.step.value >= 0 && !on.value,
    (v) => {
      off.hidden = !v;
    },
  );
  return h('div', { class: 'opt-panel', attrs: { role: 'group', 'aria-label': 'Step-Optionen' } }, [
    title,
    off,
    controls,
  ]);
}
