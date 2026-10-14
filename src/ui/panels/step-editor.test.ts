import { describe, expect, it } from 'vitest';
import { countMutations, makeContext, pointer } from '../test-utils.ts';
import { stepEditor } from './step-editor.ts';

const steps = (el: HTMLElement) => [...el.querySelectorAll<HTMLButtonElement>('.steps .step')];

describe('stepEditor', () => {
  it('Titel nennt Stimme und Namen; folgt der Auswahl und dem eigenen Sample', () => {
    const { c, store } = makeContext();
    const el = stepEditor(c);
    expect(el.querySelector('h2')?.textContent).toBe('BDBass Drum');
    store.update((s) => ({ ...s, sel: 1 }));
    expect(el.querySelector('h2')?.textContent).toBe('SDSnare Drum');
    c.samples.setDrum('SD', { pcm: new Float32Array(1), name: 'Mein langer Name' });
    expect(el.querySelector('h2 small')?.textContent).toBe('Snare Drum · Mein lange');
  });

  it('16 Steps; Tipp schaltet und hört nur beim Einschalten im Stand vor', () => {
    const { c, store, audio } = makeContext();
    const el = stepEditor(c);
    const b = steps(el);
    expect(b).toHaveLength(16);
    b[2]?.click();
    expect(store.state.value.patterns.A.BD[2]).toBe(1);
    expect(b[2]?.getAttribute('aria-pressed')).toBe('true');
    expect(audio.audition).toHaveBeenCalledWith('BD');
    b[2]?.click();
    expect(audio.audition).toHaveBeenCalledTimes(1);
    audio.playing.value = true;
    b[3]?.click();
    expect(audio.audition).toHaveBeenCalledTimes(1);
  });

  it('ein Step-Tipp ändert genau eine Zelle im DOM', async () => {
    const { c } = makeContext();
    const el = stepEditor(c);
    document.body.append(el);
    const n = await countMutations(el, () => steps(el)[5]?.click());
    expect(n).toBe(1);
  });

  it('Lauflicht markiert genau den laufenden Step', () => {
    const { c, audio } = makeContext();
    const el = stepEditor(c);
    audio.playhead.value = { step: 4, songIndex: -1 };
    expect(steps(el).map((b) => b.classList.contains('now'))).toEqual(
      Array.from({ length: 16 }, (_, i) => i === 4),
    );
  });

  it('Leeren löscht die Spur (mit Zurück)', () => {
    const { c, store } = makeContext();
    store.toggleStep('BD', 0);
    const el = stepEditor(c);
    el.querySelector<HTMLButtonElement>('[aria-label="Spur leeren"]')?.click();
    expect(store.state.value.patterns.A.BD[0]).toBe(0);
    expect(store.canUndo.value).toBe(true);
  });

  it('Level, Tune, Decay der gewählten Stimme; Tune zeigt ±', () => {
    const { c, store } = makeContext();
    store.update((s) => ({ ...s, sel: 1 }));
    const el = stepEditor(c);
    const [level, tune, decay] = [...el.querySelectorAll<HTMLElement>('.inst [role=slider]')];
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
    const { c, store, audio } = makeContext();
    const el = stepEditor(c);
    const tune = el.querySelectorAll<HTMLElement>('.inst [role=slider]')[1];
    const def = store.state.value.params.BD.tune;
    tune?.dispatchEvent(new KeyboardEvent('keydown', { key: 'End' }));
    for (let i = 0; i < 2; i++) {
      tune?.dispatchEvent(pointer('pointerdown'));
      tune?.dispatchEvent(pointer('pointerup'));
    }
    expect(store.state.value.params.BD.tune).toBe(def);
    expect(audio.audition).toHaveBeenCalledWith('BD');
    audio.audition.mockClear();
    audio.playing.value = true;
    for (let i = 0; i < 2; i++) {
      tune?.dispatchEvent(pointer('pointerdown'));
      tune?.dispatchEvent(pointer('pointerup'));
    }
    expect(audio.audition).not.toHaveBeenCalled();
  });

  it('Sub-Modus: Step-Tipp wählt statt umzuschalten, Auswahl bleibt beim Aus- und Einschalten', () => {
    const { c, store } = makeContext();
    const el = stepEditor(c);
    const subBtn = el.querySelector<HTMLButtonElement>('[aria-label="Sub-Steps bearbeiten"]');
    const sel = () => steps(el).findIndex((b) => b.classList.contains('subsel'));
    expect(sel()).toBe(-1);
    subBtn?.click();
    expect(subBtn?.getAttribute('aria-pressed')).toBe('true');
    expect(sel()).toBe(0);
    steps(el)[6]?.click();
    expect(store.state.value.patterns.A.BD[6]).toBe(0);
    expect(sel()).toBe(6);
    subBtn?.click();
    expect(sel()).toBe(-1);
    subBtn?.click();
    expect(sel()).toBe(6);
  });
});
