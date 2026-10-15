import { describe, expect, it, vi } from 'vitest';
import { signal } from '../../store/signals.ts';
import { makeContext, pointer } from '../test-utils.ts';
import { knob } from './knob.ts';

function setup(initial = 0.5) {
  const { c } = makeContext();
  const v = signal(initial);
  let t = 0;
  const onEnd = vi.fn();
  const write = vi.fn((x: number) => {
    v.value = x;
  });
  const wrap = knob(c.scope, {
    label: 'Tune',
    value: v,
    write,
    def: () => 0.25,
    format: (x) => String(Math.round(x * 100)),
    readout: c.readout,
    tag: () => 'BD',
    onEnd,
    now: () => t,
  });
  document.body.append(wrap);
  const el = wrap.querySelector<HTMLElement>('[role=slider]');
  if (!el) throw new Error('kein Regler');
  return {
    c,
    v,
    el,
    write,
    onEnd,
    setTime: (x: number) => {
      t = x;
    },
  };
}

describe('knob', () => {
  it('ARIA spiegelt den Wert', () => {
    const { el, v } = setup(0.5);
    expect(el.getAttribute('aria-label')).toBe('Tune');
    expect(el.getAttribute('aria-valuenow')).toBe('50');
    v.value = 0.123;
    expect(el.getAttribute('aria-valuenow')).toBe('12');
    expect(el.getAttribute('aria-valuetext')).toBe('12');
    expect(el.style.getPropertyValue('--rot')).toBe(`${-135 + 0.123 * 270}deg`);
  });

  it('Ziehen nach oben erhöht um dy/170, kleine Wackler zählen nicht', () => {
    const { el, write, onEnd, c } = setup(0.5);
    el.dispatchEvent(pointer('pointerdown', { clientY: 100 }));
    expect(c.readout.text.value).toBe('BD Tune 50');
    el.dispatchEvent(pointer('pointermove', { clientY: 98 }));
    expect(write).not.toHaveBeenCalled();
    el.dispatchEvent(pointer('pointermove', { clientY: 83 }));
    expect(write).toHaveBeenLastCalledWith(0.6);
    expect(c.readout.text.value).toBe('BD Tune 60');
    el.dispatchEvent(pointer('pointerup'));
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('begrenzt auf 0..1', () => {
    const { el, write } = setup(0.9);
    el.dispatchEvent(pointer('pointerdown', { clientY: 500 }));
    el.dispatchEvent(pointer('pointermove', { clientY: 0 }));
    expect(write).toHaveBeenLastCalledWith(1);
  });

  it('Doppeltipp setzt den Standardwert', () => {
    const { el, write, onEnd, setTime } = setup(0.8);
    el.dispatchEvent(pointer('pointerdown'));
    el.dispatchEvent(pointer('pointerup'));
    setTime(300);
    el.dispatchEvent(pointer('pointerdown'));
    el.dispatchEvent(pointer('pointerup'));
    expect(write).toHaveBeenCalledWith(0.25);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('langsamer zweiter Tipp ist kein Doppeltipp', () => {
    const { el, write, setTime } = setup(0.8);
    el.dispatchEvent(pointer('pointerdown'));
    el.dispatchEvent(pointer('pointerup'));
    setTime(400);
    el.dispatchEvent(pointer('pointerdown'));
    el.dispatchEvent(pointer('pointerup'));
    expect(write).not.toHaveBeenCalled();
  });

  it('pointerup ohne pointerdown tut nichts', () => {
    const { el, write, onEnd } = setup(0.8);
    el.dispatchEvent(pointer('pointerup'));
    el.dispatchEvent(pointer('pointermove', { clientY: 0 }));
    expect(write).not.toHaveBeenCalled();
    expect(onEnd).not.toHaveBeenCalled();
  });

  it.each([
    ['ArrowUp', false, 0.52],
    ['ArrowRight', true, 0.6],
    ['ArrowDown', false, 0.48],
    ['ArrowLeft', true, 0.4],
    ['Home', false, 0],
    ['End', false, 1],
  ])('Taste %s (Shift %s) → %f', (key, shiftKey, expected) => {
    const { el, write } = setup(0.5);
    const e = new KeyboardEvent('keydown', { key, shiftKey, cancelable: true });
    el.dispatchEvent(e);
    expect(write.mock.calls[0]?.[0]).toBeCloseTo(expected, 10);
    expect(e.defaultPrevented).toBe(true);
  });

  it('andere Tasten bleiben unberührt', () => {
    const { el, write } = setup(0.5);
    const e = new KeyboardEvent('keydown', { key: 'a', cancelable: true });
    el.dispatchEvent(e);
    expect(write).not.toHaveBeenCalled();
    expect(e.defaultPrevented).toBe(false);
  });

  it('pointercancel beendet das Ziehen', () => {
    const { el, write } = setup(0.5);
    el.dispatchEvent(pointer('pointerdown', { clientY: 100 }));
    el.dispatchEvent(pointer('pointercancel'));
    el.dispatchEvent(pointer('pointermove', { clientY: 0 }));
    expect(write).not.toHaveBeenCalled();
  });

  it('ohne tag: Meldung nur mit Beschriftung', () => {
    const { c } = makeContext();
    const v = signal(0.5);
    const wrap = knob(c.scope, {
      label: 'Swing',
      value: v,
      write: () => undefined,
      def: () => 0,
      format: (x) => `${Math.round(x * 100)} %`,
      readout: c.readout,
    });
    wrap
      .querySelector('[role=slider]')
      ?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home' }));
    expect(c.readout.text.value).toBe('Swing 0 %');
  });

  it('Rastpunkt: beim Ziehen fängt der Wert nahe snap, Tasten bewegen frei', () => {
    const { c } = makeContext();
    const v = signal(0.4);
    const write = vi.fn((x: number) => {
      v.value = x;
    });
    const wrap = knob(c.scope, {
      label: 'Pan',
      value: v,
      write,
      def: () => 0.5,
      format: (x) => String(x),
      readout: c.readout,
      snap: 0.5,
    });
    const el = wrap.querySelector('[role=slider]');
    el?.dispatchEvent(pointer('pointerdown', { clientY: 100 }));
    el?.dispatchEvent(pointer('pointermove', { clientY: 84 })); // 0,4 + 16/170 ≈ 0,494
    expect(write).toHaveBeenLastCalledWith(0.5);
    el?.dispatchEvent(pointer('pointermove', { clientY: 70 })); // ≈ 0,576
    expect(write.mock.lastCall?.[0]).toBeCloseTo(0.4 + 30 / 170, 10);
    el?.dispatchEvent(pointer('pointerup'));
    v.value = 0.49;
    el?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
    expect(write.mock.lastCall?.[0]).toBeCloseTo(0.51, 10);
  });
});
