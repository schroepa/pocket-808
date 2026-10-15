import { describe, expect, it } from 'vitest';
import { makeContext, pointer } from '../test-utils.ts';
import { transport } from './transport.ts';

describe('transport', () => {
  it('Start/Stopp mit Beschriftung, Symbol und aria-pressed', () => {
    const { c, audio } = makeContext();
    const el = transport(c);
    const play = el.querySelector<HTMLButtonElement>('.play');
    const icon = () => play?.querySelector('path')?.getAttribute('d');
    expect(play?.textContent).toBe('Start');
    const playIcon = icon();
    play?.click();
    expect(audio.start).toHaveBeenCalledTimes(1);
    expect(play?.getAttribute('aria-pressed')).toBe('true');
    expect(play?.textContent).toBe('Stopp');
    expect(icon()).not.toBe(playIcon);
    play?.click();
    expect(audio.stop).toHaveBeenCalledTimes(1);
  });
  it('Pattern/Song schaltet den Modus', () => {
    const { c, store } = makeContext();
    const el = transport(c);
    el.querySelectorAll<HTMLButtonElement>('[role=radio]')[1]?.click();
    expect(store.state.value.mode).toBe('song');
  });
});

describe('Fill-Taste', () => {
  it('halten schaltet Fill an, Loslassen, Abbruch und Fokusverlust aus', () => {
    const { c, audio, scope } = makeContext();
    const el = transport(c);
    const fill = el.querySelector<HTMLButtonElement>('[aria-label="Fill halten"]');
    if (!fill) throw new Error('Fill');
    fill.dispatchEvent(pointer('pointerdown'));
    expect(audio.setFill).toHaveBeenLastCalledWith(true);
    expect(fill.classList.contains('on')).toBe(true);
    fill.dispatchEvent(pointer('pointerup'));
    expect(audio.setFill).toHaveBeenLastCalledWith(false);
    fill.dispatchEvent(pointer('pointerdown'));
    fill.dispatchEvent(pointer('pointercancel'));
    expect(audio.setFill).toHaveBeenLastCalledWith(false);
    fill.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true }));
    fill.dispatchEvent(new FocusEvent('blur'));
    expect(audio.setFill).toHaveBeenLastCalledWith(false);
    fill.dispatchEvent(pointer('pointerdown'));
    scope.dispose();
    expect(audio.setFill).toHaveBeenLastCalledWith(false);
  });
});
