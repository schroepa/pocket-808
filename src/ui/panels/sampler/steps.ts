import { currentPattern, subStepsOf } from '../../../core/pattern.ts';
import type { SubKey } from '../../../core/types.ts';
import { must } from '../../../core/util.ts';
import { stepIsOn } from '../../../core/stepopts.ts';
import { batch, computed, signal } from '../../../store/signals.ts';
import type { UiContext } from '../../context.ts';
import { chip } from '../../controls/chip.ts';
import { markColumn } from '../../controls/marker.ts';
import { stepButton } from '../../controls/step-button.ts';
import { bind, h } from '../../dom.ts';
import { createEditorOpt, optLook, stepOptsPanel } from '../step-opts.ts';
import { subEditor } from '../sub-editor.ts';
import { hearPad, padState } from './common.ts';

/** 16 Sampler-Steps des gewählten Pads mit Sub-Modus (Legacy smpSteps, paintSmpSteps) */
export function samplerSteps(c: UiContext): HTMLElement {
  const { store, scope, audio } = c;
  const { sel } = padState(c);
  const key = computed(() => `P${sel.value}` as SubKey);
  const sub = signal({ on: false, step: -1 });
  const opt = createEditorOpt();
  const buttons = Array.from({ length: 16 }, (_, s) =>
    stepButton(scope, {
      label: `Sampler Step ${s + 1}`,
      text: String(s + 1),
      class: s % 4 === 0 ? 'ss q' : 'ss',
      on: store.select((st) => {
        const p = currentPattern(st);
        const i = st.smp.sel;
        return (
          must(p.smp[i], 'Sampler-Reihe')[s] === 1 || subStepsOf(p, `P${i}` as SubKey, s) !== null
        );
      }),
      sub: store.select(
        (st) => subStepsOf(currentPattern(st), `P${st.smp.sel}` as SubKey, s) !== null,
      ),
      onPress: () => {
        if (sub.peek().on) {
          sub.value = { on: true, step: s };
          return;
        }
        const i = sel.peek();
        if (opt.peek().on) {
          // Opt-Modus: wählen; ein ausgeschalteter Step wird dabei eingeschaltet
          if (!stepIsOn(currentPattern(store.state.peek()), key.peek(), s)) {
            store.toggleSampleStep(i, s);
            if (!audio.playing.peek()) hearPad(c, i);
          }
          opt.value = { on: true, step: s };
          return;
        }
        store.toggleSampleStep(i, s);
        const row = must(currentPattern(store.state.peek()).smp[i], 'Sampler-Reihe');
        if (row[s] === 1 && !audio.playing.peek()) hearPad(c, i);
      },
    }),
  );
  bind(
    scope,
    () => (sub.value.on ? sub.value.step : opt.value.on ? opt.value.step : -1),
    (n) => {
      buttons.forEach((b, i) => b.classList.toggle('subsel', i === n));
    },
  );
  markColumn(
    scope,
    computed(() => audio.playhead.value.step),
    (s) => buttons.slice(s, s + 1),
  );
  const ed = subEditor(c, {
    key,
    step: computed(() => sub.value.step),
    label: computed(() => `Pad ${sel.value + 1}`),
    audition: () => {
      hearPad(c, sel.peek());
    },
  });
  bind(
    scope,
    () => sub.value.on,
    (on) => {
      ed.hidden = !on;
    },
  );
  buttons.forEach((b, s) => {
    optLook(scope, store, () => key.value, s, b);
  });
  const optPanel = stepOptsPanel(c, {
    key,
    step: computed(() => opt.value.step),
    label: computed(() => `Pad ${String(sel.value + 1)}`),
  });
  bind(
    scope,
    () => opt.value.on,
    (on) => {
      optPanel.hidden = !on;
    },
  );
  return h('div', { class: 'smp-step-box' }, [
    h('div', { class: 'row-split' }, [
      h('div', { class: 'cap-label', text: 'Steps' }),
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
          const o = opt.peek();
          batch(() => {
            opt.value = { ...o, on: !o.on };
            if (!o.on) sub.value = { ...sub.peek(), on: false };
          });
        },
      }),
    ]),
    h('div', { class: 'smp-steps' }, buttons),
    ed,
    optPanel,
  ]);
}
