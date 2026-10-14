import { currentPattern, subStepsOf } from '../../core/pattern.ts';
import type { SubKey } from '../../core/types.ts';
import { computed, type ReadonlySignal } from '../../store/signals.ts';
import type { SubPatternKind } from '../../store/store.ts';
import type { UiContext } from '../context.ts';
import { chip } from '../controls/chip.ts';
import { stepButton } from '../controls/step-button.ts';
import { bind, h } from '../dom.ts';
import './sub-editor.css';

const TOOLS: readonly (readonly [string, SubPatternKind])[] = [
  ['Roll', 'roll'],
  ['÷2', 'half'],
  ['÷4', 'quarter'],
  ['Leeren', 'clear'],
];

/** 16 Sub-Steps eines Steps (Legacy makeSub); auch für den Sampler (5c) gedacht. */
export function subEditor(
  c: UiContext,
  o: {
    key: ReadonlySignal<SubKey>;
    step: ReadonlySignal<number>;
    label: ReadonlySignal<string>;
    audition(): void;
  },
): HTMLElement {
  const { store, scope } = c;
  const row = computed(() => {
    const n = o.step.value;
    return n >= 0 ? subStepsOf(currentPattern(store.state.value), o.key.value, n) : null;
  });
  const none = computed(() => o.step.value < 0);
  const title = h('div', { class: 'cap-label' });
  bind(
    scope,
    () =>
      o.step.value >= 0
        ? `${o.label.value} · Step ${o.step.value + 1} · 16 Sub-Steps`
        : 'Tippe oben einen Step an',
    (t) => {
      title.textContent = t;
    },
  );
  const grid = h(
    'div',
    { class: 'sub-grid' },
    Array.from({ length: 16 }, (_, k) =>
      stepButton(scope, {
        label: `Sub-Step ${k + 1}`,
        text: String(k + 1),
        class: k % 4 === 0 ? 'sb q' : 'sb',
        on: computed(() => row.value?.[k] === 1),
        disabled: none,
        onPress: () => {
          // ohne Step ist der Knopf gesperrt (none), n ist hier immer ≥ 0
          const n = o.step.peek();
          const key = o.key.peek();
          store.toggleSubStep(key, n, k);
          const now = subStepsOf(currentPattern(store.state.peek()), key, n);
          if (now?.[k] === 1 && !c.audio.playing.peek()) o.audition();
        },
      }),
    ),
  );
  const tools = h(
    'div',
    { class: 'chips' },
    TOOLS.map(([label, kind]) =>
      chip(scope, {
        label,
        disabled: none,
        onClick: () => {
          store.applySubPattern(o.key.peek(), o.step.peek(), kind);
        },
      }),
    ),
  );
  return h('div', { class: 'sub-ed' }, [title, grid, tools]);
}
