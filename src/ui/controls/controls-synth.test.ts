import { describe, expect, it, vi } from 'vitest';
import { signal } from '../../store/signals.ts';
import { createScope } from '../dom.ts';
import { makeContext, pointer } from '../test-utils.ts';
import { envelopePoints, envelopeView } from './envelope.ts';
import { selectField } from './select.ts';
import { slider } from './slider.ts';

function setupSlider(initial = 0.5) {
  const { c } = makeContext();
  const v = signal(initial);
  let t = 0;
  const write = vi.fn((x: number) => {
    v.value = x;
  });
  const onEnd = vi.fn();
  const el = slider(c.scope, {
    label: 'A',
    aria: 'Filter Attack',
    value: v,
    write,
    def: () => 0.1,
    format: (x) => `${Math.round(x * 100)} %`,
    readout: c.readout,
    tag: () => 'BASS',
    onEnd,
    now: () => t,
  });
  const track = el.querySelector<HTMLElement>('[role=slider]');
  if (!track) throw new Error('kein Regler');
  // Spur 112 px hoch ab y = 0 (6 px Rand oben und unten wie Legacy)
  track.getBoundingClientRect = () => ({
    top: 0,
    height: 112,
    bottom: 112,
    left: 0,
    right: 20,
    width: 20,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
  return {
    c,
    v,
    el,
    track,
    write,
    onEnd,
    setTime: (x: number) => {
      t = x;
    },
  };
}

describe('slider', () => {
  it('ARIA und Füllstand spiegeln den Wert', () => {
    const { track, v } = setupSlider(0.5);
    expect(track.getAttribute('aria-label')).toBe('Filter Attack');
    expect(track.getAttribute('aria-valuenow')).toBe('50');
    v.value = 0.25;
    expect(track.style.getPropertyValue('--v')).toBe('0.25');
    expect(track.getAttribute('aria-valuetext')).toBe('25 %');
  });
  it('Ziehen setzt den Wert an der Zeigerhöhe; Meldung mit Part', () => {
    const { track, write, c, onEnd } = setupSlider(0.5);
    track.dispatchEvent(pointer('pointerdown', { clientY: 56 }));
    track.dispatchEvent(pointer('pointermove', { clientY: 54 }));
    expect(write).not.toHaveBeenCalled();
    track.dispatchEvent(pointer('pointermove', { clientY: 6 }));
    expect(write).toHaveBeenLastCalledWith(1);
    expect(c.readout.text.value).toBe('BASS Filter Attack 100 %');
    track.dispatchEvent(pointer('pointerup', { clientY: 6 }));
    expect(onEnd).toHaveBeenCalledTimes(1);
  });
  it('Antippen setzt den Wert an der Stelle, Doppeltipp den Standard', () => {
    const { track, write, setTime, onEnd } = setupSlider(0.5);
    track.dispatchEvent(pointer('pointerdown', { clientY: 106 }));
    track.dispatchEvent(pointer('pointerup', { clientY: 106 }));
    expect(write).toHaveBeenLastCalledWith(0);
    setTime(200);
    track.dispatchEvent(pointer('pointerdown', { clientY: 106 }));
    track.dispatchEvent(pointer('pointerup', { clientY: 106 }));
    expect(write).toHaveBeenLastCalledWith(0.1);
    expect(onEnd).toHaveBeenCalledTimes(2);
  });
  it('Tasten, Abbruch und pointerup ohne pointerdown', () => {
    const { track, write } = setupSlider(0.5);
    track.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', shiftKey: true }));
    expect(write.mock.calls[0]?.[0]).toBeCloseTo(0.6, 10);
    track.dispatchEvent(new KeyboardEvent('keydown', { key: 'x' }));
    expect(write).toHaveBeenCalledTimes(1);
    track.dispatchEvent(pointer('pointerup'));
    track.dispatchEvent(pointer('pointerdown', { clientY: 50 }));
    track.dispatchEvent(pointer('pointercancel'));
    track.dispatchEvent(pointer('pointermove', { clientY: 0 }));
    expect(write).toHaveBeenCalledTimes(1);
  });
  it.each([
    ['ArrowUp', false, 0.52],
    ['ArrowRight', false, 0.52],
    ['ArrowDown', true, 0.4],
    ['ArrowLeft', false, 0.48],
    ['Home', false, 0],
    ['End', false, 1],
  ])('Taste %s (Shift %s) → %f', (key, shiftKey, expected) => {
    const { track, write } = setupSlider(0.5);
    track.dispatchEvent(new KeyboardEvent('keydown', { key, shiftKey }));
    expect(write.mock.calls[0]?.[0]).toBeCloseTo(expected, 10);
  });
  it('ohne tag: Meldung nur mit Beschriftung', () => {
    const { c } = makeContext();
    const el = slider(c.scope, {
      label: 'S',
      aria: 'Amp Sustain',
      value: signal(0.5),
      write: () => undefined,
      def: () => 0,
      format: (x) => String(Math.round(x * 100)),
      readout: c.readout,
    });
    const track = el.querySelector('[role=slider]');
    track?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home' }));
    expect(c.readout.text.value).toBe('Amp Sustain 0');
    // Standard-Uhr (performance.now): ein einzelner Tipp ist kein Doppeltipp
    track?.dispatchEvent(pointer('pointerdown', { clientY: 0 }));
    track?.dispatchEvent(pointer('pointerup', { clientY: 0 }));
  });
});

describe('selectField', () => {
  it('zeigt und schreibt den Index', () => {
    const scope = createScope();
    const value = signal(2);
    const write = vi.fn();
    const el = selectField(scope, { label: 'Tonart', options: ['C', 'C#', 'D'], value, write });
    const sel = el.querySelector('select');
    if (!sel) throw new Error('kein select');
    expect(el.textContent).toContain('Tonart');
    expect(sel.value).toBe('2');
    value.value = 0;
    expect(sel.value).toBe('0');
    sel.value = '1';
    sel.dispatchEvent(new Event('change'));
    expect(write).toHaveBeenCalledWith(1);
  });
});

describe('envelope', () => {
  it('Pfad wie Legacy envPath (Haltezeit 0,6)', () => {
    expect(envelopePoints(0, 0, 1, 0)).toBe('M0 34L0.00 2L0.00 2.00L100.00 2.00L100 34');
    expect(envelopePoints(0.6, 0.6, 0.5, 0.6)).toBe('M0 34L25.00 2L50.00 18.00L75.00 18.00L100 34');
  });
  it('SVG folgt dem Signal', () => {
    const v = signal<readonly [number, number, number, number]>([0, 0, 1, 0]);
    const svg = envelopeView(createScope(), v);
    const [fill, line] = [...svg.querySelectorAll('path')];
    expect(line?.getAttribute('d')).toBe(envelopePoints(0, 0, 1, 0));
    expect(fill?.getAttribute('d')).toBe(`${envelopePoints(0, 0, 1, 0)}Z`);
    v.value = [0.6, 0.6, 0.5, 0.6];
    expect(line?.getAttribute('d')).toBe(envelopePoints(0.6, 0.6, 0.5, 0.6));
  });
});
