import type { ChannelId } from '../../core/types.ts';
import { must } from '../../core/util.ts';
import { computed, type ReadonlySignal } from '../../store/signals.ts';
import type { UiContext } from '../context.ts';
import { viewTabs } from '../controls/view-tabs.ts';
import { show } from '../controls/visible.ts';
import { bind, h } from '../dom.ts';
import type { Layout } from '../layout.ts';
import {
  kindOf,
  PAGE_NAMES,
  PAGES,
  viewsFor,
  type Nav,
  type PageId,
  type TrackKind,
} from '../nav.ts';
import { channelPage } from './channel.ts';
import { drumSoundPage, drumTrigPage } from './drum-pages.ts';
import { samplerPages } from './sampler/pages.ts';
import { synthAmpPage, synthFilterPage, synthMotionPage, synthSoundPage } from './synth/modules.ts';
import { synthNotesPage } from './synth/roll.ts';
import { selectedVoice } from './voice.ts';
import './track-work.css';

/*
 * Arbeitsfläche im Modus „Spur“: Reiter und Seiten der gewählten Spur. Alle Seiten werden einmal
 * gebaut und nur ein- und ausgeblendet.
 */

type Bodies = Readonly<Partial<Record<PageId, HTMLElement>>>;

export function trackWork(c: UiContext, nav: Nav, layout: ReadonlySignal<Layout>): HTMLElement {
  const { store, scope } = c;
  const kind = computed(() => kindOf(nav.track.value));
  const smp = samplerPages(c, nav);
  // je Spur-Art ein eigener Kanal: Eine ausgeblendete Seite Mix trägt nie die Namen der sichtbaren
  const mix = (id: ReadonlySignal<ChannelId>): HTMLElement => channelPage(c, id);
  const bodies: Readonly<Record<TrackKind, Bodies>> = {
    drum: {
      trig: drumTrigPage(c, nav),
      klang: drumSoundPage(c, nav),
      mix: mix(selectedVoice(store)),
    },
    synth: {
      noten: synthNotesPage(c, nav.roll),
      klang: synthSoundPage(c),
      filter: synthFilterPage(c),
      amp: synthAmpPage(c),
      bewegung: synthMotionPage(c),
      mix: mix(store.select((s) => s.part)),
    },
    smp: {
      trig: smp.trig,
      klang: smp.klang,
      chop: smp.chop,
      tasten: smp.tasten,
      mix: mix(computed(() => 'SM')),
    },
  };
  const sections = (['drum', 'synth', 'smp'] as const).flatMap((k) =>
    PAGES[k].map((page) => {
      const el = h(
        'section',
        { attrs: { 'data-page': page, 'data-kind': k, 'aria-label': PAGE_NAMES[page] } },
        [must(bodies[k][page], 'Seite')],
      );
      bind(
        scope,
        () => kind.value === k && nav.view.value.includes(page),
        (on) => {
          show(el, on);
        },
      );
      return el;
    }),
  );
  // Pads und Meldung gehören beim Sampler zu jeder Seite
  bind(
    scope,
    () => kind.value === 'smp',
    (on) => {
      show(smp.head, on);
    },
  );
  const bar = viewTabs(scope, {
    label: 'Seite',
    names: PAGE_NAMES,
    views: computed(() => viewsFor(kind.value, layout.value)),
    view: nav.view,
    write: (p) => {
      nav.selectPage(p);
    },
  });
  return h('div', { class: 'track-work' }, [
    bar,
    smp.head,
    h('div', { class: 'track-pages' }, sections),
  ]);
}
