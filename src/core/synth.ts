import { effectiveLength } from './music.ts';
import { clamp } from './persist.ts';
import type {
  ChannelId,
  NoteRow,
  Part,
  State,
  SynthKey,
  SynthPatch,
  SynthValues,
} from './types.ts';

/*
 * Synth-Bedienung als reine Funktionen (Legacy buildSynth): Regler und Wellenform heben die
 * Preset-Markierung auf, die Oktave nicht; Stumm ist der Mixer-Kanal des Parts.
 */

const withPatch = (s: State, part: Part, fn: (p: SynthPatch) => SynthPatch): State => ({
  ...s,
  synth: { ...s.synth, [part]: fn(s.synth[part]) },
});

export const setSynthValue = (s: State, part: Part, key: SynthKey, v: number): State =>
  withPatch(s, part, (p) => ({ ...p, [key]: v, preset: null }));

export const setWave = (s: State, part: Part, wave: number): State =>
  withPatch(s, part, (p) => ({ ...p, wave, preset: null }));

export const shiftOctave = (s: State, part: Part, d: number): State =>
  withPatch(s, part, (p) => ({ ...p, oct: clamp(p.oct + d, -2, 2) }));

export const applySynthPreset = (
  s: State,
  part: Part,
  preset: { name: string; v: Readonly<SynthValues> },
): State => withPatch(s, part, (p) => ({ ...p, ...preset.v, preset: preset.name }));

export const toggleMute = (s: State, id: ChannelId): State => ({
  ...s,
  mix: { ...s.mix, [id]: { ...s.mix[id], m: !s.mix[id].m } },
});

/** Die nächste Note an oder vor `step` bestimmt die Abdeckung (spätere Noten kürzen frühere). */
export function noteAt(row: NoteRow, step: number): { start: number; d: number } | null {
  for (let a = step; a >= 0; a--) {
    const n = row[a];
    if (n) return a + effectiveLength(row, a) > step ? { start: a, d: n.d } : null;
  }
  return null;
}
