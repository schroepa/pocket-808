import { describe, expect, it } from 'vitest';
import { mixDefaults } from '../../../core/defaults.ts';
import { signal } from '../../../store/signals.ts';
import type { Layout } from '../../layout.ts';
import { makeContext, pointer } from '../../test-utils.ts';
import { fxPanel } from './fx.ts';
import { channelStrips, mixerWork, sceneRow } from './mixer.ts';

const key = (el: Element | null | undefined, k: string) => {
  el?.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
};

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

describe('Szenen im Mixer', () => {
  it('leer sichern, belegt abrufen, Sichern-Modus überschreibt, Markierung und Zurück', () => {
    const { c, store } = makeContext();
    const el = sceneRow(c);
    const scene = (n: number) =>
      el.querySelector<HTMLButtonElement>(`[aria-label="Szene ${String(n)}"]`);
    const saveMode = [...el.querySelectorAll<HTMLButtonElement>('button')].find(
      (b) => b.textContent === 'Sichern',
    );
    scene(1)?.click();
    expect(store.state.value.scenes?.[0]?.BD.v).toBe(store.state.value.mix.BD.v);
    expect(c.readout.text.value).toBe('Szene 1 gesichert');
    expect(scene(1)?.classList.contains('has')).toBe(true);
    expect(scene(1)?.getAttribute('aria-pressed')).toBe('true');
    store.update((s) => ({ ...s, mix: { ...s.mix, BD: { ...s.mix.BD, m: true } } }));
    scene(1)?.click();
    expect(store.state.value.mix.BD.m).toBe(false);
    expect(c.readout.text.value).toBe('Szene 1');
    store.undo();
    expect(store.state.value.mix.BD.m).toBe(true);
    saveMode?.click();
    expect(saveMode?.getAttribute('aria-pressed')).toBe('true');
    scene(1)?.click();
    expect(store.state.value.scenes?.[0]?.BD.m).toBe(true);
    expect(saveMode?.getAttribute('aria-pressed')).toBe('false');
    scene(2)?.click();
    expect(scene(2)?.getAttribute('aria-pressed')).toBe('true');
    expect(scene(1)?.getAttribute('aria-pressed')).toBe('false');
  });
});

describe('Klang im FX-Feld', () => {
  it('Warm schaltet um, Tape stellt den Wert und löscht das Feld bei 0', () => {
    const { c, store } = makeContext();
    const el = fxPanel(c);
    const warm = el.querySelector<HTMLButtonElement>('[aria-label="Warmer, analoger Klang"]');
    warm?.click();
    expect(store.state.value.warm).toBe(true);
    expect(warm?.getAttribute('aria-pressed')).toBe('true');
    expect(c.readout.text.value).toBe('WARM AN');
    warm?.click();
    expect('warm' in store.state.value).toBe(false);
    expect(c.readout.text.value).toBe('WARM AUS');
    const tape = el.querySelector('[role=slider][aria-label="Tape"]');
    key(tape, 'End');
    expect(store.state.value.tape).toBe(1);
    expect(c.readout.text.value).toBe('TAPE Tape 100%');
    key(tape, 'Home');
    expect('tape' in store.state.value).toBe(false);
    // Doppeltipp setzt auf den Standard (aus)
    key(tape, 'End');
    for (let i = 0; i < 2; i++) {
      tape?.dispatchEvent(pointer('pointerdown'));
      tape?.dispatchEvent(pointer('pointerup'));
    }
    expect('tape' in store.state.value).toBe(false);
  });
});

describe('Kanäle', () => {
  const setup = () => {
    const ctx = makeContext();
    const el = channelStrips(ctx.c);
    const q = (label: string) => el.querySelector<HTMLElement>(`[aria-label="${label}"]`);
    return { ...ctx, el, q };
  };

  it('13 Züge mit Namensknopf und senkrechtem Regler', () => {
    const { el } = setup();
    const strips = [...el.querySelectorAll('.ch-strip')];
    expect(strips).toHaveLength(13);
    expect(strips.at(0)?.querySelector('button')?.getAttribute('aria-label')).toBe(
      'Kanal Bass Drum wählen',
    );
    expect(strips.at(-1)?.querySelector('button')?.textContent).toBe('Smp');
    expect(strips.at(-1)?.querySelector('[role=slider]')?.getAttribute('aria-label')).toBe(
      'Lautstärke Sampler',
    );
    // M und S nur einmal, für den gewählten Kanal; kein Level doppelt
    expect(el.querySelectorAll('.mb')).toHaveLength(2);
    expect(el.querySelector('[role=slider][aria-label="Level"]')).toBeNull();
  });

  it('Fader schreibt, wählt den Kanal, Doppeltipp 80, folgt dem Zustand', () => {
    const { c, store, q } = setup();
    const f = q('Lautstärke Cowbell');
    key(f, 'Home');
    expect(store.state.value.mix.CB.v).toBe(0);
    expect(c.readout.text.value).toBe('Lautstärke Cowbell 0');
    expect(q('Kanal Cowbell wählen')?.getAttribute('aria-pressed')).toBe('true');
    expect(q('Kanal Bass Drum wählen')?.getAttribute('aria-pressed')).toBe('false');
    for (let i = 0; i < 2; i++) {
      f?.dispatchEvent(pointer('pointerdown'));
      f?.dispatchEvent(pointer('pointerup'));
    }
    expect(store.state.value.mix.CB.v).toBe(0.8);
    store.update((s) => ({ ...s, mix: { ...s.mix, CB: { ...s.mix.CB, v: 0.42 } } }));
    expect(f?.getAttribute('aria-valuenow')).toBe('42');
    q('Lautstärke Lead')?.dispatchEvent(pointer('pointerdown'));
    expect(q('Kanal Lead wählen')?.getAttribute('aria-pressed')).toBe('true');
  });

  it('Zug zeigt Stumm und Solo, M/S/Pan/Reverb wirken auf den gewählten Kanal', () => {
    const { store, q } = setup();
    const strip = q('Kanal Snare Drum wählen')?.closest('.ch-strip');
    q('Kanal Snare Drum wählen')?.click();
    expect(strip?.classList.contains('sel')).toBe(true);
    q('Snare Drum stumm')?.click();
    q('Snare Drum solo')?.click();
    expect(store.state.value.mix.SD).toMatchObject({ m: true, s: true });
    expect(strip?.classList.contains('muted')).toBe(true);
    expect(strip?.classList.contains('solo')).toBe(true);
    key(q('Pan'), 'Home');
    key(q('Reverb'), 'End');
    expect(store.state.value.mix.SD).toMatchObject({ p: 0, r: 1 });
    q('Snare Drum stumm')?.click();
    q('Snare Drum solo')?.click();
    expect(strip?.classList.contains('muted')).toBe(false);
    expect(strip?.classList.contains('solo')).toBe(false);
  });

  it('Name wählt den Kanal; Pan und Reverb melden ihn, Doppeltipp = Werkseinstellung', () => {
    const { c, store, q } = setup();
    q('Kanal Sampler wählen')?.click();
    expect(q('Kanal Sampler wählen')?.getAttribute('aria-pressed')).toBe('true');
    key(q('Pan'), 'Home');
    expect(store.state.value.mix.SM.p).toBe(0);
    expect(c.readout.text.value).toBe('SAMPLER Pan L 100');
    key(q('Reverb'), 'End');
    expect(store.state.value.mix.SM.r).toBe(1);
    expect(c.readout.text.value).toBe('SAMPLER Reverb 100%');
    for (const l of ['Reverb', 'Pan']) {
      for (let i = 0; i < 2; i++) {
        q(l)?.dispatchEvent(pointer('pointerdown'));
        q(l)?.dispatchEvent(pointer('pointerup'));
      }
    }
    expect(store.state.value.mix.SM.r).toBe(mixDefaults().SM.r);
    expect(store.state.value.mix.SM.p).toBe(0.5);
  });
});

describe('mixerWork', () => {
  const setup = (at: Layout = 'mobile') => {
    const ctx = makeContext();
    const layout = signal<Layout>(at);
    const el = mixerWork(ctx.c, layout);
    const visible = () =>
      [...el.querySelectorAll<HTMLElement>('section')]
        .filter((s) => !s.hidden)
        .map((s) => s.getAttribute('aria-label'));
    const tabs = () => [...el.querySelectorAll<HTMLButtonElement>('[role=tab]')];
    const tab = (name: string) => tabs().find((t) => t.textContent === name);
    return { ...ctx, el, layout, visible, tabs, tab };
  };

  it('mobile eine Seite, tablet zwei Ansichten, desktop alles ohne Reiter', () => {
    const { el, layout, visible, tabs, tab } = setup();
    const list = el.querySelector<HTMLElement>('[role=tablist]');
    expect(list?.getAttribute('aria-label')).toBe('Mixer');
    expect(tabs().map((t) => t.textContent)).toEqual(['Kanäle', 'Szenen', 'FX']);
    expect(visible()).toEqual(['Kanäle']);
    tab('Szenen')?.click();
    expect(visible()).toEqual(['Szenen']);
    layout.value = 'tablet';
    expect(tabs().map((t) => t.textContent)).toEqual(['Kanäle · Szenen', 'FX']);
    expect(visible()).toEqual(['Kanäle', 'Szenen']);
    tab('FX')?.click();
    expect(visible()).toEqual(['FX']);
    layout.value = 'desktop';
    expect(list?.hidden).toBe(true);
    expect(visible()).toEqual(['Kanäle', 'Szenen', 'FX']);
    layout.value = 'mobile';
    expect(visible()).toEqual(['FX']);
    expect(el.querySelectorAll('.ch-strip')).toHaveLength(13);
    expect(el.querySelectorAll('.scene')).toHaveLength(8);
    expect(el.querySelectorAll('.stp')).toHaveLength(4);
  });

  it('Seitenwechsel weg von FX löst Stutter', () => {
    const { el, audio, layout, tab } = setup();
    tab('FX')?.click();
    const b = el.querySelector<HTMLButtonElement>('[aria-label="Stutter 1/8 halten"]');
    b?.dispatchEvent(pointer('pointerdown'));
    expect(audio.stutterOn).toHaveBeenCalledTimes(1);
    tab('Kanäle')?.click();
    expect(audio.stutterOff).toHaveBeenCalledTimes(1);
    expect(b?.getAttribute('aria-pressed')).toBe('false');
    // ebenso beim Drehen: gehalten auf dem Desktop, schmal steht wieder die Seite Kanäle da
    layout.value = 'desktop';
    b?.dispatchEvent(pointer('pointerdown'));
    expect(audio.stutterOn).toHaveBeenCalledTimes(2);
    expect(audio.stutterOff).toHaveBeenCalledTimes(1);
    layout.value = 'mobile';
    expect(audio.stutterOff).toHaveBeenCalledTimes(2);
  });
});

describe('sceneRow', () => {
  it('steht für sich: acht Szenen und Sichern', () => {
    const { c, store } = makeContext();
    const el = sceneRow(c);
    expect(el.querySelectorAll('.scene')).toHaveLength(8);
    el.querySelector<HTMLButtonElement>('[aria-label="Szene 3"]')?.click();
    expect(store.state.value.scenes?.[2]).toBeTruthy();
  });
});
