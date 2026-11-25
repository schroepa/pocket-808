import { describe, expect, it } from 'vitest';
import { VOICE_IDS } from '../core/constants.ts';
import { signal } from '../store/signals.ts';
import type { Layout } from './layout.ts';
import {
  createNav,
  kindOf,
  lowerFor,
  MODE_NAMES,
  PAGE_NAMES,
  PAGES,
  stepAreaVisible,
  trackSelectVisible,
  viewsFor,
  type Nav,
  type TrackKind,
} from './nav.ts';
import { makeContext } from './test-utils.ts';

const LAYOUTS: readonly Layout[] = ['mobile', 'tablet', 'desktop'];
const KINDS: readonly TrackKind[] = ['drum', 'synth', 'smp'];

function setup(initial: Layout = 'mobile') {
  const ctx = makeContext();
  const layout = signal<Layout>(initial);
  const nav = createNav(ctx.scope, ctx.store, layout);
  return { ...ctx, layout, nav };
}

/** Sub und Opt beider Raster einschalten */
function arm(nav: Nav): void {
  for (const s of [nav.drumSub, nav.drumOpt, nav.padSub, nav.padOpt]) {
    s.value = { on: true, step: 3 };
  }
}

describe('nav', () => {
  it('Namen der Modi und Seiten', () => {
    expect(Object.values(MODE_NAMES)).toEqual(['Spur', 'Sound', 'Mixer', 'Song', 'Punch']);
    expect(PAGE_NAMES).toEqual({
      trig: 'Trig',
      klang: 'Klang',
      mix: 'Mix',
      noten: 'Noten',
      filter: 'Filter',
      amp: 'Amp',
      bewegung: 'Bewegung',
      chop: 'Chop',
      tasten: 'Tasten',
    });
  });

  it('Art je Spur', () => {
    expect(VOICE_IDS.map(kindOf)).toEqual(VOICE_IDS.map(() => 'drum'));
    expect([kindOf('BA'), kindOf('LD'), kindOf('SM')]).toEqual(['synth', 'synth', 'smp']);
  });

  it('startet in Spur auf der gewählten Drum', () => {
    const { nav, store } = setup();
    expect(nav.mode.value).toBe('spur');
    expect(nav.track.value).toBe(VOICE_IDS[store.state.value.sel]);
    expect(nav.page.value).toBe('trig');
    expect(nav.view.value).toEqual(['trig']);
    expect(nav.lower.value).toBe('steps');
    expect(nav.sheet.value).toBeNull();
    for (const s of [nav.drumSub, nav.drumOpt, nav.padSub, nav.padOpt]) {
      expect(s.value).toEqual({ on: false, step: -1 });
    }
    expect(nav.roll.page.value).toBe(0);
    expect(nav.roll.tool.value).toBe('note');
  });

  it('Spur und Zustand hängen zusammen', () => {
    const { nav, store } = setup();
    nav.selectTrack('LD');
    expect(store.state.value.part).toBe('LD');
    expect(nav.track.value).toBe('LD');
    store.update((s) => ({ ...s, part: 'BA' }));
    expect(nav.track.value).toBe('BA');
    nav.selectTrack('SD');
    expect(store.state.value.sel).toBe(1);
    expect(nav.track.value).toBe('SD');
    nav.selectTrack('SM');
    expect(nav.track.value).toBe('SM');
    expect(store.state.value.sel).toBe(1);
    expect(store.state.value.part).toBe('BA');
  });

  it('selectTrack lässt den Zustand ohne Änderung unberührt', () => {
    const { nav, store } = setup();
    nav.selectTrack('BA');
    const before = store.state.value;
    nav.selectTrack('BA');
    nav.selectTrack('SM');
    nav.selectTrack(VOICE_IDS[before.sel] ?? 'BD');
    expect(store.state.value).toBe(before);
    expect(store.canUndo.value).toBe(false);
  });

  it('Seite bleibt beim Spurwechsel, sonst erste der Art', () => {
    const { nav } = setup();
    nav.selectPage('klang');
    nav.selectTrack('BA');
    expect(nav.page.value).toBe('klang');
    nav.selectTrack('SM');
    expect(nav.page.value).toBe('klang');
    nav.selectTrack('BA');
    nav.selectPage('filter');
    nav.selectTrack('BD');
    expect(nav.page.value).toBe('trig');
    nav.selectTrack('BA');
    expect(nav.page.value).toBe('filter');
  });

  it('viewsFor deckt je Art und Layout jede Seite genau einmal ab', () => {
    for (const kind of KINDS) {
      for (const layout of LAYOUTS) {
        expect([...viewsFor(kind, layout).flat()].sort()).toEqual([...PAGES[kind]].sort());
      }
    }
  });

  it('Seiten und Ansichten nach Tabelle', () => {
    const table = (l: Layout) => KINDS.map((k) => viewsFor(k, l));
    expect(table('mobile')).toEqual([
      [['trig'], ['klang'], ['mix']],
      [['noten'], ['klang'], ['filter'], ['amp'], ['bewegung'], ['mix']],
      [['trig'], ['klang'], ['chop'], ['tasten'], ['mix']],
    ]);
    expect(table('tablet')).toEqual([
      [['trig', 'klang', 'mix']],
      [['noten'], ['klang', 'filter'], ['amp', 'bewegung', 'mix']],
      [
        ['trig', 'klang'],
        ['chop', 'tasten', 'mix'],
      ],
    ]);
    expect(table('desktop')).toEqual([
      [['trig', 'klang', 'mix']],
      [
        ['noten', 'klang', 'filter', 'amp'],
        ['bewegung', 'mix'],
      ],
      [
        ['trig', 'klang', 'chop'],
        ['tasten', 'mix'],
      ],
    ]);
  });

  it('view folgt Seite und Layout und bleibt innerhalb einer Ansicht dieselbe', () => {
    const { nav, layout } = setup('tablet');
    const first = nav.view.value;
    nav.selectPage('klang');
    expect(nav.view.value).toBe(first);
    nav.selectTrack('BA');
    expect(nav.view.value).toEqual(['klang', 'filter']);
    layout.value = 'desktop';
    expect(nav.view.value).toEqual(['noten', 'klang', 'filter', 'amp']);
  });

  it('Sichtbarkeit von Step-Bereich und Spurwahl', () => {
    for (const l of ['tablet', 'desktop'] as const) {
      expect(stepAreaVisible('mixer', ['trig'], l)).toBe(true);
      expect(stepAreaVisible('song', ['trig'], l)).toBe(true);
      expect(trackSelectVisible('mixer', l)).toBe(true);
      expect(trackSelectVisible('song', l)).toBe(true);
    }
    expect(stepAreaVisible('mixer', ['trig'], 'mobile')).toBe(false);
    expect(stepAreaVisible('song', ['trig'], 'mobile')).toBe(false);
    expect(stepAreaVisible('spur', ['noten'], 'mobile')).toBe(false);
    expect(stepAreaVisible('spur', ['tasten'], 'mobile')).toBe(false);
    expect(stepAreaVisible('spur', ['klang'], 'mobile')).toBe(true);
    expect(stepAreaVisible('sound', ['noten'], 'mobile')).toBe(true);
    expect(stepAreaVisible('punch', ['tasten'], 'mobile')).toBe(true);
    expect(stepAreaVisible('spur', ['noten'], 'tablet')).toBe(false);
    expect(stepAreaVisible('spur', ['chop', 'tasten', 'mix'], 'tablet')).toBe(true);
    expect(stepAreaVisible('sound', ['noten'], 'tablet')).toBe(true);
    expect(stepAreaVisible('spur', ['noten', 'klang', 'filter', 'amp'], 'desktop')).toBe(true);
    for (const m of ['spur', 'sound', 'punch'] as const) {
      expect(trackSelectVisible(m, 'mobile')).toBe(true);
    }
    expect(trackSelectVisible('mixer', 'mobile')).toBe(false);
    expect(trackSelectVisible('song', 'mobile')).toBe(false);
  });

  it('unterer Bereich je Layout, Art und Wahl', () => {
    for (const kind of KINDS) {
      for (const chosen of ['steps', 'all', 'notes'] as const) {
        expect(lowerFor('mobile', kind, chosen)).toBe('steps');
        expect(lowerFor('tablet', kind, chosen)).toBe(chosen === 'all' ? 'all' : 'steps');
        expect(lowerFor('desktop', kind, chosen)).toBe(
          kind === 'synth' && chosen === 'notes' ? 'notes' : 'all',
        );
      }
    }
    const { nav, layout } = setup('tablet');
    nav.setLower('all');
    expect(nav.lower.value).toBe('all');
    layout.value = 'mobile';
    expect(nav.lower.value).toBe('steps');
    layout.value = 'desktop';
    nav.setLower('notes');
    expect(nav.lower.value).toBe('all');
    nav.selectTrack('LD');
    expect(nav.lower.value).toBe('notes');
  });

  it('Sub und Opt gehen aus, wenn Trig nicht mehr sichtbar ist', () => {
    const away: readonly ((nav: Nav) => void)[] = [
      (nav) => {
        nav.selectPage('klang');
      },
      (nav) => {
        nav.setMode('sound');
      },
      (nav) => {
        nav.selectTrack('BA');
      },
    ];
    for (const go of away) {
      const { nav } = setup('mobile');
      arm(nav);
      nav.drumOpt.value = { on: true, step: 3 };
      go(nav);
      expect(nav.drumOpt.value).toEqual({ on: false, step: 3 });
      expect(nav.drumSub.value).toEqual({ on: false, step: 3 });
    }

    // Sampler-Raster ebenso
    const pads = setup('mobile').nav;
    pads.selectTrack('SM');
    arm(pads);
    pads.selectPage('chop');
    expect(pads.padSub.value.on).toBe(false);
    expect(pads.padOpt.value.on).toBe(false);

    // Store-Änderungen und Drum-Wechsel lassen Trig sichtbar
    const { nav } = setup('mobile');
    arm(nav);
    nav.selectTrack('SD');
    expect(nav.drumOpt.value.on).toBe(true);
    expect(nav.drumSub.value.on).toBe(true);

    // desktop: Trig bleibt neben Klang sichtbar
    const desk = setup('desktop').nav;
    arm(desk);
    desk.selectPage('klang');
    expect(desk.drumOpt.value.on).toBe(true);
    expect(desk.drumSub.value.on).toBe(true);
  });

  it('openNotes zeigt die richtige Takthälfte', () => {
    const { nav, layout } = setup('mobile');
    nav.selectTrack('BA');
    nav.selectPage('filter');
    nav.setMode('mixer');
    nav.sheet.value = 'tracks';
    nav.openNotes(9);
    expect(nav.mode.value).toBe('spur');
    expect(nav.page.value).toBe('noten');
    expect(nav.roll.page.value).toBe(1);
    expect(nav.sheet.value).toBeNull();
    nav.openNotes(7);
    expect(nav.roll.page.value).toBe(0);
    nav.openNotes(8);
    expect(nav.roll.page.value).toBe(1);
    // außerhalb des Desktops bleibt die Wahl unten unberührt
    layout.value = 'desktop';
    expect(nav.lower.value).toBe('all');
    nav.openNotes(0);
    expect(nav.lower.value).toBe('notes');
  });

  it('setMode schließt offene Flächen', () => {
    const { nav } = setup();
    nav.sheet.value = 'pattern';
    nav.setMode('song');
    expect(nav.mode.value).toBe('song');
    expect(nav.sheet.value).toBeNull();
  });
});
