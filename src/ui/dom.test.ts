import { describe, expect, it, vi } from 'vitest';
import { signal } from '../store/signals.ts';
import { bind, createScope, h, listen } from './dom.ts';

describe('h', () => {
  it('erzeugt Element mit Klasse, Text, Attributen, Ereignissen und Kindern', () => {
    const click = vi.fn();
    const el = h(
      'button',
      { class: 'chip', text: 'Los', attrs: { type: 'button' }, on: { click } },
      [h('span', { text: '!' }), null, false],
    );
    el.click();
    expect(el.outerHTML).toBe('<button class="chip" type="button">Los<span>!</span></button>');
    expect(click).toHaveBeenCalledTimes(1);
  });
});

describe('bind', () => {
  it('schreibt beim ersten Mal und nur bei Änderung', () => {
    const scope = createScope();
    const s = signal(1);
    const apply = vi.fn();
    bind(scope, () => s.value % 2, apply);
    s.value = 3;
    s.value = 4;
    expect(apply.mock.calls).toEqual([[1], [0]]);
    scope.dispose();
    s.value = 5;
    expect(apply).toHaveBeenCalledTimes(2);
  });
  it('was apply liest, wird nicht zur Abhängigkeit', () => {
    const scope = createScope();
    const a = signal(1);
    const other = signal(0);
    const read = vi.fn(() => a.value);
    bind(scope, read, () => other.value);
    other.value = 1;
    expect(read).toHaveBeenCalledTimes(1);
    scope.dispose();
  });
});

describe('listen und Scope', () => {
  it('entfernt Listener beim Aufräumen, in umgekehrter Reihenfolge', () => {
    const scope = createScope();
    const order: number[] = [];
    scope.add(() => order.push(1));
    const fn = vi.fn();
    const el = h('div');
    listen(scope, el, 'click', fn);
    scope.add(() => order.push(2));
    el.click();
    scope.dispose();
    el.click();
    expect(fn).toHaveBeenCalledTimes(1);
    expect(order).toEqual([2, 1]);
    scope.dispose();
    expect(order).toEqual([2, 1]);
  });
});
