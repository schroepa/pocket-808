import { describe, expect, it } from 'vitest';
import { signal } from '../../store/signals.ts';
import type { Layout } from '../layout.ts';
import { createNav } from '../nav.ts';
import { makeContext, pointer } from '../test-utils.ts';
import { channelPage } from './channel.ts';
import { trackWork } from './track-work.ts';

function setup(at: Layout = 'mobile') {
  const ctx = makeContext();
  const layout = signal<Layout>(at);
  const nav = createNav(ctx.scope, ctx.store, layout);
  return { ...ctx, nav, layout };
}

const key = (el: Element | null | undefined, k: string) => {
  el?.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
};
const visible = (el: Element) =>
  [...el.querySelectorAll<HTMLElement>('section[data-page]')]
    .filter((s) => !s.hidden)
    .map((s) => `${String(s.dataset.kind)}:${String(s.dataset.page)}`);
const tabList = (el: Element) => el.querySelector<HTMLElement>('[role=tablist]');
const tabNames = (el: Element) => [...el.querySelectorAll('[role=tab]')].map((t) => t.textContent);
const selectedTab = (el: Element) => el.querySelector('[role=tab][aria-selected="true"]');
const tab = (el: Element, name: string) =>
  [...el.querySelectorAll<HTMLButtonElement>('[role=tab]')].find((t) => t.textContent === name);

describe('trackWork', () => {
  it('zeigt genau die Seiten der Ansicht, Reiter wechseln', () => {
    const { c, nav, layout } = setup();
    const el = trackWork(c, nav, layout);
    expect(tabList(el)?.getAttribute('aria-label')).toBe('Seite');
    expect(tabNames(el)).toEqual(['Trig', 'Klang', 'Mix']);
    expect(visible(el)).toEqual(['drum:trig']);
    tab(el, 'Klang')?.click();
    expect(nav.page.value).toBe('klang');
    expect(visible(el)).toEqual(['drum:klang']);
    expect(selectedTab(el)?.textContent).toBe('Klang');
    nav.selectTrack('BA');
    expect(tabNames(el)).toEqual(['Noten', 'Klang', 'Filter', 'Amp', 'Bewegung', 'Mix']);
    expect(visible(el)).toEqual(['synth:klang']);
    // tablet: mehrere Seiten nebeneinander, Reiter nennt sie alle
    layout.value = 'tablet';
    expect(tabNames(el)).toEqual(['Noten', 'Klang · Filter', 'Amp · Bewegung · Mix']);
    expect(visible(el)).toEqual(['synth:klang', 'synth:filter']);
    tab(el, 'Amp · Bewegung · Mix')?.click();
    expect(visible(el)).toEqual(['synth:amp', 'synth:bewegung', 'synth:mix']);
    // nur eine Ansicht: keine Reiter
    nav.selectTrack('BD');
    expect(tabList(el)?.hidden).toBe(true);
    expect(visible(el)).toEqual(['drum:trig', 'drum:klang', 'drum:mix']);
    layout.value = 'mobile';
    expect(tabList(el)?.hidden).toBe(false);
  });

  it('je Seite ein benannter Bereich mit Inhalt', () => {
    const { c, nav, layout } = setup();
    const el = trackWork(c, nav, layout);
    const sections = [...el.querySelectorAll<HTMLElement>('section')];
    expect(
      sections.map((s) => `${String(s.dataset.kind)}:${String(s.getAttribute('aria-label'))}`),
    ).toEqual([
      'drum:Trig',
      'drum:Klang',
      'drum:Mix',
      'synth:Noten',
      'synth:Klang',
      'synth:Filter',
      'synth:Amp',
      'synth:Bewegung',
      'synth:Mix',
      'smp:Trig',
      'smp:Klang',
      'smp:Chop',
      'smp:Tasten',
      'smp:Mix',
    ]);
    expect(sections.every((s) => s.childElementCount === 1)).toBe(true);
    // genau ein leerer Platz für die Rolle
    expect(el.querySelectorAll('[data-slot=roll]')).toHaveLength(1);
  });

  it('Spurwechsel behält die Seite', () => {
    const { c, nav, layout } = setup();
    const el = trackWork(c, nav, layout);
    tab(el, 'Mix')?.click();
    nav.selectTrack('SD');
    expect(visible(el)).toEqual(['drum:mix']);
    nav.selectTrack('LD');
    expect(visible(el)).toEqual(['synth:mix']);
    nav.selectTrack('SM');
    expect(visible(el)).toEqual(['smp:mix']);
    expect(selectedTab(el)?.textContent).toBe('Mix');
  });

  it('Pad-Reihe und Meldung stehen nur beim Sampler über den Seiten', () => {
    const { c, nav, layout } = setup();
    const el = trackWork(c, nav, layout);
    const head = el.querySelector<HTMLElement>('.smp-head');
    expect(head?.hidden).toBe(true);
    nav.selectTrack('SM');
    expect(head?.hidden).toBe(false);
    expect(head?.closest('section')).toBeNull();
    nav.selectPage('chop');
    expect(head?.hidden).toBe(false);
    nav.selectTrack('BD');
    expect(head?.hidden).toBe(true);
  });

  it('channelPage schreibt den Kanal der Spur, beim Sampler SM', () => {
    const { c, nav, store, layout } = setup();
    const el = trackWork(c, nav, layout);
    nav.selectPage('mix');
    const page = () =>
      [...el.querySelectorAll<HTMLElement>('section[data-page=mix]')].find((s) => !s.hidden);
    const knob = (l: string) => page()?.querySelector(`[role=slider][aria-label="${l}"]`);
    const press = (l: string) =>
      page()?.querySelector<HTMLButtonElement>(`[aria-label="${l}"]`)?.click();
    nav.selectTrack('SD');
    key(knob('Level'), 'Home');
    expect(store.state.value.mix.SD.v).toBe(0);
    press('Snare Drum stumm');
    expect(store.state.value.mix.SD.m).toBe(true);
    nav.selectTrack('LD');
    key(knob('Pan'), 'End');
    expect(store.state.value.mix.LD.p).toBe(1);
    press('Lead solo');
    expect(store.state.value.mix.LD.s).toBe(true);
    nav.selectTrack('SM');
    key(knob('Reverb'), 'End');
    expect(store.state.value.mix.SM.r).toBe(1);
    expect(c.readout.text.value).toBe('SAMPLER Reverb 100%');
    press('Sampler stumm');
    expect(store.state.value.mix.SM.m).toBe(true);
  });
});

describe('channelPage', () => {
  it('Level, Pan, Reverb, Mute und Solo folgen dem Kanal', () => {
    const { c, store } = makeContext();
    const id = signal<'BD' | 'CB'>('BD');
    const el = channelPage(c, id);
    const knob = (l: string) => el.querySelector(`[role=slider][aria-label="${l}"]`);
    const buttons = () => [...el.querySelectorAll<HTMLButtonElement>('button')];
    expect(buttons().map((b) => b.textContent)).toEqual(['Mute', 'Solo']);
    store.update((s) => ({ ...s, mix: { ...s.mix, CB: { ...s.mix.CB, v: 0.3, s: true } } }));
    expect(knob('Level')?.getAttribute('aria-valuenow')).toBe('80');
    id.value = 'CB';
    expect(knob('Level')?.getAttribute('aria-valuenow')).toBe('30');
    expect(buttons().map((b) => b.getAttribute('aria-label'))).toEqual([
      'Cowbell stumm',
      'Cowbell solo',
    ]);
    expect(buttons()[1]?.getAttribute('aria-pressed')).toBe('true');
    buttons()[1]?.click();
    expect(store.state.value.mix.CB.s).toBe(false);
    // Doppeltipp: Level 80, Pan Mitte
    store.update((s) => ({ ...s, mix: { ...s.mix, CB: { ...s.mix.CB, p: 0.1 } } }));
    for (const l of ['Level', 'Pan']) {
      for (let i = 0; i < 2; i++) {
        knob(l)?.dispatchEvent(pointer('pointerdown'));
        knob(l)?.dispatchEvent(pointer('pointerup'));
      }
    }
    expect(store.state.value.mix.CB.v).toBe(0.8);
    expect(store.state.value.mix.CB.p).toBe(0.5);
    key(knob('Level'), 'End');
    expect(c.readout.text.value).toBe('COWBELL Level 100');
  });

  it('level: false lässt den Level-Regler weg', () => {
    const { c } = makeContext();
    const el = channelPage(c, signal<'BD'>('BD'), { level: false });
    expect(
      [...el.querySelectorAll('[role=slider]')].map((k) => k.getAttribute('aria-label')),
    ).toEqual(['Pan', 'Reverb']);
  });
});
