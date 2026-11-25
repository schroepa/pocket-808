import { CHANNEL_NAMES, CHANNELS } from '../core/constants.ts';
import { degreeName } from '../core/music.ts';
import type { State } from '../core/types.ts';
import { must } from '../core/util.ts';
import type { UiContext } from './context.ts';
import { listen } from './dom.ts';
import type { Nav, TrackId } from './nav.ts';
import { hearPad, padHit } from './panels/sampler/common.ts';
import { recordTap } from './record.ts';

/* Was eine Spur beim Antippen tut, wie sie heißt und welche als nächste kommt. */

export function trackTitle(s: State, id: TrackId): string {
  const name = id === 'SM' ? `Pad ${String(s.smp.sel + 1)}` : CHANNEL_NAMES[id];
  return `${id} · ${name}`;
}

/** Spur anspielen: Drum, Grundton von Bass bzw. Lead oder das gewählte Pad, falls belegt */
function hearTrack(c: UiContext, id: TrackId): void {
  if (id === 'SM') hearPad(c, c.store.state.peek().smp.sel);
  else if (id === 'BA' || id === 'LD') c.audio.auditionNote(id, 0, 2);
  else c.audio.audition(id);
}

type Hit = ReturnType<Parameters<typeof recordTap>[2]>;

/** Der Schlag, den ein Tipp auf die Spur aufnimmt (liest Zustand und Pad erst beim Tipp) */
function trackHit(c: UiContext, id: TrackId): Hit {
  const s = c.store.state.peek();
  if (id === 'SM') return padHit(c, s.smp.sel);
  if (id === 'BA' || id === 'LD') {
    return {
      make: (pos) => ({ kind: 'note', part: id, degree: 0, length: s.noteLen, ...pos }),
      label: degreeName(0, s),
    };
  }
  return { make: (pos) => ({ kind: 'drum', voice: id, ...pos }), label: id };
}

/**
 * `el` zur Spur-Taste machen: Ein Tipp wählt und spielt an; bei scharfer Aufnahme setzt schon das
 * Antippen den Schlag. Wer für 'SM' ein bestimmtes Pad meint, muss es vor dem Aufruf von trackTap
 * mit eigenen Listenern sowohl bei pointerdown (Aufnahme) als auch bei click (Anspielen) wählen.
 */
export function trackTap(c: UiContext, nav: Nav, el: HTMLElement, id: TrackId): void {
  listen(c.scope, el, 'click', () => {
    nav.selectTrack(id);
    hearTrack(c, id);
  });
  recordTap(c, el, () => trackHit(c, id));
}

/** vorige bzw. nächste Spur in der Reihenfolge der Kanäle; an den Enden bleibt die Wahl */
export function shiftTrack(nav: Nav, d: -1 | 1): void {
  const i = CHANNELS.indexOf(nav.track.peek()) + d;
  if (i < 0 || i >= CHANNELS.length) return;
  nav.selectTrack(must(CHANNELS[i], 'Spur'));
}
