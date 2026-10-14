import type { ReadonlySignal } from '../../store/signals.ts';
import { bind, h, type Scope } from '../dom.ts';
import './step-button.css';

export interface StepButtonOptions {
  /** aria-label */
  label: string;
  /** sichtbare Nummer */
  text?: string;
  /** 'step' | 'cell' | 'sb' (zusätzliche Klassen erlaubt) */
  class: string;
  on: ReadonlySignal<boolean>;
  /** hat Sub-Steps */
  sub?: ReadonlySignal<boolean>;
  disabled?: ReadonlySignal<boolean>;
  onPress(): void;
}

export function stepButton(scope: Scope, o: StepButtonOptions): HTMLButtonElement {
  const b = h(
    'button',
    {
      class: o.class,
      attrs: { type: 'button', 'aria-label': o.label },
      on: {
        click: () => {
          o.onPress();
        },
      },
    },
    o.text ? [h('span', { text: o.text, attrs: { 'aria-hidden': 'true' } })] : [],
  );
  bind(
    scope,
    () => o.on.value,
    (v) => {
      b.classList.toggle('on', v);
      b.setAttribute('aria-pressed', String(v));
    },
  );
  const sub = o.sub;
  if (sub) {
    bind(
      scope,
      () => sub.value,
      (v) => {
        b.classList.toggle('sub', v);
      },
    );
  }
  const disabled = o.disabled;
  if (disabled) {
    bind(
      scope,
      () => disabled.value,
      (v) => {
        b.disabled = v;
      },
    );
  }
  return b;
}
