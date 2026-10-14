import { describe, expect, it, vi } from 'vitest';
import { signal } from '../../store/signals.ts';
import { createScope, h } from '../dom.ts';
import { chip } from './chip.ts';
import { markColumn } from './marker.ts';
import { segment } from './segment.ts';
import { stepButton } from './step-button.ts';

describe('chip', () => {
  it('Klick, aktiv, gesperrt, Text aus Signal', () => {
    const scope = createScope();
    const onClick = vi.fn();
    const active = signal(false);
    const disabled = signal(false);
    const label = signal('Eigenes Sample');
    const b = chip(scope, { label, ariaLabel: 'Laden', onClick, active, disabled });
    b.click();
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(b.getAttribute('aria-label')).toBe('Laden');
    expect(b.getAttribute('aria-pressed')).toBe('false');
    active.value = true;
    expect(b.classList.contains('active')).toBe(true);
    expect(b.getAttribute('aria-pressed')).toBe('true');
    disabled.value = true;
    expect(b.disabled).toBe(true);
    label.value = 'Sample ersetzen';
    expect(b.textContent).toBe('Sample ersetzen');
  });
  it('ohne active kein aria-pressed', () => {
    const b = chip(createScope(), { label: 'Leeren', onClick: () => undefined });
    expect(b.hasAttribute('aria-pressed')).toBe(false);
    expect(b.type).toBe('button');
  });
});

describe('segment', () => {
  it('radiogroup mit Pfeiltasten und rovingem tabindex', () => {
    const scope = createScope();
    const value = signal<'pattern' | 'song'>('pattern');
    const write = vi.fn((v: 'pattern' | 'song') => {
      value.value = v;
    });
    const g = segment(scope, {
      label: 'Wiedergabe',
      options: [
        { value: 'pattern', label: 'Pattern' },
        { value: 'song', label: 'Song' },
      ],
      value,
      write,
    });
    document.body.append(g);
    const [a, b] = [...g.querySelectorAll<HTMLButtonElement>('[role=radio]')];
    if (!a || !b) throw new Error('Knöpfe fehlen');
    expect(g.getAttribute('role')).toBe('radiogroup');
    expect(a.getAttribute('aria-checked')).toBe('true');
    expect([a.tabIndex, b.tabIndex]).toEqual([0, -1]);
    a.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(write).toHaveBeenCalledWith('song');
    expect(document.activeElement).toBe(b);
    expect([a.tabIndex, b.tabIndex]).toEqual([-1, 0]);
    b.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(write).toHaveBeenLastCalledWith('pattern');
    a.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(write).toHaveBeenLastCalledWith('song');
    b.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    expect(write).toHaveBeenLastCalledWith('pattern');
    const other = new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true });
    a.dispatchEvent(other);
    expect(other.defaultPrevented).toBe(false);
    b.click();
    expect(write).toHaveBeenLastCalledWith('song');
  });
});

describe('stepButton', () => {
  it('on, sub und gesperrt als Klassen und ARIA', () => {
    const scope = createScope();
    const on = signal(false);
    const sub = signal(false);
    const disabled = signal(false);
    const onPress = vi.fn();
    const b = stepButton(scope, {
      label: 'Step 1',
      text: '1',
      class: 'step',
      on,
      sub,
      disabled,
      onPress,
    });
    b.click();
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(b.getAttribute('aria-label')).toBe('Step 1');
    on.value = true;
    sub.value = true;
    expect(b.className).toBe('step on sub');
    expect(b.getAttribute('aria-pressed')).toBe('true');
    disabled.value = true;
    expect(b.disabled).toBe(true);
  });
  it('ohne Text kein Kind', () => {
    const b = stepButton(createScope(), {
      label: 'x',
      class: 'cell',
      on: signal(false),
      onPress: () => undefined,
    });
    expect(b.childElementCount).toBe(0);
  });
});

describe('markColumn', () => {
  it('setzt die Klasse nur an alter und neuer Spalte', () => {
    const scope = createScope();
    const cols = Array.from({ length: 4 }, () => [h('div'), h('div')]);
    const step = signal(-1);
    markColumn(scope, step, (s) => cols[s] ?? []);
    step.value = 1;
    expect(cols[1]?.every((e) => e.classList.contains('now'))).toBe(true);
    step.value = 2;
    expect(cols[1]?.some((e) => e.classList.contains('now'))).toBe(false);
    expect(cols[2]?.every((e) => e.classList.contains('now'))).toBe(true);
    step.value = -1;
    expect(cols.flat().some((e) => e.classList.contains('now'))).toBe(false);
  });
});
