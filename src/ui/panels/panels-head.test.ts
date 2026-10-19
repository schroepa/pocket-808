import { describe, expect, it, vi } from 'vitest';
import { makeContext, pointer } from '../test-utils.ts';
import { brand } from './brand.ts';
import { deck } from './deck.ts';
import { slots } from './slots.ts';

describe('brand', () => {
  it('Titel und optionale Werkzeuge', () => {
    const a = document.createElement('span');
    const b = document.createElement('span');
    const el = brand(a, b);
    expect(el.querySelector('h1')?.textContent).toBe('Pocket 808');
    expect([...(el.querySelector('.brand-tools')?.children ?? [])]).toEqual([a, b]);
    expect(brand().getAttribute('data-area')).toBe('brand');
    expect(brand().querySelector('.brand-tools')).toBeNull();
  });
});

describe('deck', () => {
  it('zeigt das Tempo dreistellig und die LCD-Zeile', () => {
    const { c, store } = makeContext();
    const el = deck(c);
    const digits = () => el.querySelector('.lcd-digits')?.textContent;
    expect(digits()).toBe(String(store.state.value.tempo).padStart(3, '0'));
    store.update((s) => ({ ...s, tempo: 95 }));
    expect(digits()).toBe('095');
    expect(el.querySelector('.lcd-sub')?.textContent).toBe('BD · Bass Drum');
  });

  it('Tap-Knopf: erster Tipp meldet, zweiter setzt das Tempo (ohne Zurück)', () => {
    const { c, store } = makeContext();
    const el = deck(c);
    const btn = el.querySelector<HTMLButtonElement>('[aria-label="Tempo antippen"]');
    const now = vi.spyOn(performance, 'now');
    now.mockReturnValue(5_000);
    btn?.click();
    expect(c.readout.text.value).toBe('TAP · weiter tippen');
    now.mockReturnValue(5_400);
    btn?.click();
    expect(store.state.value.tempo).toBe(150);
    expect(el.querySelector('.lcd-digits')?.textContent).toBe('150');
    expect(store.canUndo.value).toBe(false);
    now.mockRestore();
  });

  it('Tempo-, Swing- und Master-Regler schreiben in den Store', () => {
    const { c, store } = makeContext();
    const el = deck(c);
    const [tempo, swing, master] = [...el.querySelectorAll<HTMLElement>('[role=slider]')];
    tempo?.dispatchEvent(new KeyboardEvent('keydown', { key: 'End' }));
    expect(store.state.value.tempo).toBe(200);
    expect(c.readout.text.value).toBe('Tempo 200 BPM');
    swing?.dispatchEvent(new KeyboardEvent('keydown', { key: 'End' }));
    expect(store.state.value.swing).toBe(1);
    expect(c.readout.text.value).toBe('Swing 100 %');
    master?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home' }));
    expect(store.state.value.master).toBe(0);
    expect(c.readout.text.value).toBe('Master 0');
  });

  it('Doppeltipp: Tempo 90, Swing 0, Master 0,8', () => {
    const { c, store } = makeContext();
    store.update((s) => ({ ...s, tempo: 150, swing: 0.5, master: 0.3 }));
    const el = deck(c);
    for (const k of el.querySelectorAll<HTMLElement>('[role=slider]')) {
      for (let i = 0; i < 2; i++) {
        k.dispatchEvent(pointer('pointerdown'));
        k.dispatchEvent(pointer('pointerup'));
      }
    }
    expect(store.state.value.tempo).toBe(90);
    expect(store.state.value.swing).toBe(0);
    expect(store.state.value.master).toBe(0.8);
  });
});

describe('slots', () => {
  it('wählt Pattern, markiert Auswahl und Inhalt', () => {
    const { c, store } = makeContext();
    const el = slots(c);
    const b = el.querySelector<HTMLButtonElement>('[aria-label="Pattern B"]');
    b?.click();
    expect(store.state.value.cur).toBe('B');
    expect(b?.getAttribute('aria-pressed')).toBe('true');
    expect(b?.classList.contains('sel')).toBe(true);
    expect(b?.classList.contains('has')).toBe(false);
    store.toggleStep('BD', 0);
    expect(b?.classList.contains('has')).toBe(true);
  });
});
