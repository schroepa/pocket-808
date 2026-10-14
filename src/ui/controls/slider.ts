import { clamp } from '../../core/persist.ts';
import type { ReadonlySignal } from '../../store/signals.ts';
import { bind, h, listen, type Scope } from '../dom.ts';
import type { Readout } from '../readout.ts';
import './slider.css';

export interface SliderOptions {
  /** kurze Beschriftung unter dem Regler (z. B. "A") */
  label: string;
  /** aria-label und Meldungstext (z. B. "Filter Attack") */
  aria: string;
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

/** Senkrechter Schieberegler (Legacy addSlider): Zeigerhöhe = Wert, Doppeltipp = Standardwert. */
export function slider(scope: Scope, o: SliderOptions): HTMLElement {
  const now = o.now ?? (() => performance.now());
  const track = h(
    'div',
    {
      class: 'sl-t',
      attrs: {
        role: 'slider',
        tabindex: '0',
        'aria-label': o.aria,
        'aria-valuemin': '0',
        'aria-valuemax': '100',
      },
    },
    [h('div', { class: 'sl-f' }), h('div', { class: 'sl-h' })],
  );
  const wrap = h('div', { class: 'sl' }, [
    track,
    h('div', { class: 'sl-l', text: o.label, attrs: { 'aria-hidden': 'true' } }),
  ]);
  bind(
    scope,
    () => o.value.value,
    (v) => {
      track.style.setProperty('--v', String(v));
      track.setAttribute('aria-valuenow', String(Math.round(v * 100)));
      track.setAttribute('aria-valuetext', o.format(v));
    },
  );
  const apply = (v: number): void => {
    const x = clamp(v, 0, 1);
    o.write(x);
    o.readout.flash(`${o.tag ? `${o.tag()} ` : ''}${o.aria} ${o.format(x)}`);
  };
  const fromY = (y: number): number => {
    const r = track.getBoundingClientRect();
    return 1 - (y - r.top - 6) / Math.max(1, r.height - 12);
  };
  let drag: { y: number; moved: boolean } | null = null;
  let lastTap = -Infinity;
  listen(scope, track, 'pointerdown', (e) => {
    e.preventDefault();
    try {
      track.setPointerCapture(e.pointerId);
    } catch {
      /* jsdom und ältere Browser */
    }
    drag = { y: e.clientY, moved: false };
  });
  listen(scope, track, 'pointermove', (e) => {
    if (!drag) return;
    if (Math.abs(e.clientY - drag.y) > 3) drag.moved = true;
    if (drag.moved) apply(fromY(e.clientY));
  });
  listen(scope, track, 'pointerup', (e) => {
    if (!drag) return;
    const moved = drag.moved;
    drag = null;
    if (!moved) {
      const t = now();
      if (t - lastTap < 320) {
        apply(o.def());
        lastTap = -Infinity;
      } else {
        apply(fromY(e.clientY));
        lastTap = t;
      }
    }
    o.onEnd?.();
  });
  listen(scope, track, 'pointercancel', () => {
    drag = null;
  });
  listen(scope, track, 'keydown', (e) => {
    const fn = KEYS[e.key];
    if (!fn) return;
    e.preventDefault();
    apply(fn(o.value.peek(), e.shiftKey ? 0.1 : 0.02));
  });
  return wrap;
}
