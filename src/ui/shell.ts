import type { Timer } from '../store/persist.ts';
import type { SampleBank } from '../store/samples.ts';
import { batch, computed, signal, type ReadonlySignal, type Signal } from '../store/signals.ts';
import type { Store } from '../store/store.ts';
import type { UiAudio, UiContext, UiFiles, UiRecorder } from './context.ts';
import { sheet } from './controls/sheet.ts';
import { tabs } from './controls/tabs.ts';
import { show } from './controls/visible.ts';
import { bind, createScope, h } from './dom.ts';
import { installKeys, shortcutHelp } from './keys.ts';
import { watchLayout, type Layout } from './layout.ts';
import {
  createNav,
  kindOf,
  MODE_NAMES,
  stepAreaVisible,
  trackSelectVisible,
  type Lower,
  type Mode,
  type Nav,
  type PageId,
  type SheetId,
} from './nav.ts';
import { allTracks } from './panels/all-tracks.ts';
import { display, displayLine } from './panels/display.ts';
import { lcdScope } from './panels/lcd-scope.ts';
import { library } from './panels/library.ts';
import { mixerWork, type MixPage } from './panels/mixer/mixer.ts';
import { modeBar } from './panels/mode-bar.ts';
import { patternSheetContent } from './panels/pattern-sheet.ts';
import { projectDialog } from './panels/project/dialog.ts';
import { punchGrid } from './panels/punch/punch.ts';
import { songPanel } from './panels/song.ts';
import { stepArea } from './panels/step-area.ts';
import { rollGrid } from './panels/synth/roll.ts';
import { tempoControls } from './panels/tempo.ts';
import { trackBar, trackKeys, trackPadsContent } from './panels/track-select.ts';
import { trackWork } from './panels/track-work.ts';
import { transport } from './panels/transport.ts';
import { drivePlayhead } from './playhead.ts';
import { createReadout } from './readout.ts';
import './styles/app.css';

export interface ShellDeps {
  store: Store;
  samples: SampleBank;
  audio: UiAudio;
  files: UiFiles;
  recorder: UiRecorder;
  timer: Timer;
  win: Pick<Window, 'matchMedia' | 'requestAnimationFrame' | 'cancelAnimationFrame'>;
}

const MODES: readonly Mode[] = ['spur', 'sound', 'mixer', 'song', 'punch'];
const LOWER_NAMES: Readonly<Record<Lower, string>> = {
  steps: 'Steps',
  all: 'Alle Spuren',
  notes: 'Noten',
};

/** Spurwahl: schmale Leiste mit Pad-Feld (mobile) bzw. alle Spuren als Tasten */
function trackArea(c: UiContext, nav: Nav, layout: ReadonlySignal<Layout>): HTMLElement {
  const bar = trackBar(c, nav);
  const keys = trackKeys(c, nav);
  bind(
    c.scope,
    () => layout.value === 'mobile',
    (mobile) => {
      show(bar, mobile);
      show(keys, !mobile);
    },
  );
  const el = h('div', { class: 'tracks-area', attrs: { 'data-area': 'tracks' } }, [bar, keys]);
  bind(
    c.scope,
    () => trackSelectVisible(nav.mode.value, layout.value),
    (on) => {
      show(el, on);
    },
  );
  return el;
}

/** Arbeitsfläche: je Modus ein Bereich, sichtbar ist genau der des Modus */
function workArea(
  c: UiContext,
  nav: Nav,
  layout: ReadonlySignal<Layout>,
  mixPage: Signal<MixPage>,
): HTMLElement {
  const bodies: Readonly<Record<Mode, HTMLElement>> = {
    spur: trackWork(c, nav, layout),
    sound: library(c, layout),
    mixer: mixerWork(c, layout, mixPage),
    song: songPanel(c),
    punch: punchGrid(c),
  };
  const sections = MODES.map((m) => {
    const el = h('section', { attrs: { 'data-mode': m, 'aria-label': MODE_NAMES[m] } }, [
      bodies[m],
    ]);
    bind(
      c.scope,
      () => nav.mode.value === m,
      (on) => {
        show(el, on);
      },
    );
    return el;
  });
  return h('div', { class: 'work', attrs: { 'data-area': 'work' } }, sections);
}

/**
 * Step-Bereich: 16 Steps, „Alle Spuren“ oder (Desktop) die Notenrolle. Tablet schaltet zwischen
 * Steps und Alle Spuren um, Desktop zwischen Alle Spuren und Noten (nur bei Bass und Lead).
 */
function stepsArea(
  c: UiContext,
  nav: Nav,
  layout: ReadonlySignal<Layout>,
  notes: HTMLElement,
): HTMLElement {
  const { scope } = c;
  const choices = computed((): readonly Lower[] => {
    if (layout.value === 'mobile') return [];
    if (layout.value === 'tablet') return ['steps', 'all'];
    return kindOf(nav.track.value) === 'synth' ? ['all', 'notes'] : ['all'];
  });
  const bar = tabs<Lower>(scope, {
    label: 'Step-Bereich',
    items: computed(() => choices.value.map((value) => ({ value, label: LOWER_NAMES[value] }))),
    value: nav.lower,
    write: (l) => {
      nav.setLower(l);
    },
  });
  bind(
    scope,
    () => choices.value.length > 1,
    (many) => {
      show(bar, many);
    },
  );
  const views: readonly (readonly [Lower, HTMLElement])[] = [
    ['steps', stepArea(c, nav)],
    ['all', allTracks(c, nav)],
    ['notes', notes],
  ];
  for (const [id, el] of views) {
    bind(
      scope,
      () => nav.lower.value === id,
      (on) => {
        show(el, on);
      },
    );
  }
  const el = h('div', { class: 'steps-area', attrs: { 'data-area': 'steps' } }, [
    bar,
    ...views.map(([, v]) => v),
  ]);
  bind(
    scope,
    () => stepAreaVisible(nav.mode.value, nav.view.value, layout.value),
    (on) => {
      show(el, on);
    },
  );
  return el;
}

/**
 * Baut das Gerät: Display, Modusleiste, Spurwahl, Arbeitsfläche, Step-Bereich, Transport und die drei
 * Flächen darüber. Alle Teile entstehen einmal; Sichtbarkeit nur über show(). Die Anordnung je Layout
 * bestimmt styles/layout.css (data-layout).
 */
export function mountShell(
  root: HTMLElement,
  deps: ShellDeps,
): { layout: ReadonlySignal<Layout>; dispose(): void } {
  const scope = createScope();
  const measured = watchLayout(scope, deps.win, document.documentElement);
  // Das Layout der Oberfläche folgt dem gemessenen erst, nachdem die Seite mit dem Fokus gewählt ist
  const layout = signal<Layout>(measured.peek());
  const nav = createNav(scope, deps.store, layout);
  const mixPage = signal<MixPage>('kanaele');
  const readout = createReadout(scope, displayLine(deps, nav), deps.timer);
  const c: UiContext = {
    store: deps.store,
    samples: deps.samples,
    audio: deps.audio,
    files: deps.files,
    recorder: deps.recorder,
    readout,
    scope,
  };
  const raf = {
    request: (fn: () => void) => deps.win.requestAnimationFrame(fn),
    cancel: (id: number) => {
      deps.win.cancelAnimationFrame(id);
    },
  };
  const file = projectDialog(c);
  const strip = lcdScope(c, raf, deps.win.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const head = display(c, nav, [file.el, shortcutHelp(c)], strip);
  head.dataset.area = 'display';
  const modes = modeBar(c, nav);
  modes.dataset.area = 'modes';

  // Die Notenrolle gibt es einmal: Desktop unten im Step-Bereich, sonst im Platz der Seite Noten
  const roll = rollGrid(c, nav.roll);
  const notes = h('div', { class: 'lower-notes' });
  const work = workArea(c, nav, layout, mixPage);
  // Layoutwechsel (Drehen): die Seite mit dem Fokus wird gewählt und bleibt so sichtbar
  bind(
    scope,
    () => measured.value,
    (next) => {
      batch(() => {
        const page = document.activeElement?.closest<HTMLElement>('section[data-page]');
        const box = page && work.contains(page) ? page.parentElement?.classList : undefined;
        const id = page?.dataset.page ?? '';
        if (box?.contains('mixer-work')) mixPage.value = id as MixPage;
        else if (box?.contains('track-pages')) nav.selectPage(id as PageId);
        layout.value = next;
      });
    },
  );
  const slot = work.querySelector('[data-slot=roll]');
  bind(
    scope,
    () => layout.value === 'desktop',
    (desktop) => {
      (desktop ? notes : slot)?.append(roll);
    },
  );

  const flat = (id: SheetId, label: string, content: HTMLElement): HTMLElement => {
    const el = sheet(scope, {
      label,
      open: computed(() => nav.sheet.value === id),
      close: () => {
        nav.sheet.value = null;
      },
      content,
    });
    el.dataset.sheet = id;
    return el;
  };
  // Das Pad-Feld gehört zur Leiste des Telefons
  bind(
    scope,
    () => layout.value !== 'mobile' && nav.sheet.value === 'tracks',
    (stale) => {
      if (stale) nav.sheet.value = null;
    },
  );

  root.replaceChildren(
    h('main', { class: 'shell' }, [
      head,
      modes,
      trackArea(c, nav, layout),
      work,
      stepsArea(c, nav, layout, notes),
      transport(c),
      flat('tracks', 'Pad-Feld', trackPadsContent(c, nav)),
      flat('pattern', 'Pattern', patternSheetContent(c, nav)),
      flat('tempo', 'Tempo', tempoControls(c)),
    ]),
  );
  installKeys(c, layout, document, nav, {
    save: () => void file.save(),
    open: () => void file.open(),
  });
  drivePlayhead(scope, deps.audio, raf);
  return {
    layout,
    dispose() {
      scope.dispose();
      root.replaceChildren();
    },
  };
}
