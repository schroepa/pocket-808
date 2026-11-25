import { describe, expect, it } from 'vitest';
import { CHANNELS } from '../../core/constants.ts';
import { degreeName } from '../../core/music.ts';
import { currentPattern } from '../../core/pattern.ts';
import { selectPad } from '../../core/sampler.ts';
import { must } from '../../core/util.ts';
import { signal } from '../../store/signals.ts';
import type { Layout } from '../layout.ts';
import { createNav, type TrackId } from '../nav.ts';
import { makeContext } from '../test-utils.ts';
import { shiftTrack, trackTap, trackTitle } from '../track.ts';
import { trackBar, trackKeys, trackPadsContent } from './track-select.ts';

const pcm = Float32Array.from([0, 0.5, -0.5, 0.25]);

function setup() {
  const ctx = makeContext();
  const nav = createNav(ctx.scope, ctx.store, signal<Layout>('mobile'));
  // leeres Pattern, damit jeder aufgenommene Step sichtbar ist
  ctx.store.clearPattern();
  return { ...ctx, nav };
}

/** Aufnahme scharf, Wiedergabe läuft, der Schlag rastet auf `step` */
function arm(ctx: ReturnType<typeof setup>, step: number): void {
  ctx.audio.setRecording(true);
  ctx.audio.playing.value = true;
  ctx.audio.nearestStep.mockReturnValue({ step, slot: 'A' });
}

const button = (el: HTMLElement, name: string): HTMLButtonElement =>
  must(el.querySelector<HTMLButtonElement>(`[aria-label="${name}"]`) ?? undefined, name);

const down = (b: HTMLElement): void => {
  b.dispatchEvent(new Event('pointerdown', { bubbles: true }));
};
/** click, wie ihn ein Zeiger auslöst (detail 1); .click() entspricht der Tastatur (detail 0) */
const release = (b: HTMLElement): void => {
  b.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
};

const pads = (el: HTMLElement): HTMLButtonElement[] => [
  ...el.querySelectorAll<HTMLButtonElement>('.pad'),
];

describe('trackTitle', () => {
  it('Titel folgt Spur und Pad', () => {
    const { store } = setup();
    const title = (id: TrackId) => trackTitle(store.state.value, id);
    expect(title('SD')).toBe('SD · Snare Drum');
    expect(title('BA')).toBe('BA · Bass');
    expect(title('LD')).toBe('LD · Lead');
    expect(title('SM')).toBe('SM · Pad 1');
    store.update((s) => selectPad(s, 2));
    expect(title('SM')).toBe('SM · Pad 3');
  });
});

describe('trackTap', () => {
  it('Drum: Tipp wählt und spielt an', () => {
    const ctx = setup();
    const el = trackKeys(ctx.c, ctx.nav);
    button(el, 'Snare Drum wählen und anhören').click();
    expect(ctx.nav.track.value).toBe('SD');
    expect(ctx.store.state.value.sel).toBe(1);
    expect(ctx.audio.audition).toHaveBeenCalledWith('SD');
  });

  it.each([
    ['BA', 'Bass'],
    ['LD', 'Lead'],
  ] as const)('%s: Tipp wählt und spielt an', (part, name) => {
    const ctx = setup();
    const el = trackKeys(ctx.c, ctx.nav);
    button(el, `${name} wählen und anhören`).click();
    expect(ctx.nav.track.value).toBe(part);
    expect(ctx.store.state.value.part).toBe(part);
    expect(ctx.audio.auditionNote).toHaveBeenCalledWith(part, 0, 2);
    expect(ctx.audio.audition).not.toHaveBeenCalled();
  });

  it('Sampler: Tipp wählt und spielt das gewählte Pad, falls belegt', () => {
    const ctx = setup();
    ctx.store.update((s) => selectPad(s, 3));
    const el = trackKeys(ctx.c, ctx.nav);
    const key = button(el, 'Sampler wählen und anhören');
    key.click();
    expect(ctx.nav.track.value).toBe('SM');
    expect(ctx.audio.auditionPad).not.toHaveBeenCalled();
    ctx.c.samples.setPad(3, pcm);
    key.click();
    expect(ctx.audio.auditionPad).toHaveBeenCalledWith(3);
  });

  it('ohne scharfe Aufnahme bleibt das Pattern unverändert', () => {
    const ctx = setup();
    ctx.audio.playing.value = true;
    ctx.audio.nearestStep.mockReturnValue({ step: 4, slot: 'A' });
    const el = trackKeys(ctx.c, ctx.nav);
    const before = ctx.store.state.value.patterns;
    for (const b of el.querySelectorAll('button')) {
      down(b);
      release(b);
    }
    expect(ctx.store.state.value.patterns).toBe(before);
  });

  it('Drum: bei Rec und Wiedergabe nimmt pointerdown den Schlag auf', () => {
    const ctx = setup();
    const el = trackKeys(ctx.c, ctx.nav);
    arm(ctx, 3);
    const sd = button(el, 'Snare Drum wählen und anhören');
    down(sd);
    expect(currentPattern(ctx.store.state.value).SD[3]).toBe(1);
    expect(ctx.c.readout.text.value).toBe('REC · SD · Step 4');
    release(sd); // Loslassen zählt nicht doppelt
    expect(ctx.audio.nearestStep).toHaveBeenCalledTimes(1);
    expect(ctx.audio.audition).toHaveBeenCalledWith('SD');
  });

  it.each([
    ['BA', 'Bass'],
    ['LD', 'Lead'],
  ] as const)(
    '%s: bei Rec nimmt pointerdown den Grundton mit gewählter Länge auf',
    (part, name) => {
      const ctx = setup();
      ctx.store.update((s) => ({ ...s, noteLen: 2 }));
      const el = trackKeys(ctx.c, ctx.nav);
      arm(ctx, 8);
      down(button(el, `${name} wählen und anhören`));
      expect(currentPattern(ctx.store.state.value).notes[part][8]).toEqual({ d: 0, l: 2 });
      expect(ctx.c.readout.text.value).toBe(
        `REC · ${degreeName(0, ctx.store.state.value)} · Step 9`,
      );
    },
  );

  it('Sampler: bei Rec nimmt pointerdown das gewählte Pad auf, ein leeres nicht', () => {
    const ctx = setup();
    ctx.store.update((s) => selectPad(s, 1));
    const el = trackKeys(ctx.c, ctx.nav);
    arm(ctx, 5);
    const key = button(el, 'Sampler wählen und anhören');
    down(key); // leer
    expect(ctx.audio.nearestStep).not.toHaveBeenCalled();
    expect(currentPattern(ctx.store.state.value).smp[1]?.[5]).toBe(0);
    ctx.c.samples.setPad(1, pcm);
    down(key);
    expect(currentPattern(ctx.store.state.value).smp[1]?.[5]).toBe(1);
    expect(ctx.c.readout.text.value).toBe('REC · Pad 2 · Step 6');
  });

  it('liest das Pad erst beim Tipp: wer es vorher wählt, spielt und nimmt es auf', () => {
    const ctx = setup();
    ctx.c.samples.setPad(4, pcm);
    const row = document.createElement('button');
    const pick = (): void => {
      ctx.store.update((s) => selectPad(s, 4));
    };
    row.addEventListener('pointerdown', pick);
    row.addEventListener('click', pick);
    trackTap(ctx.c, ctx.nav, row, 'SM');
    arm(ctx, 7);
    down(row);
    release(row);
    expect(ctx.nav.track.value).toBe('SM');
    expect(ctx.audio.auditionPad).toHaveBeenCalledWith(4);
    expect(currentPattern(ctx.store.state.value).smp[4]?.[7]).toBe(1);
    expect(currentPattern(ctx.store.state.value).smp[0]?.[7]).toBe(0);
  });
});

describe('shiftTrack', () => {
  it('läuft in der Reihenfolge der Kanäle und hält an BD und SM', () => {
    const { nav, audio } = setup();
    shiftTrack(nav, -1);
    expect(nav.track.value).toBe('BD');
    const seen: TrackId[] = [nav.track.value];
    for (let i = 1; i < CHANNELS.length; i++) {
      shiftTrack(nav, 1);
      seen.push(nav.track.value);
    }
    expect(seen).toEqual(CHANNELS);
    shiftTrack(nav, 1);
    expect(nav.track.value).toBe('SM');
    shiftTrack(nav, -1);
    expect(nav.track.value).toBe('LD');
    expect(audio.audition).not.toHaveBeenCalled();
  });
});

describe('trackBar', () => {
  it('‹ und › wählen nur: kein Ton, keine Aufnahme', () => {
    const ctx = setup();
    const el = trackBar(ctx.c, ctx.nav);
    arm(ctx, 3);
    const next = button(el, 'Nächste Spur');
    down(next);
    next.click();
    expect(ctx.nav.track.value).toBe('SD');
    button(el, 'Vorige Spur').click();
    expect(ctx.nav.track.value).toBe('BD');
    expect(ctx.audio.audition).not.toHaveBeenCalled();
    expect(ctx.audio.nearestStep).not.toHaveBeenCalled();
  });

  it('Titel folgt Spur und Pad', () => {
    const { c, nav, store } = setup();
    const el = trackBar(c, nav);
    const title = button(el, 'Spur wählen');
    expect(title.textContent).toBe('BD · Bass Drum');
    nav.selectTrack('SM');
    expect(title.textContent).toBe('SM · Pad 1');
    store.update((s) => selectPad(s, 5));
    expect(title.textContent).toBe('SM · Pad 6');
    nav.selectTrack('BA');
    expect(title.textContent).toBe('BA · Bass');
  });

  it('Titelknopf öffnet und schließt das Pad-Feld', () => {
    const { c, nav } = setup();
    const title = button(trackBar(c, nav), 'Spur wählen');
    expect(title.getAttribute('aria-expanded')).toBe('false');
    title.click();
    expect(nav.sheet.value).toBe('tracks');
    expect(title.getAttribute('aria-expanded')).toBe('true');
    title.click();
    expect(nav.sheet.value).toBeNull();
    nav.sheet.value = 'tempo';
    expect(title.getAttribute('aria-expanded')).toBe('false');
    title.click();
    expect(nav.sheet.value).toBe('tracks');
  });
});

describe('trackKeys', () => {
  it('13 Tasten in Kanal-Reihenfolge, die gewählte ist markiert', () => {
    const { c, nav } = setup();
    const el = trackKeys(c, nav);
    const keys = [...el.querySelectorAll('button')];
    expect(keys.map((k) => k.textContent)).toEqual(CHANNELS);
    const marked = () => keys.filter((k) => k.classList.contains('sel')).map((k) => k.textContent);
    expect(marked()).toEqual(['BD']);
    nav.selectTrack('LD');
    expect(marked()).toEqual(['LD']);
    expect(keys.map((k) => k.getAttribute('aria-pressed'))).toEqual(
      CHANNELS.map((id) => String(id === 'LD')),
    );
  });

  it('eigenes Sample markiert die Taste (Klasse cust)', () => {
    const { c, nav } = setup();
    const keys = trackKeys(c, nav);
    const field = trackPadsContent(c, nav);
    const bd = [keys, field].map((el) => button(el, 'Bass Drum wählen und anhören'));
    expect(bd.map((b) => b.classList.contains('cust'))).toEqual([false, false]);
    c.samples.setDrum('BD', { pcm: new Float32Array(1), name: 'X' });
    expect(bd.map((b) => b.classList.contains('cust'))).toEqual([true, true]);
    expect(keys.querySelectorAll('.cust')).toHaveLength(1);
    c.samples.setDrum('BD', null);
    expect(bd.map((b) => b.classList.contains('cust'))).toEqual([false, false]);
  });
});

describe('trackPadsContent', () => {
  it('zeigt 12 Spur-Pads und 8 Sampler-Pads', () => {
    const { c, nav } = setup();
    const el = trackPadsContent(c, nav);
    const names = [...el.querySelectorAll('[aria-label$="wählen und anhören"]')];
    expect(names).toHaveLength(12);
    expect(names.some((b) => b.getAttribute('aria-label')?.startsWith('Sampler'))).toBe(false);
    expect(pads(el)).toHaveLength(8);
  });

  it('Pad-Feld schließt ohne Rec, bleibt bei scharfem Rec offen', () => {
    const ctx = setup();
    ctx.c.samples.setPad(0, pcm);
    const el = trackPadsContent(ctx.c, ctx.nav);
    const hit = [button(el, 'Snare Drum wählen und anhören'), must(pads(el)[0], 'Pad 1')];
    for (const b of hit) {
      ctx.nav.sheet.value = 'tracks';
      b.click();
      expect(ctx.nav.sheet.value).toBeNull();
    }
    ctx.audio.setRecording(true); // scharf genügt, die Wiedergabe steht
    for (const b of hit) {
      ctx.nav.sheet.value = 'tracks';
      b.click();
      expect(ctx.nav.sheet.value).toBe('tracks');
    }
  });

  it('Sampler-Pad im Feld wählt Pad und Spur SM', () => {
    const ctx = setup();
    ctx.c.samples.setPad(2, pcm);
    const el = trackPadsContent(ctx.c, ctx.nav);
    must(pads(el)[2], 'Pad 3').click();
    expect(ctx.store.state.value.smp.sel).toBe(2);
    expect(ctx.nav.track.value).toBe('SM');
    expect(ctx.audio.auditionPad).toHaveBeenCalledTimes(1);
    expect(ctx.audio.auditionPad).toHaveBeenCalledWith(2);
  });

  it('Sampler-Pad im Feld nimmt einen Schlag genau einmal auf', () => {
    const ctx = setup();
    ctx.c.samples.setPad(2, pcm);
    const el = trackPadsContent(ctx.c, ctx.nav);
    arm(ctx, 6);
    const pad = must(pads(el)[2], 'Pad 3');
    down(pad);
    release(pad);
    expect(ctx.audio.nearestStep).toHaveBeenCalledTimes(1);
    expect(currentPattern(ctx.store.state.value).smp[2]?.[6]).toBe(1);
    expect(currentPattern(ctx.store.state.value).smp[0]?.[6]).toBe(0);
  });

  it('Spur-Pad nimmt bei Rec auf und markiert die gewählte Spur', () => {
    const ctx = setup();
    const el = trackPadsContent(ctx.c, ctx.nav);
    arm(ctx, 2);
    const cp = button(el, 'Hand Clap wählen und anhören');
    down(cp);
    release(cp);
    expect(currentPattern(ctx.store.state.value).CP[2]).toBe(1);
    expect(ctx.audio.nearestStep).toHaveBeenCalledTimes(1);
    expect(cp.classList.contains('sel')).toBe(true);
    expect(cp.getAttribute('aria-pressed')).toBe('true');
  });
});
