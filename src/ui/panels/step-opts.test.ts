import { describe, expect, it } from 'vitest';
import { currentPattern } from '../../core/pattern.ts';
import { samplerSteps } from './sampler/steps.ts';
import { makeContext, pointer } from '../test-utils.ts';
import { stepEditor } from './step-editor.ts';
import { tracks } from './tracks.ts';

const key = (el: Element | null | undefined, k: string) => {
  el?.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
};
const chipBtn = (el: HTMLElement, label: string) =>
  [...el.querySelectorAll<HTMLButtonElement>('button')].find(
    (b) => b.textContent === label || b.getAttribute('aria-label') === label,
  );
const steps = (el: HTMLElement) => [...el.querySelectorAll<HTMLButtonElement>('.steps .step')];
const panel = (el: HTMLElement) => el.querySelector<HTMLElement>('.opt-panel');

describe('Step-Optionen im Step-Editor', () => {
  it('Opt-Modus: Panel erscheint, Tipp auf einen ausgeschalteten Step schaltet ihn ein und wählt ihn', () => {
    const { c, store, audio } = makeContext();
    const el = stepEditor(c);
    const opt = chipBtn(el, 'Step-Optionen bearbeiten');
    expect(panel(el)?.hidden).toBe(true);
    opt?.click();
    expect(opt?.getAttribute('aria-pressed')).toBe('true');
    expect(panel(el)?.hidden).toBe(false);
    expect(panel(el)?.querySelector('.cap-label')?.textContent).toBe('Tippe oben einen Step an');
    expect(panel(el)?.querySelector<HTMLElement>('.opt-ctl')?.hidden).toBe(true);
    steps(el)[2]?.click();
    expect(currentPattern(store.state.value).BD[2]).toBe(1);
    expect(audio.audition).toHaveBeenCalledWith('BD');
    expect(steps(el)[2]?.classList.contains('subsel')).toBe(true);
    expect(panel(el)?.querySelector('.cap-label')?.textContent).toBe('BD · Step 3');
    expect(panel(el)?.querySelector<HTMLElement>('.opt-ctl')?.hidden).toBe(false);
    // ein eingeschalteter Step wird nur gewählt, nicht ausgeschaltet
    steps(el)[2]?.click();
    expect(currentPattern(store.state.value).BD[2]).toBe(1);
  });

  it('Velocity per Knob und Schnellwahl, Chance, Bedingung, Zurücksetzen (mit Zurück)', () => {
    const { c, store } = makeContext();
    const el = stepEditor(c);
    chipBtn(el, 'Step-Optionen bearbeiten')?.click();
    steps(el)[0]?.click();
    const p = panel(el);
    if (!p) throw new Error('Panel');
    chipBtn(p, 'Leise')?.click();
    expect(currentPattern(store.state.value).opt?.BD?.[0]).toEqual({ v: 0.35 });
    expect(chipBtn(p, 'Leise')?.getAttribute('aria-pressed')).toBe('true');
    expect(steps(el)[0]?.style.getPropertyValue('--vel')).toBe('0.35');
    key(p.querySelector('[role=slider][aria-label="Velocity"]'), 'End');
    expect(currentPattern(store.state.value).opt).toBeUndefined();
    key(p.querySelector('[role=slider][aria-label="Chance"]'), 'Home');
    expect(currentPattern(store.state.value).opt?.BD?.[0]).toEqual({ p: 0 });
    expect(steps(el)[0]?.classList.contains('opt')).toBe(true);
    const sel = p.querySelector('select');
    if (!sel) throw new Error('Auswahl');
    sel.value = '1';
    sel.dispatchEvent(new Event('change'));
    expect(currentPattern(store.state.value).opt?.BD?.[0]).toEqual({ p: 0, c: '1:2' });
    chipBtn(p, 'Zurücksetzen')?.click();
    expect(currentPattern(store.state.value).opt).toBeUndefined();
    expect(steps(el)[0]?.classList.contains('opt')).toBe(false);
    store.undo();
    expect(currentPattern(store.state.value).opt?.BD?.[0]).toEqual({ p: 0, c: '1:2' });
    // Doppeltipp auf den Knob setzt 100 %
    const vel = p.querySelector('[role=slider][aria-label="Velocity"]');
    chipBtn(p, 'Mittel')?.click();
    for (let i = 0; i < 2; i++) {
      vel?.dispatchEvent(pointer('pointerdown'));
      vel?.dispatchEvent(pointer('pointerup'));
    }
    expect(currentPattern(store.state.value).opt?.BD?.[0]?.v).toBeUndefined();
  });

  it('Opt und Sub schließen sich aus; ausgeschalteter gewählter Step blendet die Regler aus', () => {
    const { c, store } = makeContext();
    const el = stepEditor(c);
    const opt = chipBtn(el, 'Step-Optionen bearbeiten');
    const sub = chipBtn(el, 'Sub-Steps bearbeiten');
    opt?.click();
    steps(el)[4]?.click();
    sub?.click();
    expect(opt?.getAttribute('aria-pressed')).toBe('false');
    expect(panel(el)?.hidden).toBe(true);
    opt?.click();
    expect(sub?.getAttribute('aria-pressed')).toBe('false');
    expect(panel(el)?.hidden).toBe(false);
    store.toggleStep('BD', 4);
    expect(panel(el)?.querySelector<HTMLElement>('.opt-ctl')?.hidden).toBe(true);
    expect(panel(el)?.querySelector('.opt-off')?.textContent).toContain('Step ist aus');
    opt?.click();
    expect(panel(el)?.hidden).toBe(true);
  });
});

describe('Step-Optionen: Anzeige in Spuren und Sampler', () => {
  it('Spurzellen zeigen Velocity und Marke', () => {
    const { c, store } = makeContext();
    const el = tracks(c);
    store.toggleStep('BD', 1);
    store.setStepOpt('BD', 1, { v: 0.5, c: '2:4' });
    const cell = el.querySelector<HTMLElement>('[aria-label="Bass Drum Step 2"]');
    expect(cell?.style.getPropertyValue('--vel')).toBe('0.5');
    expect(cell?.classList.contains('opt')).toBe(true);
  });

  it('Sampler-Steps: Opt-Modus mit Schlüssel P<Pad>', () => {
    const { c, store, audio } = makeContext();
    const el = samplerSteps(c);
    const opt = chipBtn(el, 'Step-Optionen bearbeiten');
    opt?.click();
    const b = el.querySelectorAll<HTMLButtonElement>('.ss');
    b[5]?.click();
    expect(currentPattern(store.state.value).smp[0]?.[5]).toBe(1);
    const p = panel(el);
    if (!p) throw new Error('Panel');
    expect(p.querySelector('.cap-label')?.textContent).toBe('Pad 1 · Step 6');
    chipBtn(p, 'Mittel')?.click();
    expect(currentPattern(store.state.value).opt?.P0?.[5]).toEqual({ v: 0.7 });
    expect(b[5]?.style.getPropertyValue('--vel')).toBe('0.7');
    // eingeschalteter Step: nur wählen; beim Spielen kein Vorhören
    audio.playing.value = true;
    b[9]?.click();
    expect(currentPattern(store.state.value).smp[0]?.[9]).toBe(1);
    expect(audio.auditionPad).not.toHaveBeenCalled();
    b[5]?.click();
    expect(currentPattern(store.state.value).smp[0]?.[5]).toBe(1);
    chipBtn(el, 'Sub-Steps bearbeiten')?.click();
    expect(opt?.getAttribute('aria-pressed')).toBe('false');
  });
});
