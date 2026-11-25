import { describe, expect, it, vi } from 'vitest';
import { currentPattern } from '../../core/pattern.ts';
import { signal } from '../../store/signals.ts';
import type { UiContext } from '../context.ts';
import type { Layout } from '../layout.ts';
import { createNav } from '../nav.ts';
import { createReadout } from '../readout.ts';
import { makeContext, pointer } from '../test-utils.ts';
import { display, displayLine } from './display.ts';
import { modeBar } from './mode-bar.ts';
import { patternSheetContent } from './pattern-sheet.ts';
import { slots } from './slots.ts';
import { tempoControls } from './tempo.ts';

function setup(opts: { available?: boolean } = {}) {
  const ctx = makeContext(opts);
  const nav = createNav(ctx.scope, ctx.store, signal<Layout>('mobile'));
  // wie im Rahmen: die Grundzeile des Displays folgt der Navigation
  const c: UiContext = {
    ...ctx.c,
    readout: createReadout(ctx.scope, displayLine(ctx.c, nav), ctx.timer),
  };
  return { ...ctx, c, nav };
}

const labelled = (el: Element, label: string) => {
  const b = el.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`);
  if (!b) throw new Error(label);
  return b;
};
const named = (el: Element, text: string) => {
  const b = [...el.querySelectorAll('button')].find((x) => x.textContent === text);
  if (!b) throw new Error(text);
  return b;
};
const text = (el: Element, sel: string) => el.querySelector(sel)?.textContent;

describe('displayLine', () => {
  it('nennt die gewählte Spur, auch das Pad', () => {
    const { c, nav, store } = setup();
    const line = displayLine(c, nav);
    expect(line.value).toBe('BD · Bass Drum');
    nav.selectTrack('SD');
    expect(line.value).toBe('SD · Snare Drum');
    nav.selectTrack('SM');
    store.update((s) => ({ ...s, smp: { ...s.smp, sel: 2 } }));
    expect(line.value).toBe('SM · Pad 3');
    nav.setMode('mixer');
    expect(line.value).toBe('SM · Pad 3');
  });

  it('Display nennt Ziel in Sound', () => {
    const { c, nav, store } = setup();
    const line = displayLine(c, nav);
    nav.setMode('sound');
    expect(line.value).toBe('SOUND FÜR BASS');
    store.update((s) => ({ ...s, part: 'LD' }));
    expect(line.value).toBe('SOUND FÜR LEAD');
    nav.setMode('spur');
    expect(line.value).toBe('BD · Bass Drum');
  });

  it('ohne Audio der Hinweis, in jedem Modus', () => {
    const { c, nav } = setup({ available: false });
    const line = displayLine(c, nav);
    expect(line.value).toBe('Kein Audio in diesem Browser');
    nav.setMode('sound');
    expect(line.value).toBe('Kein Audio in diesem Browser');
  });
});

describe('display', () => {
  function build() {
    const ctx = setup();
    const file = document.createElement('span');
    const help = document.createElement('span');
    const strip = document.createElement('canvas');
    const el = display(ctx.c, ctx.nav, [file, help], strip);
    const bpm = () => {
      const b = el.querySelector<HTMLButtonElement>('.lcd-tempo');
      if (!b) throw new Error('BPM-Knopf');
      return b;
    };
    return { ...ctx, el, file, help, strip, bpm };
  }

  it('Name, Anzeige mit Oszilloskop, danach Zurück und die Werkzeuge', () => {
    const { el, file, help, strip } = build();
    expect(text(el, 'h1')).toBe('Pocket 808');
    const lcd = el.querySelector('[role=group][aria-label="Anzeige"]');
    expect(lcd?.contains(strip)).toBe(true);
    const tools = [...(el.querySelector('.display-tools')?.children ?? [])];
    expect(tools[0]?.textContent).toBe('Zurück');
    expect(tools.slice(1)).toEqual([file, help]);
  });

  it('zeigt Tempo dreistellig und das Pattern', () => {
    const { el, store, bpm } = build();
    store.update((s) => ({ ...s, tempo: 95 }));
    expect(text(el, '.lcd-digits')).toBe('095');
    expect(bpm().getAttribute('aria-label')).toBe('Tempo 95 BPM, Tempo, Swing und Master öffnen');
    expect(text(el, '.lcd-pattern')).toBe('PATTERN A');
    store.selectSlot('C');
    expect(text(el, '.lcd-pattern')).toBe('PATTERN C');
  });

  it('Meldungszeile: Grundzeile, kurz eine Meldung (Plattenkiste)', () => {
    const { el, c, timer } = build();
    expect(text(el, '.lcd-sub')).toBe('BD · Bass Drum');
    c.readout.flash('BASS · SUB');
    expect(text(el, '.lcd-sub')).toBe('BASS · SUB');
    timer.advance(1400);
    expect(text(el, '.lcd-sub')).toBe('BD · Bass Drum');
  });

  it('BPM-Knopf öffnet Tempo, ein zweiter Tipp schließt', () => {
    const { nav, bpm } = build();
    expect(bpm().getAttribute('aria-haspopup')).toBe('dialog');
    expect(bpm().getAttribute('aria-expanded')).toBe('false');
    nav.sheet.value = 'pattern';
    bpm().click();
    expect(nav.sheet.value).toBe('tempo');
    expect(bpm().getAttribute('aria-expanded')).toBe('true');
    bpm().click();
    expect(nav.sheet.value).toBeNull();
    expect(bpm().getAttribute('aria-expanded')).toBe('false');
  });

  it('Zurück gesperrt/aktiv', () => {
    const { el, store } = build();
    const undo = named(el, 'Zurück');
    expect(undo.disabled).toBe(true);
    store.toggleStep('BD', 1);
    store.clearPattern();
    expect(undo.disabled).toBe(false);
    undo.click();
    expect(currentPattern(store.state.value).BD[1]).toBe(1);
    expect(undo.disabled).toBe(true);
  });
});

describe('modeBar', () => {
  function build() {
    const ctx = setup();
    const el = modeBar(ctx.c, ctx.nav);
    const tabs = () => [...el.querySelectorAll<HTMLButtonElement>('[role=tab]')];
    const selected = () =>
      tabs()
        .filter((t) => t.getAttribute('aria-selected') === 'true')
        .map((t) => t.textContent);
    const pattern = () => {
      const b = el.querySelector<HTMLButtonElement>('.mode-pattern');
      if (!b) throw new Error('Pattern-Taste');
      return b;
    };
    return { ...ctx, el, tabs, selected, pattern };
  }

  it('Reiter „Bereich“ wählen den Modus und folgen ihm', () => {
    const { el, nav, tabs, selected } = build();
    expect(el.querySelector('[role=tablist]')?.getAttribute('aria-label')).toBe('Bereich');
    expect(tabs().map((t) => t.textContent)).toEqual(['Spur', 'Sound', 'Mixer', 'Song', 'Punch']);
    expect(selected()).toEqual(['Spur']);
    nav.sheet.value = 'tempo';
    named(el, 'Mixer').click();
    expect(nav.mode.value).toBe('mixer');
    expect(nav.sheet.value).toBeNull();
    expect(selected()).toEqual(['Mixer']);
    nav.setMode('punch');
    expect(selected()).toEqual(['Punch']);
  });

  it('Pattern-Taste nennt das Pattern und öffnet bzw. schließt die Fläche', () => {
    const { nav, store, pattern } = build();
    expect(pattern().textContent).toBe('A ▾');
    expect(pattern().getAttribute('aria-label')).toBe('Pattern wählen, aktuell A');
    expect(pattern().getAttribute('aria-haspopup')).toBe('dialog');
    store.selectSlot('F');
    expect(pattern().textContent).toBe('F ▾');
    expect(pattern().getAttribute('aria-label')).toBe('Pattern wählen, aktuell F');
    pattern().click();
    expect(nav.sheet.value).toBe('pattern');
    expect(pattern().getAttribute('aria-expanded')).toBe('true');
    pattern().click();
    expect(nav.sheet.value).toBeNull();
    expect(pattern().getAttribute('aria-expanded')).toBe('false');
  });
});

describe('slots', () => {
  it('wählt Pattern, markiert Auswahl und Inhalt', () => {
    const { c, store } = setup();
    const el = slots(c);
    const b = labelled(el, 'Pattern B');
    b.click();
    expect(store.state.value.cur).toBe('B');
    expect(b.getAttribute('aria-pressed')).toBe('true');
    expect(b.classList.contains('sel')).toBe(true);
    expect(b.classList.contains('has')).toBe(false);
    store.toggleStep('BD', 0);
    expect(b.classList.contains('has')).toBe(true);
  });
});

describe('patternSheetContent', () => {
  function build() {
    const ctx = setup();
    const el = patternSheetContent(ctx.c, ctx.nav);
    ctx.nav.sheet.value = 'pattern';
    return { ...ctx, el };
  }

  it('Slot-Tipp schließt, Kopieren nicht', () => {
    const { el, nav, store, c } = build();
    named(el, 'Kopieren').click();
    expect(c.readout.text.value).toBe('PATTERN A KOPIERT');
    expect(nav.sheet.value).toBe('pattern');
    labelled(el, 'Pattern D').click();
    expect(store.state.value.cur).toBe('D');
    expect(nav.sheet.value).toBeNull();
    // auch der schon gewählte Slot schließt
    nav.sheet.value = 'pattern';
    labelled(el, 'Pattern D').click();
    expect(nav.sheet.value).toBeNull();
  });

  it('Kopieren, Einfügen, Leeren mit Zurück; die Fläche bleibt offen', () => {
    const { el, nav, store, c } = build();
    const paste = named(el, 'Einfügen');
    expect(paste.disabled).toBe(true);
    store.toggleStep('BD', 3);
    named(el, 'Kopieren').click();
    expect(paste.disabled).toBe(false);
    store.selectSlot('B');
    paste.click();
    expect(c.readout.text.value).toBe('EINGEFÜGT IN B');
    expect(currentPattern(store.state.value).BD[3]).toBe(1);
    named(el, 'Pattern leeren').click();
    expect(currentPattern(store.state.value).BD[3]).toBe(0);
    store.undo();
    expect(currentPattern(store.state.value).BD[3]).toBe(1);
    expect(nav.sheet.value).toBe('pattern');
  });

  it('„Variation würfeln“ ändert das Pattern mit Zurück und Meldung', () => {
    const { el, nav, store, c } = build();
    const before = store.state.value;
    const random = vi.spyOn(Math, 'random').mockReturnValue(0);
    labelled(el, 'Variation würfeln').click();
    random.mockRestore();
    expect(store.state.value).not.toBe(before);
    expect(c.readout.text.value).toBe('Variation gewürfelt');
    expect(nav.sheet.value).toBe('pattern');
    store.undo();
    expect(store.state.value.patterns).toEqual(before.patterns);
  });
});

describe('tempoControls', () => {
  it('Gruppe „Tempo und Master“ mit drei Reglern und Tap', () => {
    const { c } = setup();
    const el = tempoControls(c);
    expect(el.getAttribute('role')).toBe('group');
    expect(el.getAttribute('aria-label')).toBe('Tempo und Master');
    expect(
      [...el.querySelectorAll('[role=slider]')].map((k) => k.getAttribute('aria-label')),
    ).toEqual(['Tempo', 'Swing', 'Master']);
  });

  it('Tap-Knopf: erster Tipp meldet, zweiter setzt das Tempo (ohne Zurück)', () => {
    const { c, store } = setup();
    const el = tempoControls(c);
    const btn = labelled(el, 'Tap – Tempo antippen');
    const now = vi.spyOn(performance, 'now');
    now.mockReturnValue(5_000);
    btn.click();
    expect(c.readout.text.value).toBe('TAP · weiter tippen');
    now.mockReturnValue(5_400);
    btn.click();
    expect(store.state.value.tempo).toBe(150);
    expect(
      el.querySelector('[role=slider][aria-label="Tempo"]')?.getAttribute('aria-valuetext'),
    ).toBe('150 BPM');
    expect(store.canUndo.value).toBe(false);
    now.mockRestore();
  });

  it('Tempo-, Swing- und Master-Regler schreiben in den Store', () => {
    const { c, store } = setup();
    const el = tempoControls(c);
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
    const { c, store } = setup();
    store.update((s) => ({ ...s, tempo: 150, swing: 0.5, master: 0.3 }));
    const el = tempoControls(c);
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
