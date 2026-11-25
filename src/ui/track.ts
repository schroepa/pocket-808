import { CHANNEL_NAMES, CHANNELS } from '../core/constants.ts';
import { degreeName } from '../core/music.ts';
import { selectPad } from '../core/sampler.ts';
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

/** Der Schlag, den ein Tipp auf die Spur aufnimmt (liest Zustand und gewähltes Pad erst beim Tipp) */
function trackHit(c: UiContext, id: TrackId, pad?: number): Hit {
  const s = c.store.state.peek();
  if (id === 'SM') return padHit(c, pad ?? s.smp.sel);
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
 * Antippen den Schlag. `pad` (nur für 'SM') meint ein bestimmtes statt des gewählten Pads: Es wird
 * direkt aufgenommen, aber erst beim click gewählt, damit sich beim Drücken nichts verschiebt.
 */
export function trackTap(c: UiContext, nav: Nav, el: HTMLElement, id: TrackId, pad?: number): void {
  listen(c.scope, el, 'click', () => {
    if (pad !== undefined) c.store.update((s) => selectPad(s, pad));
    nav.selectTrack(id);
    hearTrack(c, id);
  });
  recordTap(c, el, () => trackHit(c, id, pad));
}

/** vorige bzw. nächste Spur in der Reihenfolge der Kanäle; an den Enden bleibt die Wahl */
export function shiftTrack(nav: Pick<Nav, 'track' | 'selectTrack'>, d: -1 | 1): void {
  const i = CHANNELS.indexOf(nav.track.peek()) + d;
  if (i < 0 || i >= CHANNELS.length) return;
  nav.selectTrack(must(CHANNELS[i], 'Spur'));
}
