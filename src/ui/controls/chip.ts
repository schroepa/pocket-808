import type { ReadonlySignal } from '../../store/signals.ts';
import { bind, h, type Scope } from '../dom.ts';
import './chip.css';

export interface ChipOptions {
  label: string | ReadonlySignal<string>;
  ariaLabel?: string;
  onClick(): void;
  /** Klasse active und aria-pressed */
  active?: ReadonlySignal<boolean>;
  disabled?: ReadonlySignal<boolean>;
}

export function chip(scope: Scope, o: ChipOptions): HTMLButtonElement {
  const b = h('button', {
    class: 'chip',
    attrs: { type: 'button' },
    on: {
      click: () => {
        o.onClick();
      },
    },
  });
  if (o.ariaLabel) b.setAttribute('aria-label', o.ariaLabel);
  const label = o.label;
  if (typeof label === 'string') b.textContent = label;
  else {
    bind(
      scope,
      () => label.value,
      (t) => {
        b.textContent = t;
      },
    );
  }
  const active = o.active;
  if (active) {
    bind(
      scope,
      () => active.value,
      (v) => {
        b.classList.toggle('active', v);
        b.setAttribute('aria-pressed', String(v));
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
