import { effectiveLength } from './music.ts';
import { clamp } from './persist.ts';
import type {
  ChannelId,
  NoteRow,
  Part,
  PartFx,
  PartFxKey,
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

/** Drive und Chorus setzen: begrenzt auf 0..1, bei 0 verschwindet das Feld */
const withFx = (patch: SynthPatch, fx: Readonly<PartFx>): SynthPatch => {
  const p = { ...patch };
  delete p.drive;
  delete p.chorus;
  const d = clamp(fx.drive ?? 0, 0, 1);
  const c = clamp(fx.chorus ?? 0, 0, 1);
  return { ...p, ...(d > 0 ? { drive: d } : {}), ...(c > 0 ? { chorus: c } : {}) };
};

export const setPartFx = (s: State, part: Part, key: PartFxKey, v: number): State =>
  withPatch(s, part, (p) => ({ ...withFx(p, { ...p, [key]: v }), preset: null }));

const samePatch = (a: SynthPatch, b: SynthPatch): boolean => {
  const keys = Object.keys(a) as (keyof SynthPatch)[];
  return keys.length === Object.keys(b).length && keys.every((k) => a[k] === b[k]);
};

export interface SynthPreset {
  name: string;
  v: Readonly<SynthValues>;
  fx?: Readonly<PartFx>;
}

/**
 * Preset laden: Klangwerte, Drive und Chorus (fehlende gehen auf 0); Arp, LFO und Oktave bleiben.
 * Ändert sich nichts, kommt derselbe Zustand zurück.
 */
export function applySynthPreset(s: State, part: Part, preset: SynthPreset): State {
  const old = s.synth[part];
  const next = { ...withFx(old, preset.fx ?? {}), ...preset.v, preset: preset.name };
  return samePatch(old, next) ? s : withPatch(s, part, () => next);
}

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
