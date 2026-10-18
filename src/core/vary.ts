import { currentPattern, replacePattern } from './pattern.ts';
import type { Rng } from './random.ts';
import { setStepOpt, withOpt } from './stepopts.ts';
import type { State, VoiceId } from './types.ts';

/*
 * Würfel (wie die Tombola des OP-1): eine Variation des aktuellen Patterns. Ändert nur BD, SD, CH und
 * OH; Noten, Sampler, Sub-Steps und andere Slots bleiben unberührt. Deterministisch je Zufallsquelle.
 */

const GHOST_HAT = 0.35;
const GHOST_SNARE = 0.3;
const DRUMS = ['BD', 'SD', 'CH', 'OH'] as const;

const setBit = (s: State, voice: VoiceId, step: number, on: boolean): State => {
  const p = currentPattern(s);
  if (Boolean(p[voice][step]) === on) return s;
  const row = p[voice].map((b, k) => (k === step ? (on ? 1 : 0) : b));
  const next = { ...p, [voice]: row };
  return replacePattern(s, s.cur, on ? next : withOpt(next, voice, step, null));
};
const hit = (s: State, voice: VoiceId, step: number, v?: number): State => {
  const t = setBit(s, voice, step, true);
  return v === undefined ? t : setStepOpt(t, voice, step, { v });
};
const pick = <T>(list: readonly T[], rng: Rng): T | undefined =>
  list[Math.floor(rng() * list.length)];
const steps = (fn: (st: number) => boolean): number[] =>
  Array.from({ length: 16 }, (_, k) => k).filter(fn);

export function vary(state: State, rng: Rng): State {
  let s = state;
  const on = (voice: VoiceId, st: number): boolean => currentPattern(s)[voice][st] === 1;
  // leeres Schlagzeug: erst ein Grundbeat
  if (DRUMS.every((id) => !currentPattern(s)[id].some(Boolean))) {
    for (const st of [0, 4, 8, 12]) s = hit(s, 'BD', st);
    for (const st of [4, 12]) s = hit(s, 'SD', st);
    for (const st of steps((k) => k % 2 === 0)) s = hit(s, 'CH', st);
  }
  // Ghost-Hats auf freien Steps
  for (let st = 0; st < 16; st++) {
    if (!on('CH', st) && rng() < 0.25) s = hit(s, 'CH', st, GHOST_HAT);
  }
  // Kick-Variation auf einem freien ungeraden Step der zweiten Hälfte
  if (rng() < 0.6) {
    const st = pick(
      steps((k) => k >= 8 && k % 2 === 1 && !on('BD', k)),
      rng,
    );
    if (st !== undefined) s = hit(s, 'BD', st);
  }
  // Snare-Ghost direkt vor einer Snare
  if (rng() < 0.5) {
    const st = pick(
      steps((k) => k > 0 && on('SD', k) && !on('SD', k - 1)),
      rng,
    );
    if (st !== undefined) s = hit(s, 'SD', st - 1, GHOST_SNARE);
  }
  // Open Hat am Ende
  if (rng() < 0.3) {
    const st = rng() < 0.5 ? 14 : 15;
    if (!on('OH', st)) s = hit(s, 'OH', st);
  }
  // Ausdünnen: ein Hat auf einem ungeraden Step weg
  if (rng() < 0.25) {
    const st = pick(
      steps((k) => k % 2 === 1 && on('CH', k) && !currentPattern(s).sub.CH?.[k]),
      rng,
    );
    if (st !== undefined) s = setBit(s, 'CH', st, false);
  }
  return s === state ? state : { ...s, preset: null };
}
