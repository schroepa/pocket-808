import { CHANNELS } from './constants.ts';
import type { SceneMix, State } from './types.ts';

export const SCENE_COUNT = 8;

/** aktuellen Mixer (Pegel, Mute, Solo) als Szene i sichern */
export function saveScene(s: State, i: number): State {
  const scene = Object.fromEntries(
    CHANNELS.map((id) => [id, { v: s.mix[id].v, m: s.mix[id].m, s: s.mix[id].s }]),
  ) as SceneMix;
  const scenes = (s.scenes ?? Array.from({ length: SCENE_COUNT }, () => null)).map((x, k) =>
    k === i ? scene : x,
  );
  return { ...s, scenes };
}

/** Szene i abrufen: nur Pegel, Mute und Solo; leere Szene ändert nichts */
export function recallScene(s: State, i: number): State {
  const scene = s.scenes?.[i];
  if (!scene) return s;
  const mix = { ...s.mix };
  for (const id of CHANNELS) mix[id] = { ...mix[id], ...scene[id] };
  return { ...s, mix };
}
