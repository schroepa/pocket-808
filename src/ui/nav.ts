import { VOICE_IDS } from '../core/constants.ts';
import type { ChannelId, State } from '../core/types.ts';
import { must } from '../core/util.ts';
import { batch, computed, signal, type ReadonlySignal, type Signal } from '../store/signals.ts';
import type { Store } from '../store/store.ts';
import { bind, type Scope } from './dom.ts';
import type { Layout } from './layout.ts';
import { createEditorOpt, type EditorOpt } from './panels/step-opts.ts';

/*
 * Reiner Oberflächen-Zustand des „Geräts“: Modus, Spur, Seite, unterer Bereich und offene Flächen.
 * Nichts davon wird gespeichert; nur die gewählte Drum bzw. der Part stehen im Zustand der App.
 */

export type Mode = 'spur' | 'sound' | 'mixer' | 'song' | 'punch';
export type TrackId = ChannelId;
export type TrackKind = 'drum' | 'synth' | 'smp';
export type PageId =
  'trig' | 'klang' | 'mix' | 'noten' | 'filter' | 'amp' | 'bewegung' | 'chop' | 'tasten';
/** unterer Bereich: 16 Steps, alle Spuren oder die Notenrolle */
export type Lower = 'steps' | 'all' | 'notes';
export type SheetId = 'tracks' | 'pattern' | 'tempo';
export type RollTool = 'note' | 'a' | 's' | 'ch';
/** Sub-Modus eines Step-Rasters: an/aus und der gewählte Step */
export interface EditorSub {
  on: boolean;
  step: number;
}

export const MODE_NAMES: Readonly<Record<Mode, string>> = {
  spur: 'Spur',
  sound: 'Sound',
  mixer: 'Mixer',
  song: 'Song',
  punch: 'Punch',
};
export const PAGE_NAMES: Readonly<Record<PageId, string>> = {
  trig: 'Trig',
  klang: 'Klang',
  mix: 'Mix',
  noten: 'Noten',
  filter: 'Filter',
  amp: 'Amp',
  bewegung: 'Bewegung',
  chop: 'Chop',
  tasten: 'Tasten',
};
/** Seiten je Spur-Art, in Reiter-Reihenfolge */
export const PAGES: Readonly<Record<TrackKind, readonly PageId[]>> = {
  drum: ['trig', 'klang', 'mix'],
  synth: ['noten', 'klang', 'filter', 'amp', 'bewegung', 'mix'],
  smp: ['trig', 'klang', 'chop', 'tasten', 'mix'],
};

type Views = readonly (readonly PageId[])[];
const single = (kind: TrackKind): Views => PAGES[kind].map((p) => [p]);
/** welche Seiten nebeneinander stehen; feste Objekte, damit sich `view` nur bei Wechsel ändert */
const VIEWS: Readonly<Record<TrackKind, Readonly<Record<Layout, Views>>>> = {
  drum: {
    mobile: single('drum'),
    tablet: [['trig', 'klang', 'mix']],
    desktop: [['trig', 'klang', 'mix']],
  },
  synth: {
    mobile: single('synth'),
    tablet: [['noten'], ['klang', 'filter'], ['amp', 'bewegung', 'mix']],
    desktop: [
      ['noten', 'klang', 'filter', 'amp'],
      ['bewegung', 'mix'],
    ],
  },
  smp: {
    mobile: single('smp'),
    tablet: [
      ['trig', 'klang'],
      ['chop', 'tasten', 'mix'],
    ],
    desktop: [
      ['trig', 'klang', 'chop'],
      ['tasten', 'mix'],
    ],
  },
};

export function kindOf(id: TrackId): TrackKind {
  if (id === 'SM') return 'smp';
  return id === 'BA' || id === 'LD' ? 'synth' : 'drum';
}

export const viewsFor = (kind: TrackKind, layout: Layout): Views => VIEWS[kind][layout];

/** Zeigt das Gerät den Step-Bereich, oder braucht der Inhalt darüber den Platz? */
export function stepAreaVisible(mode: Mode, view: readonly PageId[], layout: Layout): boolean {
  if (layout === 'desktop') return true;
  if (layout === 'mobile' && (mode === 'mixer' || mode === 'song')) return false;
  if (mode !== 'spur') return true;
  if (view.includes('noten')) return false;
  return !(layout === 'mobile' && view.includes('tasten'));
}

export const trackSelectVisible = (mode: Mode, layout: Layout): boolean =>
  layout !== 'mobile' || (mode !== 'mixer' && mode !== 'song');

export function lowerFor(layout: Layout, kind: TrackKind, chosen: Lower): Lower {
  if (layout === 'mobile') return 'steps';
  if (layout === 'tablet') return chosen === 'all' ? 'all' : 'steps';
  return kind === 'synth' && chosen === 'notes' ? 'notes' : 'all';
}

export interface Nav {
  readonly mode: ReadonlySignal<Mode>;
  readonly track: ReadonlySignal<TrackId>;
  /** immer eine Seite der aktuellen Spur */
  readonly page: ReadonlySignal<PageId>;
  readonly view: ReadonlySignal<readonly PageId[]>;
  readonly lower: ReadonlySignal<Lower>;
  readonly sheet: Signal<SheetId | null>;
  readonly drumSub: Signal<EditorSub>;
  readonly drumOpt: Signal<EditorOpt>;
  readonly padSub: Signal<EditorSub>;
  readonly padOpt: Signal<EditorOpt>;
  readonly roll: { page: Signal<number>; tool: Signal<RollTool> };
  setMode(m: Mode): void;
  selectTrack(id: TrackId): void;
  selectPage(p: PageId): void;
  setLower(l: Lower): void;
  /** Rolle an dieser Stelle zeigen: Modus Spur, Seite Noten, Takthälfte; Desktop unten „Noten“ */
  openNotes(step: number): void;
}

/** den Zustand für die gewählte Spur nachführen; ohne Änderung derselbe Zustand */
function withTrack(s: State, id: TrackId): State {
  if (id === 'SM') return s;
  if (id === 'BA' || id === 'LD') return s.part === id ? s : { ...s, part: id };
  const sel = VOICE_IDS.indexOf(id);
  return s.sel === sel ? s : { ...s, sel };
}

export function createNav(scope: Scope, store: Store, layout: ReadonlySignal<Layout>): Nav {
  const mode = signal<Mode>('spur');
  // Nur die Art merkt sich die Navigation; welche Drum bzw. welcher Part, steht im Zustand
  const kind = signal<TrackKind>('drum');
  const drum = store.select((s) => must(VOICE_IDS[s.sel], 'Stimme'));
  const part = store.select((s) => s.part);
  const track = computed<TrackId>(() => {
    if (kind.value === 'smp') return 'SM';
    return kind.value === 'synth' ? part.value : drum.value;
  });
  // gewünschte Seite: bleibt erhalten, auch wenn die Art sie gerade nicht hat
  const wish = signal<PageId>('trig');
  const page = computed(() => {
    const pages = PAGES[kind.value];
    return pages.includes(wish.value) ? wish.value : must(pages[0], 'Seite');
  });
  const view = computed(() =>
    must(
      viewsFor(kind.value, layout.value).find((v) => v.includes(page.value)),
      'Ansicht',
    ),
  );
  const chosen = signal<Lower>('steps');
  const lower = computed(() => lowerFor(layout.value, kind.value, chosen.value));
  const sheet = signal<SheetId | null>(null);
  const idle = (): Signal<EditorSub> => signal({ on: false, step: -1 });
  const drumSub = idle();
  const drumOpt = createEditorOpt();
  const padSub = idle();
  const padOpt = createEditorOpt();
  const roll = { page: signal(0), tool: signal<RollTool>('note') };

  // Sub und Opt ändern, was ein Step-Tipp tut: ohne sichtbare Seite Trig gehen sie aus
  const offWithoutTrig = (k: TrackKind, list: readonly Signal<EditorSub>[]): void => {
    bind(
      scope,
      () => mode.value === 'spur' && kind.value === k && view.value.includes('trig'),
      (shown) => {
        if (shown) return;
        for (const s of list) if (s.peek().on) s.value = { ...s.peek(), on: false };
      },
    );
  };
  offWithoutTrig('drum', [drumSub, drumOpt]);
  offWithoutTrig('smp', [padSub, padOpt]);

  const setMode = (m: Mode): void => {
    batch(() => {
      mode.value = m;
      sheet.value = null;
    });
  };

  return {
    mode,
    track,
    page,
    view,
    lower,
    sheet,
    drumSub,
    drumOpt,
    padSub,
    padOpt,
    roll,
    setMode,
    selectTrack: (id) => {
      batch(() => {
        kind.value = kindOf(id);
        store.update((s) => withTrack(s, id));
      });
    },
    selectPage: (p) => {
      wish.value = p;
    },
    setLower: (l) => {
      chosen.value = l;
    },
    openNotes: (step) => {
      batch(() => {
        setMode('spur');
        wish.value = 'noten';
        roll.page.value = step >> 3;
        if (layout.peek() === 'desktop') chosen.value = 'notes';
      });
    },
  };
}
