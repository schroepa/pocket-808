import { afterEach, describe, expect, it, vi } from 'vitest';
import { baseState } from '../core/defaults.ts';
import { createSampleBank } from '../store/samples.ts';
import { createStore } from '../store/store.ts';
import { QUERIES } from './layout.ts';
import { mountShell } from './shell.ts';
import { fakeAudio, manualTimer, pointer } from './test-utils.ts';

/** matchMedia mit umschaltbaren Antworten: `set` ändert sie und meldet den Wechsel */
function fakeMedia(initial: Record<string, boolean>) {
  let matches = new Map(Object.entries(initial));
  const listeners = new Set<() => void>();
  const matchMedia = (q: string) =>
    ({
      get matches() {
        return matches.get(q) ?? false;
      },
      addEventListener: (_: string, fn: () => void) => listeners.add(fn),
      removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
    }) as unknown as MediaQueryList;
  const set = (next: Record<string, boolean>) => {
    matches = new Map(Object.entries(next));
    for (const fn of [...listeners]) fn();
  };
  return { matchMedia, set };
}

const DESKTOP = { [QUERIES.tablet]: true, [QUERIES.desktop]: true };
const TABLET = { [QUERIES.tablet]: true, [QUERIES.coarse]: true };

const mounted: { dispose(): void }[] = [];
afterEach(() => {
  for (const m of mounted.splice(0)) m.dispose();
});

function mount(matches: Record<string, boolean> = {}) {
  const root = document.createElement('div');
  document.body.replaceChildren(root);
  const audio = fakeAudio();
  const raf = { request: vi.fn(() => 7), cancel: vi.fn() };
  const files = {
    pickAudio: () => Promise.resolve(null),
    pickProject: vi.fn(() => Promise.resolve(null)),
    save: vi.fn(() => Promise.resolve('cancelled' as const)),
  };
  const media = fakeMedia(matches);
  const store = createStore(baseState());
  const shell = mountShell(root, {
    store,
    samples: createSampleBank({ getItem: () => null, setItem: () => undefined }, {}),
    audio,
    files,
    recorder: { start: () => Promise.resolve({ error: 'unavailable' as const }) },
    timer: manualTimer(),
    win: {
      matchMedia: media.matchMedia,
      requestAnimationFrame: raf.request,
      cancelAnimationFrame: raf.cancel,
    },
  });
  mounted.push(shell);
  const area = (name: string) => {
    const el = root.querySelector<HTMLElement>(`[data-area="${name}"]`);
    if (!el) throw new Error(`Bereich ${name} fehlt`);
    return el;
  };
  const byLabel = (label: string, within: ParentNode = root) =>
    within.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`);
  const modeTab = (name: string) =>
    [...area('modes').querySelectorAll<HTMLButtonElement>('[role=tab]')].find(
      (b) => b.textContent === name,
    );
  const visibleModes = () =>
    [...area('work').querySelectorAll<HTMLElement>(':scope > [data-mode]')]
      .filter((s) => !s.hidden)
      .map((s) => s.dataset.mode);
  return { root, shell, store, audio, raf, files, media, area, byLabel, modeTab, visibleModes };
}

/** sichtbar = weder das Element noch ein Vorfahr hat hidden */
const shown = (el: Element | null): boolean => {
  for (let e = el; e; e = e.parentElement) if ((e as HTMLElement).hidden) return false;
  return el !== null;
};

describe('mountShell: Aufbau', () => {
  it('baut die Bereiche in Lesereihenfolge, danach die drei Flächen', () => {
    const { root, area } = mount();
    const areas = [...root.querySelectorAll('[data-area]')].map((e) => e.getAttribute('data-area'));
    expect(areas).toEqual(['display', 'modes', 'tracks', 'work', 'steps', 'transport']);
    const sheets = [...root.querySelectorAll<HTMLElement>('.shell > [role=dialog]')];
    expect(sheets.map((s) => s.getAttribute('aria-label'))).toEqual([
      'Pad-Feld',
      'Pattern',
      'Tempo',
    ]);
    expect(sheets.every((s) => s.hidden)).toBe(true);
    // Flächen stehen nach dem Transport: Display, Modusleiste und Transport bleiben davor erreichbar
    expect(area('transport').compareDocumentPosition(sheets[0] as Node)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    const modes = [...area('work').querySelectorAll(':scope > [data-mode]')].map((s) =>
      s.getAttribute('data-mode'),
    );
    expect(modes).toEqual(['spur', 'sound', 'mixer', 'song', 'punch']);
  });

  it('startet im Modus Spur mit BD auf Trig; das Display nennt die Spur', () => {
    const { root, modeTab, visibleModes } = mount();
    expect(modeTab('Spur')?.getAttribute('aria-selected')).toBe('true');
    expect(visibleModes()).toEqual(['spur']);
    expect(shown(root.querySelector('[data-page="trig"][data-kind="drum"]'))).toBe(true);
    expect(root.querySelector('.lcd-sub')?.textContent).toBe('BD · Bass Drum');
    expect(root.querySelector('.display .file-btn')?.textContent).toBe('Datei');
    expect(root.querySelector('.display [aria-label="Tastaturkürzel"]')).not.toBeNull();
  });

  it('setzt data-layout am Dokument', () => {
    const { shell } = mount(DESKTOP);
    expect(document.documentElement.dataset.layout).toBe('desktop');
    expect(shell.layout.value).toBe('desktop');
  });
});

describe('mountShell: Modi', () => {
  it('Moduswechsel zeigt genau eine Arbeitsfläche', () => {
    const { modeTab, visibleModes } = mount();
    for (const [name, id] of [
      ['Sound', 'sound'],
      ['Mixer', 'mixer'],
      ['Song', 'song'],
      ['Punch', 'punch'],
      ['Spur', 'spur'],
    ] as const) {
      modeTab(name)?.click();
      expect(visibleModes()).toEqual([id]);
    }
  });

  it('Punch gehalten, Moduswechsel → punchOff', () => {
    const { modeTab, byLabel, audio } = mount();
    modeTab('Punch')?.click();
    const pad = byLabel('Tape halten');
    pad?.dispatchEvent(pointer('pointerdown'));
    expect(audio.punchOn).toHaveBeenCalledWith('tape');
    modeTab('Spur')?.click();
    expect(audio.punchOff).toHaveBeenCalledWith('tape');
    expect(pad?.getAttribute('aria-pressed')).toBe('false');
  });

  it('Mixer und Song mobile: Spurwahl und Steps hidden; in Sound und Punch bleiben sie', () => {
    const { modeTab, area } = mount();
    for (const name of ['Mixer', 'Song']) {
      modeTab(name)?.click();
      expect(area('tracks').hidden).toBe(true);
      expect(area('steps').hidden).toBe(true);
    }
    for (const name of ['Sound', 'Punch']) {
      modeTab(name)?.click();
      expect(area('tracks').hidden).toBe(false);
      expect(area('steps').hidden).toBe(false);
    }
  });

  it('Mixer auf dem Tablet: Spurwahl und Steps bleiben', () => {
    const { modeTab, area } = mount(TABLET);
    modeTab('Mixer')?.click();
    expect(area('tracks').hidden).toBe(false);
    expect(area('steps').hidden).toBe(false);
  });

  it('Sound: die Plattenkiste steht in der Arbeitsfläche; das Display nennt das Ziel', () => {
    const { root, modeTab, area } = mount();
    modeTab('Sound')?.click();
    expect(shown(area('work').querySelector('.library'))).toBe(true);
    expect(root.querySelector('.lcd-sub')?.textContent).toBe('SOUND FÜR BASS');
  });
});

describe('mountShell: Spurwahl und Step-Bereich', () => {
  it('mobile: Leiste mit Pad-Feld, Tablet und Desktop: Tasten', () => {
    const { area, media } = mount();
    const bar = area('tracks').querySelector<HTMLElement>('.track-bar');
    const keys = area('tracks').querySelector<HTMLElement>('.track-keys');
    expect([bar?.hidden, keys?.hidden]).toEqual([false, true]);
    media.set(TABLET);
    expect([bar?.hidden, keys?.hidden]).toEqual([true, false]);
    media.set(DESKTOP);
    expect([bar?.hidden, keys?.hidden]).toEqual([true, false]);
  });

  it('Spurtaste öffnet das Pad-Feld; ein Pad wählt, schließt und Display folgt', () => {
    const { root, byLabel } = mount();
    const sheet = byLabel('Pad-Feld');
    byLabel('Spur wählen')?.click();
    expect(sheet?.hidden).toBe(false);
    byLabel('Snare Drum wählen und anhören', sheet ?? root)?.click();
    expect(sheet?.hidden).toBe(true);
    expect(root.querySelector('.lcd-sub')?.textContent).toBe('SD · Snare Drum');
  });

  it('Pad-Feld schließt beim Wechsel weg von mobile', () => {
    const { byLabel, media } = mount();
    byLabel('Spur wählen')?.click();
    media.set(TABLET);
    expect(byLabel('Pad-Feld')?.hidden).toBe(true);
  });

  it('Pattern-Taste und BPM öffnen ihre Flächen, Modus bleibt', () => {
    const { byLabel, visibleModes } = mount();
    byLabel('Pattern wählen, aktuell A')?.click();
    expect(byLabel('Pattern')?.hidden).toBe(false);
    byLabel(`Tempo ${String(baseState().tempo)} BPM, Tempo, Swing und Master öffnen`)?.click();
    expect(byLabel('Pattern')?.hidden).toBe(true);
    expect(byLabel('Tempo')?.hidden).toBe(false);
    expect(visibleModes()).toEqual(['spur']);
  });

  it('mobile: Steps der Spurart, ohne Umschalter; Noten nimmt den Step-Bereich mit', () => {
    const { area, byLabel, root } = mount();
    const steps = area('steps');
    expect(shown(steps.querySelector('.drum-steps'))).toBe(true);
    expect(steps.querySelector<HTMLElement>('[role=tablist]')?.hidden).toBe(true);
    expect(shown(steps.querySelector('.all-tracks'))).toBe(false);
    byLabel('Nächste Spur')?.click();
    expect(shown(steps.querySelector('.drum-steps'))).toBe(true);
    // zur Bass-Spur: Seite Noten, Step-Bereich ausgeblendet
    for (let i = 0; i < 9; i++) byLabel('Nächste Spur')?.click();
    expect(root.querySelector('.track-title')?.textContent).toBe('BA · Bass');
    expect(steps.hidden).toBe(true);
    const klang = [
      ...root.querySelectorAll<HTMLButtonElement>('[aria-label="Seite"] [role=tab]'),
    ].find((b) => b.textContent === 'Klang');
    klang?.click();
    expect(steps.hidden).toBe(false);
    expect(shown(steps.querySelector('.note-steps'))).toBe(true);
  });

  it('tablet: Umschalter „Steps | Alle Spuren“', () => {
    const { area } = mount(TABLET);
    const steps = area('steps');
    const tabs = [...steps.querySelectorAll<HTMLButtonElement>('[role=tab]')];
    expect(tabs.map((t) => t.textContent)).toEqual(['Steps', 'Alle Spuren']);
    expect(shown(steps.querySelector('.drum-steps'))).toBe(true);
    tabs[1]?.click();
    expect(shown(steps.querySelector('.all-tracks'))).toBe(true);
    expect(shown(steps.querySelector('.drum-steps'))).toBe(false);
  });

  it('desktop: „Alle Spuren“, bei Bass und Lead dazu „Noten“', () => {
    const { area, root } = mount(DESKTOP);
    const steps = area('steps');
    const list = () => steps.querySelector<HTMLElement>('[role=tablist]');
    expect(shown(steps.querySelector('.all-tracks'))).toBe(true);
    expect(list()?.hidden).toBe(true);
    root
      .querySelector<HTMLButtonElement>('.track-keys [aria-label="Bass wählen und anhören"]')
      ?.click();
    expect(list()?.hidden).toBe(false);
    const tabs = [...steps.querySelectorAll<HTMLButtonElement>('[role=tab]')];
    expect(tabs.map((t) => t.textContent)).toEqual(['Alle Spuren', 'Noten']);
    tabs[1]?.click();
    expect(shown(steps.querySelector('.roll'))).toBe(true);
    expect(shown(steps.querySelector('.all-tracks'))).toBe(false);
  });
});

describe('mountShell: Layoutwechsel', () => {
  it('mobile→desktop→mobile: Seite bleibt, Rolle liegt in steps bzw. in der Noten-Seite, genau eine', () => {
    const { root, area, media, byLabel } = mount();
    root.querySelector<HTMLButtonElement>('[aria-label="Spur wählen"]')?.click();
    byLabel('Bass wählen und anhören', byLabel('Pad-Feld') ?? root)?.click();
    const notes = () => root.querySelector('[data-page="noten"][data-kind="synth"]');
    expect(shown(notes())).toBe(true);
    expect(root.querySelectorAll('.roll')).toHaveLength(1);
    expect(notes()?.querySelector('[data-slot=roll] .roll')).not.toBeNull();

    media.set(DESKTOP);
    expect(shown(notes())).toBe(true);
    expect(root.querySelectorAll('.roll')).toHaveLength(1);
    expect(area('steps').querySelector('.roll')).not.toBeNull();
    expect(notes()?.querySelector('.roll')).toBeNull();

    media.set({});
    expect(shown(notes())).toBe(true);
    expect(root.querySelectorAll('.roll')).toHaveLength(1);
    expect(notes()?.querySelector('[data-slot=roll] .roll')).not.toBeNull();
  });

  it('Fokus auf einer Seite: tablet→mobile behält SM Klang sichtbar und fokussiert', () => {
    const { root, media } = mount(TABLET);
    root
      .querySelector<HTMLButtonElement>('.track-keys [aria-label="Sampler wählen und anhören"]')
      ?.click();
    const klang = root.querySelector<HTMLElement>('section[data-page="klang"][data-kind="smp"]');
    const knob = klang?.querySelector<HTMLElement>('[role=slider]');
    knob?.focus();
    expect(shown(klang ?? null)).toBe(true);
    media.set({});
    expect(shown(klang ?? null)).toBe(true);
    expect(shown(root.querySelector('section[data-page="trig"][data-kind="smp"]'))).toBe(false);
    expect(document.activeElement).toBe(knob);
  });

  it('Fokus auf einer Seite: desktop→tablet behält BA Amp sichtbar', () => {
    const { root, media } = mount(DESKTOP);
    root
      .querySelector<HTMLButtonElement>('.track-keys [aria-label="Bass wählen und anhören"]')
      ?.click();
    const amp = root.querySelector<HTMLElement>('section[data-page="amp"][data-kind="synth"]');
    const slider = amp?.querySelector<HTMLElement>('[role=slider]');
    slider?.focus();
    media.set(TABLET);
    expect(shown(amp ?? null)).toBe(true);
    expect(document.activeElement).toBe(slider);
  });

  it('Fokus im Mixer: desktop→mobile behält FX sichtbar; ohne Fokus bleibt die Seite', () => {
    const { root, media, modeTab } = mount(DESKTOP);
    modeTab('Mixer')?.click();
    const fx = root.querySelector<HTMLElement>('.mixer-work > section[data-page="fx"]');
    const knob = fx?.querySelector<HTMLElement>('[role=slider]');
    knob?.focus();
    media.set({});
    expect(shown(fx ?? null)).toBe(true);
    expect(shown(root.querySelector('.mixer-work > section[data-page="kanaele"]'))).toBe(false);
    expect(document.activeElement).toBe(knob);
    knob?.blur();
    media.set(DESKTOP);
    media.set({});
    expect(shown(fx ?? null)).toBe(true);
  });

  it('Fokus in der Plattenkiste ändert die Seite der Spur nicht', () => {
    const { root, media, modeTab } = mount(TABLET);
    root
      .querySelector<HTMLButtonElement>('.track-keys [aria-label="Bass wählen und anhören"]')
      ?.click();
    const amp = root.querySelector<HTMLElement>('section[data-page="amp"][data-kind="synth"]');
    [...root.querySelectorAll<HTMLButtonElement>('[aria-label="Seite"] [role=tab]')]
      .find((b) => b.textContent.startsWith('Amp'))
      ?.click();
    amp?.querySelector<HTMLElement>('[role=slider]')?.focus();
    media.set({});
    expect(shown(amp ?? null)).toBe(true);
    modeTab('Sound')?.click();
    const pick = root.querySelector<HTMLElement>(
      '.library section[data-page]:not([hidden]) button',
    );
    pick?.focus();
    expect(document.activeElement).toBe(pick);
    media.set(TABLET);
    modeTab('Spur')?.click();
    expect(shown(amp ?? null)).toBe(true);
  });

  it('Layoutwechsel löst gehaltenen Stutter, wenn seine Seite verschwindet', () => {
    const { modeTab, media, root, audio } = mount(DESKTOP);
    modeTab('Mixer')?.click();
    const stutter = root.querySelector<HTMLButtonElement>('.stp');
    stutter?.dispatchEvent(pointer('pointerdown'));
    expect(audio.stutterOn).toHaveBeenCalled();
    media.set({});
    expect(audio.stutterOff).toHaveBeenCalled();
  });
});

describe('mountShell: Lauflicht, Kürzel, Abbau', () => {
  it('Start lässt den Lauflicht-Takt laufen, Stopp beendet ihn', () => {
    const { root, raf } = mount();
    const play = root.querySelector<HTMLButtonElement>('.play');
    play?.click();
    expect(raf.request).toHaveBeenCalled();
    play?.click();
    expect(raf.cancel).toHaveBeenCalledWith(7);
  });

  it('dispose räumt Bindungen ab und leert die Wurzel', () => {
    const { root, shell, audio } = mount();
    shell.dispose();
    expect(root.childElementCount).toBe(0);
    audio.playhead.value = { step: 3, songIndex: -1 };
    expect(document.querySelector('.now')).toBeNull();
  });

  it('Tastaturkürzel wirken auf dem Desktop; ↓ wählt die nächste Spur', () => {
    const { audio, root } = mount(DESKTOP);
    const press = (key: string) =>
      document.body.dispatchEvent(
        new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
      );
    press(' ');
    expect(audio.start).toHaveBeenCalled();
    press('ArrowDown');
    expect(root.querySelector('.lcd-sub')?.textContent).toBe('SD · Snare Drum');
  });

  it('⌘S sichert, ⌘O öffnet (Desktop)', () => {
    const { files } = mount(DESKTOP);
    const press = (key: string) =>
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key, metaKey: true, bubbles: true, cancelable: true }),
      );
    press('s');
    press('o');
    expect(files.save).toHaveBeenCalledTimes(1);
    expect(files.pickProject).toHaveBeenCalledTimes(1);
  });
});
