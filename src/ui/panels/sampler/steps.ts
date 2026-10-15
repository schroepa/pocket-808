import { currentPattern, subStepsOf } from '../../../core/pattern.ts';
import type { SubKey } from '../../../core/types.ts';
import { must } from '../../../core/util.ts';
import { computed, signal } from '../../../store/signals.ts';
import type { UiContext } from '../../context.ts';
import { chip } from '../../controls/chip.ts';
import { markColumn } from '../../controls/marker.ts';
import { stepButton } from '../../controls/step-button.ts';
import { bind, h } from '../../dom.ts';
import { subEditor } from '../sub-editor.ts';
import { hearPad, padState } from './common.ts';

/** 16 Sampler-Steps des gewählten Pads mit Sub-Modus (Legacy smpSteps, paintSmpSteps) */
export function samplerSteps(c: UiContext): HTMLElement {
  const { store, scope, audio } = c;
  const { sel } = padState(c);
  const key = computed(() => `P${sel.value}` as SubKey);
  const sub = signal({ on: false, step: -1 });
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
        store.toggleSampleStep(i, s);
        const row = must(currentPattern(store.state.peek()).smp[i], 'Sampler-Reihe');
        if (row[s] === 1 && !audio.playing.peek()) hearPad(c, i);
      },
    }),
  );
  bind(
    scope,
    () => (sub.value.on ? sub.value.step : -1),
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
  return h('div', { class: 'smp-step-box' }, [
    h('div', { class: 'row-split' }, [
      h('div', { class: 'cap-label', text: 'Steps' }),
      chip(scope, {
        label: 'Sub',
        ariaLabel: 'Sub-Steps bearbeiten',
        active: computed(() => sub.value.on),
        onClick: () => {
          const s = sub.peek();
          sub.value = { on: !s.on, step: !s.on && s.step < 0 ? 0 : s.step };
        },
      }),
    ]),
    h('div', { class: 'smp-steps' }, buttons),
    ed,
  ]);
}
