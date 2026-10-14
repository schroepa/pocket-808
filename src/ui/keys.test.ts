import { describe, expect, it } from 'vitest';
import { signal } from '../store/signals.ts';
import { h } from './dom.ts';
import { installKeys, shortcutHelp } from './keys.ts';
import type { Layout } from './layout.ts';
import { makeContext } from './test-utils.ts';

function setup(l: Layout = 'desktop') {
  const ctx = makeContext();
  const layout = signal<Layout>(l);
  installKeys(ctx.c, layout, document);
  const press = (key: string, init: KeyboardEventInit = {}, target: Element = document.body) => {
    const e = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
    target.dispatchEvent(e);
    return e;
  };
  return { ...ctx, layout, press };
}

describe('installKeys', () => {
  it('Leertaste startet und stoppt', () => {
    const { press, audio, scope } = setup();
    expect(press(' ').defaultPrevented).toBe(true);
    expect(audio.start).toHaveBeenCalled();
    press(' ');
    expect(audio.stop).toHaveBeenCalled();
    scope.dispose();
  });

  it('wirkt nur auf dem Desktop und nicht bei schon verarbeiteten Ereignissen', () => {
    const { press, audio, layout, scope } = setup('tablet');
    press(' ');
    expect(audio.start).not.toHaveBeenCalled();
    layout.value = 'desktop';
    const el = h('div');
    document.body.append(el);
    el.addEventListener('keydown', (e) => {
      e.preventDefault();
    });
    press(' ', {}, el);
    expect(audio.start).not.toHaveBeenCalled();
    press(' ');
    expect(audio.start).toHaveBeenCalled();
    scope.dispose();
  });

  it('Leertaste in einem Select bleibt beim Select', () => {
    const { press, audio, scope } = setup();
    const sel = h('select');
    document.body.append(sel);
    expect(press(' ', {}, sel).defaultPrevented).toBe(false);
    expect(audio.start).not.toHaveBeenCalled();
    scope.dispose();
  });

  it('1–8 wählt das Pattern, mit Modifikator nicht', () => {
    const { press, store, scope } = setup();
    press('2');
    expect(store.state.value.cur).toBe('B');
    press('3', { metaKey: true });
    press('4', { altKey: true });
    press('9');
    expect(store.state.value.cur).toBe('B');
    scope.dispose();
  });

  it('Pfeile wählen die Spur, begrenzt; auf einem Regler nicht', () => {
    const { press, store, scope } = setup();
    press('ArrowUp');
    expect(store.state.value.sel).toBe(0);
    press('ArrowDown');
    expect(store.state.value.sel).toBe(1);
    store.update((s) => ({ ...s, sel: 9 }));
    press('ArrowDown');
    expect(store.state.value.sel).toBe(9);
    const slider = h('div', { attrs: { role: 'slider', tabindex: '0' } });
    document.body.append(slider);
    press('ArrowUp', {}, slider);
    expect(store.state.value.sel).toBe(9);
    press('ArrowUp', { ctrlKey: true });
    expect(store.state.value.sel).toBe(9);
    scope.dispose();
  });

  it('Cmd+Z macht rückgängig, Strg+C/V kopiert und fügt ein', () => {
    const { press, store, c, scope } = setup();
    store.toggleStep('BD', 0);
    store.clearPattern();
    press('z', { metaKey: true, shiftKey: true });
    expect(store.state.value.patterns.A.BD[0]).toBe(0);
    press('z', { metaKey: true });
    expect(store.state.value.patterns.A.BD[0]).toBe(1);
    press('c', { ctrlKey: true });
    expect(c.readout.text.value).toBe('PATTERN A KOPIERT');
    store.selectSlot('C');
    press('v', { ctrlKey: true });
    expect(store.state.value.patterns.C.BD[0]).toBe(1);
    expect(c.readout.text.value).toBe('EINGEFÜGT IN C');
    scope.dispose();
  });

  it('Kopieren mit markiertem Text bleibt beim Text; Einfügen ohne Zwischenablage tut nichts', () => {
    const { press, store, scope } = setup();
    const p = h('p', { text: 'Text' });
    document.body.append(p);
    const range = document.createRange();
    range.selectNodeContents(p);
    document.getSelection()?.addRange(range);
    expect(press('c', { metaKey: true }).defaultPrevented).toBe(false);
    document.getSelection()?.removeAllRanges();
    const before = store.state.value;
    expect(press('v', { metaKey: true }).defaultPrevented).toBe(false);
    expect(store.state.value).toBe(before);
    scope.dispose();
  });
});

describe('installKeys: Dialog und Tastenwiederholung', () => {
  it('bei offenem Dialog wirken keine Kürzel', () => {
    const { press, audio, store, scope } = setup();
    const d = h('dialog', { attrs: { open: '' } }, [h('button', { text: 'Schließen' })]);
    document.body.append(d);
    const btn = d.querySelector('button');
    if (!btn) throw new Error('kein Knopf');
    expect(press(' ', {}, btn).defaultPrevented).toBe(false);
    press('3');
    press('ArrowDown');
    expect(audio.start).not.toHaveBeenCalled();
    expect(store.state.value.cur).toBe('A');
    expect(store.state.value.sel).toBe(0);
    d.remove();
    scope.dispose();
  });
  it('gehaltene Leertaste und Ziffern wiederholen nicht', () => {
    const { press, audio, store, scope } = setup();
    press(' ');
    press(' ', { repeat: true });
    press(' ', { repeat: true });
    expect(audio.start).toHaveBeenCalledTimes(1);
    expect(audio.stop).not.toHaveBeenCalled();
    press('2', { repeat: true });
    expect(store.state.value.cur).toBe('A');
    scope.dispose();
  });
});

describe('shortcutHelp', () => {
  it('öffnet den Dialog mit der Liste', () => {
    const { c } = makeContext();
    const el = shortcutHelp(c);
    document.body.append(el);
    el.querySelector<HTMLButtonElement>('[aria-label="Tastaturkürzel"]')?.click();
    const d = el.querySelector('dialog');
    expect(d?.open).toBe(true);
    expect(d?.textContent).toContain('Leertaste');
  });
  it('ohne showModal: Dialog über das open-Attribut', () => {
    const { c } = makeContext();
    const el = shortcutHelp(c);
    const d = el.querySelector('dialog');
    if (!d) throw new Error('kein Dialog');
    Object.defineProperty(d, 'showModal', { value: undefined });
    el.querySelector<HTMLButtonElement>('[aria-label="Tastaturkürzel"]')?.click();
    expect(d.hasAttribute('open')).toBe(true);
  });
});
