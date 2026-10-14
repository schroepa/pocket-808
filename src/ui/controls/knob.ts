import { clamp } from '../../core/persist.ts';
import type { ReadonlySignal } from '../../store/signals.ts';
import { bind, h, listen, type Scope } from '../dom.ts';
import type { Readout } from '../readout.ts';
import './knob.css';

export interface KnobOptions {
  label: string;
  /** 0..1 */
  value: ReadonlySignal<number>;
  write(v: number): void;
  def(): number;
  format(v: number): string;
  readout: Readout;
  tag?: () => string;
  onEnd?: () => void;
  now?: () => number;
}

const KEYS: Readonly<Partial<Record<string, (v: number, step: number) => number>>> = {
  ArrowUp: (v, d) => v + d,
  ArrowRight: (v, d) => v + d,
  ArrowDown: (v, d) => v - d,
  ArrowLeft: (v, d) => v - d,
  Home: () => 0,
  End: () => 1,
};

/** Drehregler (Legacy addKnob): ziehen, Doppeltipp = Standardwert, Tastatur, role=slider. */
export function knob(scope: Scope, o: KnobOptions): HTMLElement {
  const now = o.now ?? (() => performance.now());
  const el = h(
    'div',
    {
      class: 'knob',
      attrs: {
        role: 'slider',
        tabindex: '0',
        'aria-label': o.label,
        'aria-valuemin': '0',
        'aria-valuemax': '100',
      },
    },
    [h('div', { class: 'ring' }), h('div', { class: 'dial' })],
  );
  const wrap = h('div', { class: 'knob-wrap' }, [
    el,
    h('div', { class: 'knob-label', text: o.label, attrs: { 'aria-hidden': 'true' } }),
  ]);
  bind(
    scope,
    () => o.value.value,
    (v) => {
      el.style.setProperty('--v', String(v));
      el.style.setProperty('--rot', `${-135 + v * 270}deg`);
      el.setAttribute('aria-valuenow', String(Math.round(v * 100)));
      el.setAttribute('aria-valuetext', o.format(v));
    },
  );
  const say = (v: number): void => {
    o.readout.flash(`${o.tag ? `${o.tag()} ` : ''}${o.label} ${o.format(v)}`);
  };
  const apply = (v: number): void => {
    const x = clamp(v, 0, 1);
    o.write(x);
    say(x);
  };
  let drag: { y: number; v: number; moved: boolean } | null = null;
  let lastTap = -Infinity;
  listen(scope, el, 'pointerdown', (e) => {
    e.preventDefault();
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      /* jsdom und ältere Browser */
    }
    drag = { y: e.clientY, v: o.value.peek(), moved: false };
    say(drag.v);
  });
  listen(scope, el, 'pointermove', (e) => {
    if (!drag) return;
    const dy = drag.y - e.clientY;
    if (Math.abs(dy) > 3) drag.moved = true;
    if (drag.moved) apply(drag.v + dy / 170);
  });
  listen(scope, el, 'pointerup', () => {
    if (!drag) return;
    const moved = drag.moved;
    drag = null;
    if (moved) {
      o.onEnd?.();
      return;
    }
    const t = now();
    if (t - lastTap < 320) {
      apply(o.def());
      lastTap = -Infinity;
      o.onEnd?.();
    } else lastTap = t;
  });
  listen(scope, el, 'pointercancel', () => {
    drag = null;
  });
  listen(scope, el, 'keydown', (e) => {
    const fn = KEYS[e.key];
    if (!fn) return;
    e.preventDefault();
    apply(fn(o.value.peek(), e.shiftKey ? 0.1 : 0.02));
  });
  return wrap;
}
