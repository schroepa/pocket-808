import { describe, expect, it } from 'vitest';
import { currentPattern } from '../core/pattern.ts';
import { stepOptOf } from '../core/stepopts.ts';
import { tracks } from './panels/tracks.ts';
import { samplerPads } from './panels/sampler/pads.ts';
import { samplerKeyboard } from './panels/sampler/keyboard.ts';
import { pianoRoll } from './panels/synth/roll.ts';
import { transport } from './panels/transport.ts';
import { makeContext } from './test-utils.ts';

const arm = (c: ReturnType<typeof makeContext>, step = 4) => {
  c.audio.setRecording(true);
  c.audio.playing.value = true;
  c.audio.nearestStep.mockReturnValue({ step, slot: 'A' });
};
const clear = (c: ReturnType<typeof makeContext>) => {
  c.store.clearPattern();
  c.store.undo();
  c.store.clearPattern();
};

describe('Rec-Knopf', () => {
  it('schaltet die Aufnahme scharf und wieder aus (aria-pressed)', () => {
    const { c, audio } = makeContext();
    const el = transport(c);
    const rec = el.querySelector<HTMLButtonElement>('.rec-btn');
    expect(rec?.getAttribute('aria-pressed')).toBe('false');
    rec?.click();
    expect(audio.recording.value).toBe(true);
    expect(rec?.getAttribute('aria-pressed')).toBe('true');
    rec?.click();
    expect(audio.recording.value).toBe(false);
    expect(rec?.classList.contains('on')).toBe(false);
  });
});

describe('Aufnehmen über die Tippflächen', () => {
  it('Spurname: nimmt den gerasteten Step auf, meldet im LCD, ein Take = ein Zurück-Schritt', () => {
    const ctx = makeContext();
    const { c, store } = ctx;
    clear(ctx);
    const el = tracks(c);
    const lab = (id: string) =>
      [...el.querySelectorAll<HTMLButtonElement>('.lab')].find((b) => b.textContent === id);
    arm(ctx, 4);
    lab('SD')?.click();
    expect(currentPattern(store.state.value).SD[4]).toBe(1);
    expect(c.readout.text.value).toBe('REC · SD · Step 5');
    ctx.audio.nearestStep.mockReturnValue({ step: 9, slot: 'A' });
    lab('SD')?.click();
    expect(currentPattern(store.state.value).SD[9]).toBe(1);
    store.undo(); // der ganze Take
    expect(currentPattern(store.state.value).SD[4]).toBe(0);
    expect(currentPattern(store.state.value).SD[9]).toBe(0);
    // neuer Take (Stopp und Start) legt einen neuen Zurück-Schritt an
    ctx.audio.start();
    lab('SD')?.click();
    expect(store.canUndo.value).toBe(true);
  });

  it('zählt beim Antippen (pointerdown), nicht erst beim Loslassen; click mit Zeiger zählt nicht doppelt', () => {
    const ctx = makeContext();
    const { c, store } = ctx;
    clear(ctx);
    const el = tracks(c);
    const sd = [...el.querySelectorAll<HTMLButtonElement>('.lab')].find(
      (b) => b.textContent === 'SD',
    );
    arm(ctx, 3);
    sd?.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(currentPattern(store.state.value).SD[3]).toBe(1);
    expect(ctx.audio.nearestStep).toHaveBeenCalledTimes(1);
    sd?.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 })); // Loslassen
    expect(ctx.audio.nearestStep).toHaveBeenCalledTimes(1);
    expect(ctx.audio.audition).toHaveBeenCalledWith('SD'); // der Klick hört weiter vor
  });

  it('ohne scharfe Aufnahme, ohne Wiedergabe oder außerhalb eines Steps wird nichts aufgenommen', () => {
    const ctx = makeContext();
    const { c, store } = ctx;
    clear(ctx);
    const el = tracks(c);
    const sd = [...el.querySelectorAll<HTMLButtonElement>('.lab')].find(
      (b) => b.textContent === 'SD',
    );
    ctx.audio.nearestStep.mockReturnValue({ step: 4, slot: 'A' });
    ctx.audio.playing.value = true;
    sd?.click(); // nicht scharf
    ctx.audio.setRecording(true);
    ctx.audio.playing.value = false;
    sd?.click(); // steht
    ctx.audio.playing.value = true;
    ctx.audio.nearestStep.mockReturnValue(null);
    sd?.click(); // kein Step in der Nähe
    expect(currentPattern(store.state.value).SD.some(Boolean)).toBe(false);
  });

  it('Pads und Tastatur: Pad-Step, Tastatur mit Pitch; leeres Pad wird nicht aufgenommen', () => {
    const ctx = makeContext();
    const { c, store } = ctx;
    clear(ctx);
    arm(ctx, 2);
    const pads = samplerPads(c);
    const keys = samplerKeyboard(c);
    pads.querySelectorAll<HTMLButtonElement>('.pad')[1]?.click();
    expect(currentPattern(store.state.value).smp[1]?.[2]).toBe(0); // Pad leer
    c.samples.setPad(1, Float32Array.from([0, 0.5, -0.5, 0.2]));
    pads.querySelectorAll<HTMLButtonElement>('.pad')[1]?.click();
    expect(currentPattern(store.state.value).smp[1]?.[2]).toBe(1);
    ctx.audio.nearestStep.mockReturnValue({ step: 6, slot: 'A' });
    keys.querySelector<HTMLButtonElement>('[aria-label="Pad spielen, Ton G"]')?.click();
    expect(currentPattern(store.state.value).smp[1]?.[6]).toBe(1);
    expect(stepOptOf(currentPattern(store.state.value), 'P1', 6).n).toBe(7);
  });

  it('Piano-Roll: Tonname nimmt die Note mit gewählter Länge und Part auf', () => {
    const ctx = makeContext();
    const { c, store } = ctx;
    store.update((s) => ({ ...s, part: 'LD', noteLen: 2 }));
    clear(ctx);
    arm(ctx, 8);
    const el = pianoRoll(c);
    el.querySelectorAll<HTMLButtonElement>('.rl')[11]?.click(); // Stufe 0
    expect(currentPattern(store.state.value).notes.LD[8]).toEqual({ d: 0, l: 2 });
    expect(c.readout.text.value).toMatch(/^REC · .+ · Step 9$/);
  });
});
