import { afterEach, describe, expect, it, vi } from 'vitest';
import { must } from '../../core/util.ts';
import { signal } from '../../store/signals.ts';
import { createScope, h } from '../dom.ts';
import { punchGrid } from '../panels/punch/punch.ts';
import { makeContext, pointer } from '../test-utils.ts';
import { holdButton, releaseHolds } from './hold.ts';
import { sheet } from './sheet.ts';
import { tabs } from './tabs.ts';
import { show } from './visible.ts';

afterEach(() => {
  document.body.replaceChildren();
});

const key = (target: Element, k: string, init: KeyboardEventInit = {}): KeyboardEvent => {
  const e = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(e);
  return e;
};

describe('tabs', () => {
  type Page = 'trig' | 'klang' | 'mix' | 'amp';
  const setup = (start: Page = 'trig') => {
    const scope = createScope();
    const items = signal<readonly { value: Page; label: string }[]>([
      { value: 'trig', label: 'Trig' },
      { value: 'klang', label: 'Klang' },
      { value: 'mix', label: 'Mix' },
    ]);
    const value = signal<Page>(start);
    const write = vi.fn((v: Page) => {
      value.value = v;
    });
    const el = tabs(scope, { label: 'Seite', items, value, write });
    document.body.append(el);
    const buttons = () => [...el.querySelectorAll<HTMLButtonElement>('[role=tab]')];
    const at = (i: number) => must(buttons()[i], 'Reiter');
    const selected = () => buttons().map((b) => b.getAttribute('aria-selected'));
    const stops = () => buttons().map((b) => b.tabIndex);
    return { scope, items, value, write, el, buttons, at, selected, stops };
  };

  it('tablist mit Namen, ein Tab-Stopp, aria-selected folgt dem Wert', () => {
    const t = setup();
    expect(t.el.getAttribute('role')).toBe('tablist');
    expect(t.el.getAttribute('aria-label')).toBe('Seite');
    expect(t.buttons().map((b) => [b.type, b.textContent])).toEqual([
      ['button', 'Trig'],
      ['button', 'Klang'],
      ['button', 'Mix'],
    ]);
    expect(t.selected()).toEqual(['true', 'false', 'false']);
    expect(t.stops()).toEqual([0, -1, -1]);
    t.value.value = 'mix';
    expect(t.selected()).toEqual(['false', 'false', 'true']);
    expect(t.stops()).toEqual([-1, -1, 0]);
  });

  it('Klick und Pfeiltasten schreiben, Pfeile fokussieren und laufen um', () => {
    const t = setup();
    t.at(1).click();
    expect(t.write).toHaveBeenLastCalledWith('klang');
    expect(t.selected()).toEqual(['false', 'true', 'false']);
    expect(key(t.at(1), 'ArrowRight').defaultPrevented).toBe(true);
    expect(t.write).toHaveBeenLastCalledWith('mix');
    expect(document.activeElement).toBe(t.at(2));
    key(t.at(2), 'ArrowRight');
    expect(t.write).toHaveBeenLastCalledWith('trig');
    expect(document.activeElement).toBe(t.at(0));
    key(t.at(0), 'ArrowLeft');
    expect(t.write).toHaveBeenLastCalledWith('mix');
    expect(document.activeElement).toBe(t.at(2));
    expect(t.stops()).toEqual([-1, -1, 0]);
  });

  it('andere Tasten bleiben unberührt (↑/↓ wählen Spuren)', () => {
    const t = setup();
    for (const k of ['ArrowUp', 'ArrowDown', 'a']) {
      expect(key(t.at(0), k).defaultPrevented).toBe(false);
    }
    expect(t.write).not.toHaveBeenCalled();
  });

  it('neue Liste ersetzt die Reiter, der gewählte bleibt gewählt', () => {
    const t = setup('mix');
    const old = t.at(0);
    t.items.value = [
      { value: 'amp', label: 'Amp' },
      { value: 'mix', label: 'Mix' },
    ];
    expect(t.buttons().map((b) => b.textContent)).toEqual(['Amp', 'Mix']);
    expect(old.isConnected).toBe(false);
    expect(t.selected()).toEqual(['false', 'true']);
    expect(t.stops()).toEqual([-1, 0]);
    t.at(0).click();
    expect(t.write).toHaveBeenLastCalledWith('amp');
  });

  it('Fokus in den Reitern überlebt eine neue Liste', () => {
    const t = setup('mix');
    t.at(2).focus();
    t.items.value = [{ value: 'mix', label: 'Mix' }];
    expect(document.activeElement).toBe(t.at(0));
  });

  it('neue Liste holt keinen fremden Fokus', () => {
    const t = setup();
    const other = h('button');
    document.body.append(other);
    other.focus();
    t.items.value = [{ value: 'trig', label: 'Trig' }];
    expect(document.activeElement).toBe(other);
  });

  it('Wert außerhalb der Liste: erster Reiter bleibt erreichbar, Pfeil wählt von dort', () => {
    const t = setup('amp');
    expect(t.selected()).toEqual(['false', 'false', 'false']);
    expect(t.stops()).toEqual([0, -1, -1]);
    key(t.at(0), 'ArrowRight');
    expect(t.write).toHaveBeenLastCalledWith('klang');
  });

  it('leere Liste und dispose sind folgenlos', () => {
    const t = setup();
    t.items.value = [];
    expect(key(t.el, 'ArrowRight').defaultPrevented).toBe(false);
    t.scope.dispose();
    t.items.value = [{ value: 'trig', label: 'Trig' }];
    expect(t.buttons()).toEqual([]);
    expect(t.write).not.toHaveBeenCalled();
  });
});

describe('sheet', () => {
  const setup = () => {
    const scope = createScope();
    const open = signal(false);
    const close = vi.fn(() => {
      open.value = false;
    });
    const pad = h('button', { text: 'Pad', attrs: { type: 'button' } });
    const content = h('div', {}, [pad]);
    const opener = h('button', { text: 'öffnen' });
    const other = h('button', { text: 'daneben' });
    const el = sheet(scope, { label: 'Spur wählen', open, close, content });
    document.body.append(opener, other, el);
    opener.focus();
    const closer = must(el.querySelectorAll('button')[0], 'Schließen');
    return { scope, open, close, content, pad, opener, other, el, closer };
  };

  it('nicht modaler Dialog mit Namen, Inhalt und Knopf „Schließen“; zu = hidden', () => {
    const s = setup();
    expect(s.el.getAttribute('role')).toBe('dialog');
    expect(s.el.getAttribute('aria-label')).toBe('Spur wählen');
    expect(s.el.hasAttribute('aria-modal')).toBe(false);
    expect(s.el.contains(s.content)).toBe(true);
    expect(s.closer.textContent).toBe('Schließen');
    expect(s.el.hidden).toBe(true);
    expect(document.activeElement).toBe(s.opener);
    s.open.value = true;
    expect(s.el.hidden).toBe(false);
    s.open.value = false;
    expect(s.el.hidden).toBe(true);
  });

  it('offen fokussiert den ersten Knopf, beim Schließen kehrt der Fokus zurück', () => {
    const s = setup();
    s.open.value = true;
    expect(document.activeElement).toBe(s.closer);
    s.pad.focus();
    s.open.value = false;
    expect(document.activeElement).toBe(s.opener);
  });

  it('Fokus verloren (body): kehrt beim Schließen ebenfalls zurück', () => {
    const s = setup();
    s.open.value = true;
    s.closer.blur();
    s.open.value = false;
    expect(document.activeElement).toBe(s.opener);
  });

  it('Fokus außerhalb der Fläche wird beim Schließen nicht weggenommen', () => {
    const s = setup();
    s.open.value = true;
    s.other.focus();
    s.open.value = false;
    expect(document.activeElement).toBe(s.other);
  });

  it('Escape und Schließen rufen close', () => {
    const s = setup();
    s.open.value = true;
    s.closer.click();
    expect(s.close).toHaveBeenCalledTimes(1);
    s.open.value = true;
    expect(key(s.pad, 'Escape').defaultPrevented).toBe(true);
    expect(s.close).toHaveBeenCalledTimes(2);
    // nicht modal: Escape gilt auch, wenn der Fokus daneben liegt
    s.open.value = true;
    key(s.other, 'Escape');
    expect(s.close).toHaveBeenCalledTimes(3);
  });

  it('Escape ohne Wirkung: zu, andere Taste, schon verbraucht, modaler Dialog davor, dispose', () => {
    const s = setup();
    expect(key(s.other, 'Escape').defaultPrevented).toBe(false);
    s.open.value = true;
    key(s.pad, 'Enter');
    s.pad.addEventListener(
      'keydown',
      (e) => {
        e.preventDefault();
      },
      { once: true },
    );
    key(s.pad, 'Escape');
    const modal = h('dialog', { attrs: { open: '' } });
    document.body.append(modal);
    key(modal, 'Escape');
    modal.remove();
    s.scope.dispose();
    key(s.pad, 'Escape');
    expect(s.close).not.toHaveBeenCalled();
  });

  it('Schließen löst gehaltene Tasten im Inhalt', () => {
    const s = setup();
    const off = vi.fn();
    const hold = holdButton(s.scope, {
      class: 'x',
      text: 'Halten',
      ariaLabel: 'Halten',
      on: () => undefined,
      off,
    });
    s.content.append(hold);
    s.open.value = true;
    hold.dispatchEvent(pointer('pointerdown'));
    s.open.value = false;
    expect(off).toHaveBeenCalledTimes(1);
  });
});

describe('releaseHolds', () => {
  const setup = () => {
    const scope = createScope();
    const make = (name: string) => {
      const on = vi.fn();
      const off = vi.fn();
      const b = holdButton(scope, { class: 'x', text: name, ariaLabel: name, on, off });
      return { b, on, off };
    };
    const a = make('a');
    const b = make('b');
    const outside = make('c');
    const root = h('div', {}, [h('div', {}, [a.b]), b.b]);
    document.body.append(root, outside.b);
    return { root, a, b, outside };
  };

  it('ruft off genau einmal je gehaltener Taste unter root', () => {
    const { root, a, b, outside } = setup();
    a.b.dispatchEvent(pointer('pointerdown'));
    key(b.b, 'Enter');
    outside.b.dispatchEvent(pointer('pointerdown'));
    releaseHolds(root);
    releaseHolds(root);
    // das spätere Loslassen des Fingers bzw. der Taste darf nicht noch einmal ausschalten
    a.b.dispatchEvent(pointer('pointerup'));
    b.b.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
    for (const x of [a, b]) {
      expect(x.off).toHaveBeenCalledTimes(1);
      expect(x.b.getAttribute('aria-pressed')).toBe('false');
      expect(x.b.classList.contains('on')).toBe(false);
    }
    expect(outside.off).not.toHaveBeenCalled();
    expect(outside.b.getAttribute('aria-pressed')).toBe('true');
  });

  it('ohne Halten folgenlos', () => {
    const { root, a, b } = setup();
    releaseHolds(root);
    expect(a.off).not.toHaveBeenCalled();
    expect(b.off).not.toHaveBeenCalled();
    expect(a.on).not.toHaveBeenCalled();
  });

  it('root darf selbst die Taste sein', () => {
    const { a } = setup();
    a.b.dispatchEvent(pointer('pointerdown'));
    releaseHolds(a.b);
    expect(a.off).toHaveBeenCalledTimes(1);
  });

  it('Tastenwiederholung schaltet nach dem Lösen nicht wieder ein', () => {
    const { root, a } = setup();
    key(a.b, ' ');
    releaseHolds(root);
    expect(key(a.b, ' ', { repeat: true }).defaultPrevented).toBe(true);
    expect(a.on).toHaveBeenCalledTimes(1);
    expect(a.b.getAttribute('aria-pressed')).toBe('false');
  });

  it('nach dispose hört die Taste nicht mehr zu', () => {
    const scope = createScope();
    const off = vi.fn();
    const b = holdButton(scope, {
      class: 'x',
      text: 'x',
      ariaLabel: 'x',
      on: () => undefined,
      off,
    });
    scope.dispose();
    const spy = vi.spyOn(b.classList, 'contains');
    releaseHolds(b);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('show', () => {
  it('blendet aus und ein', () => {
    const el = h('div');
    show(el, false);
    expect(el.hidden).toBe(true);
    show(el, true);
    expect(el.hidden).toBe(false);
  });

  it('show(el,false) löst ein gehaltenes Punch-Pad', () => {
    const { c, audio, scope } = makeContext();
    const el = punchGrid({ ...c, scope });
    document.body.append(el);
    const pad = must(el.querySelectorAll('button')[0], 'Pad');
    pad.dispatchEvent(pointer('pointerdown'));
    show(el, true);
    expect(audio.punchOff).not.toHaveBeenCalled();
    show(el, false);
    expect(el.hidden).toBe(true);
    expect(audio.punchOff).toHaveBeenCalledTimes(1);
    expect(pad.getAttribute('aria-pressed')).toBe('false');
  });
});
