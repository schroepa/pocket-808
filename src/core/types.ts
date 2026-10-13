/** Zustand der App. Struktur und Feldnamen = Speicherformat 'pocket808.v1' (Legacy serial()). */

export type VoiceId = 'BD' | 'SD' | 'LT' | 'HT' | 'RS' | 'CP' | 'CB' | 'CH' | 'OH' | 'CY';
export type Part = 'BA' | 'LD';
export type ChannelId = VoiceId | Part | 'SM';
export type Slot = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H';
export type Bit = 0 | 1;
/** 16 Steps */
export type StepRow = Bit[];
/** Note als Skalenstufe d (0 = Grundton) mit Länge l in Steps */
export interface Note {
  d: number;
  l: number;
}
export type NoteRow = (Note | null)[];
/** Sub-Steps je Drum-Stimme oder Sampler-Pad ('P0'…'P7'): Step-Index → 16 Teil-Schläge */
export type SubKey = VoiceId | `P${0 | 1 | 2 | 3 | 4 | 5 | 6 | 7}`;
export type SubMap = Partial<Record<SubKey, Partial<Record<number, StepRow>>>>;
export type Pattern = Record<VoiceId, StepRow> & {
  notes: Record<Part, NoteRow>;
  /** 8 Sampler-Pads × 16 Steps */
  smp: StepRow[];
  sub: SubMap;
};
export interface SongEntry {
  p: Slot;
  n: number;
}
export interface DrumParams {
  level: number;
  tune: number;
  decay: number;
}
export type SynthKey =
  | 'cut'
  | 'res'
  | 'env'
  | 'fa'
  | 'fd'
  | 'fs'
  | 'fr'
  | 'aa'
  | 'ad'
  | 'as'
  | 'ar'
  | 'det'
  | 'sub'
  | 'dly'
  | 'lvl';
export type SynthValues = Record<SynthKey, number> & { wave: number };
export type SynthPatch = { oct: number; mute: boolean; preset: string | null } & SynthValues;
export interface Pad {
  name: string;
  start: number;
  end: number;
  tune: number;
  att: number;
  dec: number;
  lvl: number;
  rev: boolean;
}
export interface MixChannel {
  v: number;
  p: number;
  r: number;
  m: boolean;
  s: boolean;
}
export interface Fx {
  size: number;
  damp: number;
  ret: number;
  dj: number;
  djq: number;
}
export interface Preset {
  name: string;
  tempo: number;
  swing: number;
  pat: Partial<Record<VoiceId, string>>;
}
export interface State {
  tempo: number;
  swing: number;
  master: number;
  sel: number;
  patterns: Record<Slot, Pattern>;
  cur: Slot;
  song: SongEntry[];
  mode: 'pattern' | 'song';
  params: Record<VoiceId, DrumParams>;
  preset: string | null;
  key: number;
  scale: number;
  part: Part;
  noteLen: 1 | 2 | 4;
  synth: Record<Part, SynthPatch>;
  open: { synth: boolean; smp: boolean; mix: boolean; fx: boolean };
  smp: { sel: number; pads: Pad[] };
  mix: Record<ChannelId, MixChannel>;
  fx: Fx;
}
