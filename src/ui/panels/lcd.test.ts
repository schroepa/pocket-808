import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeContext } from '../test-utils.ts';
import { lcdPanel } from './lcd.ts';

describe('lcdPanel', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('zeigt Tempo, Peak-Meter, 16 Steps und Glyphs', () => {
    const { c, store, scope } = makeContext();
    const el = lcdPanel(c);
    expect(el.querySelector('.lcd-digits')?.textContent).toBe(
      String(store.state.value.tempo).padStart(3, '0'),
    );
    expect(el.querySelector('.lcd-peak')).toBeTruthy();
    expect(el.querySelectorAll('.lcd-step')).toHaveLength(16);
    expect(el.querySelector('.lcd-glyph')?.textContent).toBe('PTN');
    store.setMode('song');
    expect([...el.querySelectorAll('.lcd-glyph')].map((g) => g.textContent)).toContain('SNG');
    scope.dispose();
  });

  it('markiert den Playhead-Step und Fill/Stutter-Glyphs', () => {
    const { c, audio, scope } = makeContext();
    const el = lcdPanel(c);
    audio.playing.value = true;
    audio.playhead.value = { step: 3, songIndex: -1 };
    expect(el.querySelector('.lcd-step.on')?.getAttribute('data-step')).toBe('3');
    audio.fillHeld.value = true;
    expect(el.querySelectorAll('.lcd-glyph.on').length).toBeGreaterThanOrEqual(2);
    audio.stutterHeld.value = true;
    expect(
      [...el.querySelectorAll('.lcd-glyph')].some(
        (g) => g.classList.contains('on') && g.textContent === 'STU',
      ),
    ).toBe(true);
    audio.playing.value = false;
    expect(el.querySelector('.lcd-step.on')).toBeNull();
    scope.dispose();
  });

  it('fragt Peak nur während des Spiels ab und räumt den Timer auf', () => {
    vi.useFakeTimers();
    const { c, audio, scope } = makeContext();
    audio.peak = vi.fn(() => 0.25);
    const el = lcdPanel(c);
    expect(audio.peak).not.toHaveBeenCalled();
    audio.playing.value = true;
    vi.advanceTimersByTime(120);
    expect(audio.peak).toHaveBeenCalled();
    expect(el.querySelector('.lcd-peak-fill')?.getAttribute('style')).toMatch(/width:/);
    const n = (audio.peak as ReturnType<typeof vi.fn>).mock.calls.length;
    audio.playing.value = false;
    vi.advanceTimersByTime(200);
    expect((audio.peak as ReturnType<typeof vi.fn>).mock.calls.length).toBe(n);
    expect(el.querySelector('.lcd-peak-fill')?.getAttribute('style')).toMatch(/width:\s*0%/);
    scope.dispose();
  });

  it('hängt im Song-Modus die Kettenposition an die Statuszeile', () => {
    const { c, store, audio, scope } = makeContext();
    const el = lcdPanel(c);
    store.setMode('song');
    audio.playing.value = true;
    audio.playhead.value = { step: 0, songIndex: 2 };
    expect(el.querySelector('.lcd-sub')?.textContent).toContain('· 3');
    scope.dispose();
  });

  it('ohne Pulse bei prefers-reduced-motion', () => {
    const orig = globalThis.matchMedia;
    globalThis.matchMedia = (q: string) =>
      ({
        matches: q.includes('prefers-reduced-motion'),
        media: q,
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
      }) as MediaQueryList;
    const { c, audio, scope } = makeContext();
    const el = lcdPanel(c);
    audio.playing.value = true;
    audio.playhead.value = { step: 1, songIndex: -1 };
    expect(el.querySelector('.lcd-step.on')).toBeTruthy();
    expect(el.querySelector('.lcd-step.pulse')).toBeNull();
    scope.dispose();
    globalThis.matchMedia = orig;
  });
});
