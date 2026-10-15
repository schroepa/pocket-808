import { describe, expect, it } from 'vitest';
import { mixDefaults } from '../../../core/defaults.ts';
import { makeContext, pointer } from '../../test-utils.ts';
import { fxDevice, mixerDevice } from './device.ts';
import { fxSummary, mixSummary } from './format.ts';
import { fxPanel } from './fx.ts';
import { mixerPanel } from './mixer.ts';

const key = (el: Element | null | undefined, k: string) => {
  el?.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
};

describe('mixerPanel', () => {
  it('13 Kanalzüge; M und S schalten mit aria-pressed', () => {
    const { c, store } = makeContext();
    const el = mixerPanel(c);
    expect(el.querySelectorAll('.mx')).toHaveLength(13);
    const m = el.querySelector<HTMLButtonElement>('[aria-label="Snare Drum stumm"]');
    m?.click();
    expect(store.state.value.mix.SD.m).toBe(true);
    expect(m?.getAttribute('aria-pressed')).toBe('true');
    const s = el.querySelector<HTMLButtonElement>('[aria-label="Lead solo"]');
    s?.click();
    expect(store.state.value.mix.LD.s).toBe(true);
    expect(s?.getAttribute('aria-pressed')).toBe('true');
  });

  it('Fader: Wert, Meldung, Antippen wählt den Kanal, Doppelklick 80', () => {
    const { c, store } = makeContext();
    const el = mixerPanel(c);
    const f = el.querySelector<HTMLInputElement>('[aria-label="Lautstärke Cowbell"]');
    if (!f) throw new Error('Fader fehlt');
    f.dispatchEvent(pointer('pointerdown'));
    expect(el.querySelector('.mx.sel .nm')?.textContent).toBe('CB');
    expect(el.querySelector('.mix-sel')?.textContent).toBe('Kanal: Cowbell');
    f.value = '30';
    f.dispatchEvent(new Event('input'));
    expect(store.state.value.mix.CB.v).toBe(0.3);
    expect(c.readout.text.value).toBe('Cowbell Fader 30');
    f.dispatchEvent(new MouseEvent('dblclick'));
    expect(store.state.value.mix.CB.v).toBe(0.8);
    expect(f.value).toBe('80');
  });

  it('Name wählt den Kanal; Pan und Reverb des gewählten Kanals', () => {
    const { c, store } = makeContext();
    const el = mixerPanel(c);
    el.querySelector<HTMLButtonElement>('[aria-label="Kanal Sampler wählen"]')?.click();
    expect(el.querySelector('.mx.sel .nm')?.textContent).toBe('Smp');
    key(el.querySelector('[role=slider][aria-label="Pan"]'), 'Home');
    expect(store.state.value.mix.SM.p).toBe(0);
    expect(c.readout.text.value).toBe('SAMPLER Pan L 100');
    const rev = el.querySelector('[role=slider][aria-label="Reverb"]');
    key(rev, 'End');
    expect(store.state.value.mix.SM.r).toBe(1);
    expect(c.readout.text.value).toBe('SAMPLER Reverb 100%');
    for (let i = 0; i < 2; i++) {
      rev?.dispatchEvent(pointer('pointerdown'));
      rev?.dispatchEvent(pointer('pointerup'));
    }
    expect(store.state.value.mix.SM.r).toBe(mixDefaults().SM.r);
    const pan = el.querySelector('[role=slider][aria-label="Pan"]');
    for (let i = 0; i < 2; i++) {
      pan?.dispatchEvent(pointer('pointerdown'));
      pan?.dispatchEvent(pointer('pointerup'));
    }
    expect(store.state.value.mix.SM.p).toBe(0.5);
  });

  it('Fader folgt dem Zustand (z. B. nach Zurück)', () => {
    const { c, store } = makeContext();
    const el = mixerPanel(c);
    store.update((s) => ({ ...s, mix: { ...s.mix, BD: { ...s.mix.BD, v: 0.42 } } }));
    expect(el.querySelector<HTMLInputElement>('[aria-label="Lautstärke Bass Drum"]')?.value).toBe(
      '42',
    );
  });
});

describe('fxPanel', () => {
  it('Reverb- und DJ-Regler mit Texten', () => {
    const { c, store } = makeContext();
    const el = fxPanel(c);
    const k = (l: string) => el.querySelector(`[role=slider][aria-label="${l}"]`);
    key(k('Return'), 'Home');
    expect(store.state.value.fx.ret).toBe(0);
    expect(c.readout.text.value).toBe('REVERB Return 0%');
    key(k('Size'), 'End');
    expect(c.readout.text.value).toBe('REVERB Size 2.5 s');
    key(k('Damp'), 'Home');
    expect(store.state.value.fx.damp).toBe(0);
    key(k('Filter'), 'Home');
    expect(c.readout.text.value).toBe('DJ Filter Tiefpass 100%');
    key(k('Reso'), 'End');
    expect(store.state.value.fx.djq).toBe(1);
    for (let i = 0; i < 2; i++) {
      k('Size')?.dispatchEvent(pointer('pointerdown'));
      k('Size')?.dispatchEvent(pointer('pointerup'));
    }
    expect(store.state.value.fx.size).toBe(0.4);
  });

  it('Stutter halten: an beim Drücken, aus bei Loslassen, Abbruch und Zeigerverlust', () => {
    const { c, audio } = makeContext();
    const el = fxPanel(c);
    const b = el.querySelector<HTMLButtonElement>('[aria-label="Stutter 1/8 halten"]');
    b?.dispatchEvent(pointer('pointerdown'));
    expect(audio.stutterOn).toHaveBeenCalledWith(0.5);
    expect(b?.classList.contains('on')).toBe(true);
    b?.dispatchEvent(pointer('pointerup'));
    expect(audio.stutterOff).toHaveBeenCalledTimes(1);
    expect(b?.classList.contains('on')).toBe(false);
    b?.dispatchEvent(pointer('pointerup'));
    expect(audio.stutterOff).toHaveBeenCalledTimes(1);
    b?.dispatchEvent(pointer('pointerdown'));
    b?.dispatchEvent(pointer('pointercancel'));
    b?.dispatchEvent(pointer('pointerdown'));
    b?.dispatchEvent(pointer('lostpointercapture'));
    expect(audio.stutterOff).toHaveBeenCalledTimes(3);
  });

  it('Stutter per Tastatur (Leertaste/Enter halten)', () => {
    const { c, audio } = makeContext();
    const el = fxPanel(c);
    const b = el.querySelector<HTMLButtonElement>('[aria-label="Stutter 1/32 halten"]');
    b?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
    );
    b?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true, repeat: true }),
    );
    expect(audio.stutterOn).toHaveBeenCalledTimes(1);
    expect(audio.stutterOn).toHaveBeenCalledWith(0.125);
    b?.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
    expect(audio.stutterOff).toHaveBeenCalledTimes(1);
    b?.dispatchEvent(new KeyboardEvent('keydown', { key: 'x', bubbles: true }));
    expect(audio.stutterOn).toHaveBeenCalledTimes(1);
  });

  it('Stutter hängt nie: Fokusverlust, verstecktes Fenster und Abbau schalten aus', () => {
    const { c, audio } = makeContext();
    const el = fxPanel(c);
    const b = el.querySelector<HTMLButtonElement>('[aria-label="Stutter 1/4 halten"]');
    const hold = (): void => {
      b?.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
    };
    hold();
    b?.dispatchEvent(new FocusEvent('blur'));
    expect(audio.stutterOff).toHaveBeenCalledTimes(1);
    expect(b?.classList.contains('on')).toBe(false);
    hold();
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    expect(audio.stutterOff).toHaveBeenCalledTimes(2);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(audio.stutterOff).toHaveBeenCalledTimes(2);
    hold();
    c.scope.dispose();
    expect(audio.stutterOff).toHaveBeenCalledTimes(3);
  });
});

describe('Geräte Mixer und FX', () => {
  it('Zusammenfassungen und Körper', () => {
    const { c, store } = makeContext();
    const mix = mixerDevice(c);
    const fx = fxDevice(c);
    expect([mix.id, fx.id]).toEqual(['mix', 'fx']);
    expect(mix.summary.value).toBe(mixSummary(store.state.value.mix));
    expect(fx.summary.value).toBe(fxSummary(store.state.value.fx));
    expect(mix.body(c.scope).querySelectorAll('.mx')).toHaveLength(13);
    expect(fx.body(c.scope).querySelectorAll('.stp')).toHaveLength(4);
  });
});
