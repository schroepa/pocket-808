import { describe, expect, it } from 'vitest';
import { signal } from '../store/signals.ts';
import { devices, type Device } from './devices.ts';
import { h } from './dom.ts';
import type { Layout } from './layout.ts';
import { makeContext } from './test-utils.ts';

const dev = (id: Device['id'], name: string): Device => ({
  id,
  name,
  summary: signal(`${name} ok`),
  body: () => h('button', { text: `${name} innen` }),
});

function setup(initial: Layout) {
  const ctx = makeContext();
  const layout = signal<Layout>(initial);
  const el = devices(ctx.c, layout, [dev('synth', 'Synth'), dev('mix', 'Mixer')]);
  document.body.replaceChildren(el);
  const heads = [...el.querySelectorAll<HTMLButtonElement>('.dev-head')];
  const bodies = [...el.querySelectorAll<HTMLElement>('.dev-body')];
  return { ...ctx, layout, el, heads, bodies };
}
const key = (el: Element | undefined, k: string) =>
  el?.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));

describe('devices', () => {
  it('leere Liste: Abschnitt verborgen', () => {
    const { c } = makeContext();
    expect(devices(c, signal<Layout>('mobile'), []).hidden).toBe(true);
  });

  it('mobile: Akkordeon über store.open', () => {
    const { heads, bodies, store } = setup('mobile');
    const before = store.state.value.open.synth;
    expect(heads[0]?.getAttribute('aria-expanded')).toBe(String(before));
    expect(heads[0]?.getAttribute('aria-controls')).toBe('dev-synth');
    expect(heads[0]?.hasAttribute('role')).toBe(false);
    heads[0]?.click();
    expect(store.state.value.open.synth).toBe(!before);
    expect(bodies[0]?.hidden).toBe(before);
    expect(heads[0]?.textContent).toContain('Synth ok');
    expect(key(heads[0], 'ArrowRight')).toBe(true);
  });

  it('tablet: Tabs mit genau einem sichtbaren Gerät, Pfeiltasten', () => {
    const { el, heads, bodies } = setup('tablet');
    expect(el.querySelector('.dev-heads')?.getAttribute('role')).toBe('tablist');
    expect(heads.map((x) => x.getAttribute('aria-selected'))).toEqual(['true', 'false']);
    expect(heads.map((x) => x.tabIndex)).toEqual([0, -1]);
    expect(bodies.map((b) => b.hidden)).toEqual([false, true]);
    expect(bodies[0]?.getAttribute('role')).toBe('tabpanel');
    expect(bodies[0]?.getAttribute('aria-labelledby')).toBe('dev-head-synth');
    key(heads[0], 'ArrowRight');
    expect(bodies.map((b) => b.hidden)).toEqual([true, false]);
    expect(document.activeElement).toBe(heads[1]);
    key(heads[1], 'ArrowRight');
    expect(bodies.map((b) => b.hidden)).toEqual([false, true]);
    key(heads[0], 'ArrowLeft');
    expect(bodies.map((b) => b.hidden)).toEqual([true, false]);
    expect(key(heads[1], 'Enter')).toBe(true);
    heads[0]?.click();
    expect(bodies.map((b) => b.hidden)).toEqual([false, true]);
  });

  it('desktop: alle offen, Köpfe verborgen, keine Rollen; Klick ins Leere ohne Wirkung', () => {
    const { el, bodies, store } = setup('desktop');
    const heads = el.querySelector<HTMLElement>('.dev-heads');
    expect(heads?.hidden).toBe(true);
    expect(heads?.hasAttribute('role')).toBe(false);
    expect(bodies.every((b) => !b.hidden && !b.hasAttribute('role'))).toBe(true);
    const before = store.state.value;
    heads?.click();
    expect(store.state.value).toBe(before);
  });

  it('Layoutwechsel behält das Gerät mit dem Fokus sichtbar', () => {
    const { layout, bodies, store } = setup('desktop');
    store.update((s) => ({ ...s, open: { ...s.open, mix: false } }));
    bodies[1]?.querySelector('button')?.focus();
    layout.value = 'tablet';
    expect(bodies[1]?.hidden).toBe(false);
    layout.value = 'desktop';
    bodies[1]?.querySelector('button')?.focus();
    layout.value = 'mobile';
    expect(store.state.value.open.mix).toBe(true);
    expect(document.activeElement?.textContent).toBe('Mixer innen');
  });

  it('Layoutwechsel ohne Fokus in einem Gerät ändert nichts am Zustand', () => {
    const { layout, store } = setup('desktop');
    const before = store.state.value;
    layout.value = 'mobile';
    expect(store.state.value).toBe(before);
  });
});
