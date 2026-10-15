import { VOICE_IDS } from './constants.ts';
import { blankPattern, parsePattern } from './defaults.ts';
import { keepOpt } from './stepopts.ts';
import type { Pattern, Preset, State, SubMap } from './types.ts';

/** Ersetzt im aktuellen Pattern alle Drum-Spuren; Noten, Sampler-Steps und Pad-Sub-Steps bleiben. */
export function applyPreset(state: State, preset: Preset): State {
  const old = state.patterns[state.cur];
  const keepPads = Object.fromEntries(
    Object.entries(old.sub).filter(([k]) => k.startsWith('P')),
  ) as SubMap;
  const next: Pattern = { ...blankPattern(), notes: old.notes, smp: old.smp, sub: keepPads };
  const padOpts = keepOpt(old, (k) => k.startsWith('P'));
  if (Object.keys(padOpts).length) next.opt = padOpts;
  for (const id of VOICE_IDS) {
    const pat = preset.pat[id];
    if (pat !== undefined) next[id] = parsePattern(pat);
  }
  const patterns = { ...state.patterns };
  patterns[state.cur] = next;
  return { ...state, patterns, tempo: preset.tempo, swing: preset.swing, preset: preset.name };
}
