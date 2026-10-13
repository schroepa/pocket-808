import { clamp } from './persist.ts';
import type { Slot, State } from './types.ts';
import { must } from './util.ts';

export const SONG_MAX = 32;

export const appendToSong = (s: State): State =>
  s.song.length >= SONG_MAX ? s : { ...s, song: [...s.song, { p: s.cur, n: 1 }] };

export function bumpRepeat(s: State, index: number, delta: number): State {
  if (!s.song[index]) return s;
  return {
    ...s,
    song: s.song.map((x, i) => (i === index ? { ...x, n: clamp(x.n + delta, 1, 16) } : x)),
  };
}

/** Eintrag um delta verschieben; neue Auswahl ist index + delta. */
export function moveEntry(s: State, index: number, delta: number): State {
  const j = index + delta;
  const a = s.song[index];
  const b = s.song[j];
  if (!a || !b) return s;
  const song = s.song.slice();
  song[index] = b;
  song[j] = a;
  return { ...s, song };
}

/** Eintrag entfernen; neue Auswahl ist min(index, Länge − 1). */
export const removeEntry = (s: State, index: number): State =>
  s.song[index] ? { ...s, song: s.song.filter((_, i) => i !== index) } : s;

export const clearSong = (s: State): State => ({ ...s, song: [] });

/** Position des Song-Modus beim Abspielen (Legacy songIdx/songRep/songFirst). */
export interface SongCursor {
  first: boolean;
  index: number;
  repeat: number;
}

export const songStart = (): SongCursor => ({ first: true, index: 0, repeat: 0 });

/**
 * Modus wechseln (Legacy setMode: songFirst=true). Der Song beginnt danach wieder von vorn –
 * auch bei einem Wechsel mitten im Takt oder erneutem Tippen auf „Song“.
 */
export const changeMode = (
  s: State,
  mode: State['mode'],
): { state: State; cursor: SongCursor } => ({ state: { ...s, mode }, cursor: songStart() });

/**
 * Zu Beginn jedes Takts: Song-Position weiterzählen. `slot` gilt nur im Song-Modus für den ganzen
 * Takt; welches Pattern ein Step spielt, liefert `stepSlot` (im Pattern-Modus zählt state.cur
 * bei jedem Step, ein Slot-Wechsel wirkt also sofort).
 */
export function nextBar(
  c: SongCursor,
  s: Pick<State, 'mode' | 'song' | 'cur'>,
): { cursor: SongCursor; slot: Slot; fromSong: boolean } {
  if (s.mode !== 'song' || !s.song.length) {
    return { cursor: { ...c, first: true }, slot: s.cur, fromSong: false };
  }
  let { index, repeat } = c;
  if (c.first) {
    index = 0;
    repeat = 0;
  } else {
    repeat++;
    const entry = s.song[index];
    if (!entry || repeat >= entry.n) {
      index = (index + 1) % s.song.length;
      repeat = 0;
    }
  }
  if (index >= s.song.length) index = 0;
  const slot = must(s.song[index], `Song-Eintrag ${index}`).p;
  return { cursor: { first: false, index, repeat }, slot, fromSong: true };
}

/** Pattern, das ein Step spielt (Legacy pump: barSong ? barSlot : state.cur). */
export const stepSlot = (bar: { slot: Slot; fromSong: boolean }, s: Pick<State, 'cur'>): Slot =>
  bar.fromSong ? bar.slot : s.cur;
