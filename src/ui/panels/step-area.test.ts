import { describe, expect, it } from 'vitest';
import { currentPattern } from '../../core/pattern.ts';
import { signal } from '../../store/signals.ts';
import type { Layout } from '../layout.ts';
import { createNav } from '../nav.ts';
import { countMutations, makeContext, pointer } from '../test-utils.ts';
import { drumSoundPage, drumTrigPage, padTrigPage } from './drum-pages.ts';
import {
  drumSteps,
  noteSteps,
  padSteps,
  pressDrumStep,
  pressPadStep,
  stepArea,
} from './step-area.ts';

const pcm = Float32Array.from([0.5, -0.5]);

function setup(layout: Layout = 'mobile') {
  const ctx = makeContext();
  const nav = createNav(ctx.scope, ctx.store, signal<Layout>(layout));
  return { ...ctx, nav };
}

const buttons = (el: Element, sel = 'button') => [...el.querySelectorAll<HTMLButtonElement>(sel)];
const names = (el: Element) => buttons(el).map((b) => b.getAttribute('aria-label'));
const labelled = (el: Element, label: string) =>
  el.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`);
const chipNamed = (el: Element, text: string) =>
  buttons(el, '.chip').find((b) => b.textContent === text);
const marked = (el: Element, cls: string) =>
  buttons(el).flatMap((b, i) => (b.classList.contains(cls) ? [i] : []));
const count = (n: number, name: (i: number) => string) =>
  Array.from({ length: n }, (_, i) => name(i + 1));

describe('drumSteps', () => {
  it('16 Knöpfe „Step n“ in vier Gruppen zu vier', () => {
    const { c, nav } = setup();
    const el = drumSteps(c, nav);
    expect(names(el)).toEqual(count(16, (n) => `Step ${n}`));
    expect(buttons(el, '.step')).toHaveLength(16);
    expect([...el.children].map((g) => g.children.length)).toEqual([4, 4, 4, 4]);
  });

  it('Tipp schaltet die gewählte Drum und hört nur beim Einschalten im Stand vor', () => {
    const { c, nav, store, audio } = setup();
    const el = drumSteps(c, nav);
    nav.selectTrack('SD');
    const b = buttons(el);
    b[2]?.click();
    expect(store.state.value.patterns.A.SD[2]).toBe(1);
    expect(b[2]?.getAttribute('aria-pressed')).toBe('true');
    expect(audio.audition).toHaveBeenCalledWith('SD');
    b[2]?.click();
    expect(audio.audition).toHaveBeenCalledTimes(1);
    audio.playing.value = true;
    b[3]?.click();
    expect(audio.audition).toHaveBeenCalledTimes(1);
    nav.selectTrack('BD');
    expect(b[3]?.getAttribute('aria-pressed')).toBe('false');
  });

  it('Tipp auf einen Step mit Sub-Steps löscht sie und schaltet ihn aus', () => {
    const { c, nav, store, audio } = setup();
    store.toggleSubStep('BD', 4, 1);
    const el = drumSteps(c, nav);
    const b = buttons(el)[4];
    expect(b?.classList.contains('on')).toBe(true);
    expect(b?.classList.contains('sub')).toBe(true);
    b?.click();
    expect(currentPattern(store.state.value).sub.BD).toBeUndefined();
    expect(b?.classList.contains('on')).toBe(false);
    expect(b?.classList.contains('sub')).toBe(false);
    expect(audio.audition).not.toHaveBeenCalled();
  });

  it('pressDrumStep wirkt auf die genannte Stimme, nicht auf die gewählte', () => {
    const { c, nav, store, audio } = setup();
    pressDrumStep(c, nav, 'CH', 7);
    expect(store.state.value.patterns.A.CH[7]).toBe(1);
    expect(store.state.value.patterns.A.BD[7]).toBe(0);
    expect(audio.audition).toHaveBeenCalledWith('CH');
  });

  it('Sub-Modus: Tipp wählt statt umzuschalten', () => {
    const { c, nav, store } = setup();
    const el = drumSteps(c, nav);
    expect(marked(el, 'subsel')).toEqual([]);
    nav.drumSub.value = { on: true, step: 0 };
    expect(marked(el, 'subsel')).toEqual([0]);
    buttons(el)[6]?.click();
    expect(store.state.value.patterns.A.BD[6]).toBe(0);
    expect(nav.drumSub.value).toEqual({ on: true, step: 6 });
    expect(marked(el, 'subsel')).toEqual([6]);
  });

  it('Opt-Modus: Tipp wählt und schaltet einen ausgeschalteten Step ein', () => {
    const { c, nav, store, audio } = setup();
    const el = drumSteps(c, nav);
    nav.drumOpt.value = { on: true, step: -1 };
    buttons(el)[5]?.click();
    expect(store.state.value.patterns.A.BD[5]).toBe(1);
    expect(audio.audition).toHaveBeenCalledTimes(1);
    expect(marked(el, 'subsel')).toEqual([5]);
    buttons(el)[5]?.click();
    expect(store.state.value.patterns.A.BD[5]).toBe(1);
    expect(audio.audition).toHaveBeenCalledTimes(1);
  });

  it('Velocity und Marke am Step; Lauflicht markiert genau den laufenden', () => {
    const { c, nav, store, audio } = setup();
    const el = drumSteps(c, nav);
    store.toggleStep('BD', 1);
    store.setStepOpt('BD', 1, { v: 0.5, c: '2:4' });
    expect(buttons(el)[1]?.style.getPropertyValue('--vel')).toBe('0.5');
    expect(marked(el, 'opt')).toEqual([1]);
    audio.playhead.value = { step: 4, songIndex: -1 };
    expect(marked(el, 'now')).toEqual([4]);
  });

  it('ein Step-Klick ändert nur diese Zelle', async () => {
    const { c, nav } = setup();
    const el = stepArea(c, nav);
    document.body.append(el);
    const b = labelled(el, 'Step 6');
    expect(await countMutations(el, () => b?.click())).toBe(1);
    nav.selectTrack('SM');
    const pad = labelled(el, 'Sampler Step 6');
    expect(await countMutations(el, () => pad?.click())).toBe(1);
    el.remove();
  });
});

describe('padSteps', () => {
  it('16 Knöpfe „Sampler Step n“ für das gewählte Pad; Vorhören nur beim Einschalten im Stand', () => {
    const { c, nav, store, audio } = setup();
    c.samples.setPad(2, pcm);
    store.update((s) => ({ ...s, smp: { ...s.smp, sel: 2 } }));
    const el = padSteps(c, nav);
    expect(names(el)).toEqual(count(16, (n) => `Sampler Step ${n}`));
    expect(marked(el, 'q')).toEqual([0, 4, 8, 12]);
    const b = buttons(el);
    b[2]?.click();
    expect(store.state.value.patterns.A.smp[2]?.[2]).toBe(1);
    expect(b[2]?.getAttribute('aria-pressed')).toBe('true');
    expect(audio.auditionPad).toHaveBeenCalledWith(2);
    b[2]?.click();
    audio.playing.value = true;
    b[3]?.click();
    expect(audio.auditionPad).toHaveBeenCalledTimes(1);
    audio.playhead.value = { step: 3, songIndex: -1 };
    expect(marked(el, 'now')).toEqual([3]);
  });

  it('pressPadStep: Sub wählt nur, Opt wählt und schaltet ein', () => {
    const { c, nav, store, audio } = setup();
    c.samples.setPad(5, pcm);
    nav.padSub.value = { on: true, step: 0 };
    pressPadStep(c, nav, 5, 9);
    expect(nav.padSub.value).toEqual({ on: true, step: 9 });
    expect(store.state.value.patterns.A.smp[5]?.[9]).toBe(0);
    nav.padSub.value = { on: false, step: 9 };
    nav.padOpt.value = { on: true, step: -1 };
    pressPadStep(c, nav, 5, 9);
    pressPadStep(c, nav, 5, 9);
    expect(store.state.value.patterns.A.smp[5]?.[9]).toBe(1);
    expect(nav.padOpt.value).toEqual({ on: true, step: 9 });
    expect(audio.auditionPad).toHaveBeenCalledTimes(1);
  });

  it('Sub-Steps zeigen den Step an und markieren ihn', () => {
    const { c, nav, store } = setup();
    const el = padSteps(c, nav);
    store.toggleSubStep('P0', 5, 0);
    expect(marked(el, 'on')).toEqual([5]);
    expect(marked(el, 'sub')).toEqual([5]);
    store.update((s) => ({ ...s, smp: { ...s.smp, sel: 1 } }));
    expect(marked(el, 'on')).toEqual([]);
  });
});

describe('noteSteps', () => {
  it('Noten Step zeigt Anfang und Ausklang; Tipp ruft openNotes', () => {
    const { c, nav, store, audio } = setup();
    nav.selectTrack('BA');
    const el = noteSteps(c, nav);
    expect(names(el)).toEqual(count(16, (n) => `Noten Step ${n}`));
    store.update((s) => ({ ...s, noteLen: 4 }));
    store.placeNote(2, 9);
    expect(marked(el, 'on')).toEqual([9]);
    expect(marked(el, 'tail')).toEqual([10, 11, 12]);
    expect(buttons(el)[9]?.getAttribute('aria-pressed')).toBe('true');
    expect(buttons(el)[10]?.getAttribute('aria-pressed')).toBe('false');
    nav.selectPage('filter');
    nav.setMode('sound');
    const before = store.state.value;
    buttons(el)[10]?.click();
    expect(nav.mode.value).toBe('spur');
    expect(nav.page.value).toBe('noten');
    expect(nav.roll.page.value).toBe(1);
    // nur zeigen: weder setzen noch vorhören
    expect(store.state.value).toBe(before);
    expect(audio.auditionNote).not.toHaveBeenCalled();
    audio.playhead.value = { step: 2, songIndex: -1 };
    expect(marked(el, 'now')).toEqual([2]);
  });

  it('folgt dem Part', () => {
    const { c, nav, store } = setup();
    nav.selectTrack('BA');
    const el = noteSteps(c, nav);
    store.placeNote(0, 0);
    expect(marked(el, 'on')).toEqual([0]);
    nav.selectTrack('LD');
    expect(marked(el, 'on')).toEqual([]);
  });
});

describe('stepArea', () => {
  it('zeigt genau das Raster der Spurart', () => {
    const { c, nav } = setup();
    const el = stepArea(c, nav);
    const shown = () =>
      [...el.children]
        .filter((g) => !(g as HTMLElement).hidden)
        .map((g) => g.querySelector('button')?.getAttribute('aria-label'));
    expect(el.children).toHaveLength(3);
    expect(shown()).toEqual(['Step 1']);
    nav.selectTrack('LD');
    expect(shown()).toEqual(['Noten Step 1']);
    nav.selectTrack('SM');
    expect(shown()).toEqual(['Sampler Step 1']);
    nav.selectTrack('CY');
    expect(shown()).toEqual(['Step 1']);
  });
});

describe('drumTrigPage', () => {
  it('Sub: Knopf schaltet den Modus, Auswahl bleibt, Sub-Editor bearbeitet den Step', () => {
    const { c, nav, store } = setup();
    const el = drumTrigPage(c, nav);
    const sub = labelled(el, 'Sub-Steps bearbeiten');
    const ed = el.querySelector<HTMLElement>('.sub-ed');
    expect(ed?.hidden).toBe(true);
    sub?.click();
    expect(sub?.getAttribute('aria-pressed')).toBe('true');
    expect(ed?.hidden).toBe(false);
    expect(nav.drumSub.value).toEqual({ on: true, step: 0 });
    pressDrumStep(c, nav, 'BD', 6);
    expect(ed?.querySelector('.cap-label')?.textContent).toBe('BD · Step 7 · 16 Sub-Steps');
    ed?.querySelector<HTMLButtonElement>('.sb')?.click();
    expect(store.state.value.patterns.A.sub.BD?.[6]?.[0]).toBe(1);
    sub?.click();
    expect(ed?.hidden).toBe(true);
    sub?.click();
    expect(nav.drumSub.value).toEqual({ on: true, step: 6 });
  });

  it('Sub-Editor hört die gewählte Drum vor', () => {
    const { c, nav, audio } = setup();
    const el = drumTrigPage(c, nav);
    nav.selectTrack('SD');
    labelled(el, 'Sub-Steps bearbeiten')?.click();
    el.querySelector<HTMLButtonElement>('.sb')?.click();
    expect(audio.audition).toHaveBeenCalledWith('SD');
  });

  it('Opt: zeigt die Step-Optionen und schließt Sub (und umgekehrt)', () => {
    const { c, nav, store } = setup();
    const el = drumTrigPage(c, nav);
    const sub = labelled(el, 'Sub-Steps bearbeiten');
    const opt = labelled(el, 'Step-Optionen bearbeiten');
    const panel = el.querySelector<HTMLElement>('.opt-panel');
    expect(panel?.hidden).toBe(true);
    sub?.click();
    opt?.click();
    expect(panel?.hidden).toBe(false);
    expect(sub?.getAttribute('aria-pressed')).toBe('false');
    pressDrumStep(c, nav, 'BD', 3);
    expect(panel?.querySelector('.cap-label')?.textContent).toBe('BD · Step 4');
    const quick = panel ? chipNamed(panel, 'Mittel') : undefined;
    quick?.click();
    expect(currentPattern(store.state.value).opt?.BD?.[3]).toEqual({ v: 0.7 });
    sub?.click();
    expect(opt?.getAttribute('aria-pressed')).toBe('false');
    expect(panel?.hidden).toBe(true);
    opt?.click();
    opt?.click();
    expect(nav.drumOpt.value.on).toBe(false);
  });

  it('Spur leeren löscht die gewählte Drum (mit Zurück)', () => {
    const { c, nav, store } = setup();
    store.toggleStep('BD', 0);
    store.toggleStep('SD', 0);
    const el = drumTrigPage(c, nav);
    labelled(el, 'Spur leeren')?.click();
    expect(store.state.value.patterns.A.BD[0]).toBe(0);
    expect(store.state.value.patterns.A.SD[0]).toBe(1);
    expect(store.canUndo.value).toBe(true);
  });
});

describe('padTrigPage', () => {
  it('Sub und Opt des gewählten Pads; Sub-Editor hört das Pad vor', () => {
    const { c, nav, store, audio } = setup();
    c.samples.setPad(2, pcm);
    store.update((s) => ({ ...s, smp: { ...s.smp, sel: 2 } }));
    const el = padTrigPage(c, nav);
    labelled(el, 'Sub-Steps bearbeiten')?.click();
    pressPadStep(c, nav, 2, 5);
    const ed = el.querySelector<HTMLElement>('.sub-ed');
    expect(ed?.querySelector('.cap-label')?.textContent).toBe('Pad 3 · Step 6 · 16 Sub-Steps');
    ed?.querySelector<HTMLButtonElement>('.sb')?.click();
    expect(store.state.value.patterns.A.sub.P2?.[5]?.[0]).toBe(1);
    expect(audio.auditionPad).toHaveBeenCalledWith(2);
    labelled(el, 'Step-Optionen bearbeiten')?.click();
    expect(nav.padSub.value.on).toBe(false);
    pressPadStep(c, nav, 2, 1);
    expect(el.querySelector('.opt-panel .cap-label')?.textContent).toBe('Pad 3 · Step 2');
    expect(nav.drumOpt.value.on).toBe(false);
  });

  it('Spur leeren löscht nur das gewählte Pad (mit Zurück)', () => {
    const { c, nav, store } = setup();
    store.toggleSampleStep(1, 0);
    store.toggleSampleStep(4, 0);
    store.toggleStep('BD', 0);
    const el = padTrigPage(c, nav);
    store.update((s) => ({ ...s, smp: { ...s.smp, sel: 4 } }));
    labelled(el, 'Spur leeren')?.click();
    const p = currentPattern(store.state.value);
    expect([p.smp[1]?.[0], p.smp[4]?.[0], p.BD[0]]).toEqual([1, 0, 1]);
    store.undo();
    expect(currentPattern(store.state.value).smp[4]?.[0]).toBe(1);
  });
});

describe('drumSoundPage', () => {
  const sliders = (el: Element) => [...el.querySelectorAll<HTMLElement>('[role=slider]')];

  it('Level, Tune, Decay der gewählten Stimme; Tune zeigt ±', () => {
    const { c, nav, store } = setup();
    const el = drumSoundPage(c, nav);
    expect(sliders(el).map((s) => s.getAttribute('aria-label'))).toEqual([
      'Level',
      'Tune',
      'Decay',
    ]);
    nav.selectTrack('SD');
    const [level, tune, decay] = sliders(el);
    tune?.dispatchEvent(new KeyboardEvent('keydown', { key: 'End' }));
    expect(store.state.value.params.SD.tune).toBe(1);
    expect(c.readout.text.value).toBe('SD Tune +50');
    tune?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home' }));
    expect(c.readout.text.value).toBe('SD Tune -50');
    level?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home' }));
    expect(store.state.value.params.SD.level).toBe(0);
    decay?.dispatchEvent(new KeyboardEvent('keydown', { key: 'End' }));
    expect(c.readout.text.value).toBe('SD Decay 100');
    expect(store.state.value.params.BD.decay).not.toBe(1);
  });

  it('Regler: nach dem Loslassen vorhören (nur im Stand), Doppeltipp = Werkseinstellung', () => {
    const { c, nav, store, audio } = setup();
    const el = drumSoundPage(c, nav);
    const tune = sliders(el)[1];
    const def = store.state.value.params.BD.tune;
    tune?.dispatchEvent(new KeyboardEvent('keydown', { key: 'End' }));
    const doubleTap = () => {
      for (let i = 0; i < 2; i++) {
        tune?.dispatchEvent(pointer('pointerdown'));
        tune?.dispatchEvent(pointer('pointerup'));
      }
    };
    doubleTap();
    expect(store.state.value.params.BD.tune).toBe(def);
    expect(audio.audition).toHaveBeenCalledWith('BD');
    audio.audition.mockClear();
    audio.playing.value = true;
    doubleTap();
    expect(audio.audition).not.toHaveBeenCalled();
  });

  it('nennt das eigene Sample (10 Zeichen) nur für Stimmen, die eines haben', () => {
    const { c, nav } = setup();
    const el = drumSoundPage(c, nav);
    const name = () => el.querySelector<HTMLElement>('.drum-smp-name');
    expect(name()?.hidden).toBe(true);
    c.samples.setDrum('BD', { pcm, name: 'Mein langer Name' });
    expect(name()?.hidden).toBe(false);
    expect(name()?.textContent).toBe('Mein lange');
    nav.selectTrack('SD');
    expect(name()?.hidden).toBe(true);
    expect(name()?.textContent).toBe('');
    c.samples.setDrum('SD', { pcm, name: 'Snap' });
    expect(name()?.textContent).toBe('Snap');
    nav.selectTrack('BD');
    expect(name()?.textContent).toBe('Mein lange');
    labelled(el, 'Zurück zum synthetischen Original-Klang')?.click();
    expect(name()?.hidden).toBe(true);
    expect(name()?.textContent).toBe('');
  });

  it('Eigenes Sample laden und zurück zum Original', () => {
    const { c, nav } = setup();
    const el = drumSoundPage(c, nav);
    const original = labelled(el, 'Zurück zum synthetischen Original-Klang');
    expect(labelled(el, 'Eigenes Sample für diese Spur laden')).not.toBeNull();
    expect(original?.disabled).toBe(true);
    c.samples.setDrum('BD', { pcm, name: 'Kick' });
    expect(original?.disabled).toBe(false);
    original?.click();
    expect(c.samples.drums.value.has('BD')).toBe(false);
  });
});
