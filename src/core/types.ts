/** Zustand der App. Struktur und Feldnamen = Speicherformat 'pocket808.v1' (Legacy serial()). */

export type VoiceId = 'BD' | 'SD' | 'LT' | 'HT' | 'RS' | 'CP' | 'CB' | 'CH' | 'OH' | 'CY';
export type Part = 'BA' | 'LD';
export type ChannelId = VoiceId | Part | 'SM';
export type Slot = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H';
export type Bit = 0 | 1;
/** 16 Steps */
export type StepRow = Bit[];
/** Note als Skalenstufe d (0 = Grundton) mit Länge l in Steps */
/** Akkord einer Note (in Skalenstufen gestapelt, Etappe 6a) */
export type ChordKind = 'tri' | 'sev' | 'pow' | 'oct';
export interface Note {
  d: number;
  l: number;
  /** Akzent: lauter und heller */
  a?: true;
  /** Slide: gleitet von der vorigen Note */
  s?: true;
  ch?: ChordKind;
}
export type NoteRow = (Note | null)[];
/** Sub-Steps je Drum-Stimme oder Sampler-Pad ('P0'…'P7'): Step-Index → 16 Teil-Schläge */
export type SubKey = VoiceId | `P${0 | 1 | 2 | 3 | 4 | 5 | 6 | 7}`;
export type SubMap = Partial<Record<SubKey, Partial<Record<number, StepRow>>>>;
/** Bedingung eines Steps: immer, a-ter von b Durchläufen, erster bzw. nicht erster Durchlauf */
export type StepCond =
  | 'all'
  | '1:2'
  | '2:2'
  | '1:3'
  | '2:3'
  | '3:3'
  | '1:4'
  | '2:4'
  | '3:4'
  | '4:4'
  | 'first'
  | 'notFirst'
  | 'fill'
  | 'notFill';
/** Optionen eines Steps (nur Abweichungen vom Standard v 1, p 1, c 'all' werden gespeichert) */
export interface StepOpt {
  /** Velocity 0..1 */
  v?: number;
  /** Wahrscheinlichkeit 0..1 */
  p?: number;
  c?: StepCond;
  /** Parameter-Lock Tune 0..1 (vorhanden = gelockt) */
  t?: number;
  /** Parameter-Lock Decay 0..1 */
  d?: number;
  /** Parameter-Lock Sample-Start 0..1 (nur Pads) */
  s?: number;
}
export type OptMap = Partial<Record<SubKey, Partial<Record<number, StepOpt>>>>;
export type Pattern = Record<VoiceId, StepRow> & {
  notes: Record<Part, NoteRow>;
  /** 8 Sampler-Pads × 16 Steps */
  smp: StepRow[];
  sub: SubMap;
  /** Step-Optionen (Etappe 3); fehlt, solange keine gesetzt sind */
  opt?: OptMap;
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
/** Arpeggiator (Etappe 6b): Modus, Rate (1 = 1/16, 2 = 1/32), Oktaven; fehlt = aus */
export type ArpMode = 'up' | 'down' | 'ud' | 'rnd';
export interface ArpSettings {
  m: ArpMode;
  r: 1 | 2;
  o: 1 | 2;
}
/** LFO (Etappe 6b): Rate und Depth 0..1, Ziel Cutoff oder Pitch */
export interface LfoSettings {
  r: number;
  d: number;
  t: 'cut' | 'pit';
}
export type SynthPatch = {
  oct: number;
  mute: boolean;
  preset: string | null;
  /** optional: fehlt, solange nicht gesetzt (alte Stände bleiben bytegleich) */
  arp?: ArpSettings;
  lfo?: LfoSettings;
} & SynthValues;
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
/** Szene: je Kanal Pegel, Mute und Solo (Etappe 5) */
export interface SceneChannel {
  v: number;
  m: boolean;
  s: boolean;
}
export type SceneMix = Record<ChannelId, SceneChannel>;
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
  /** aufgeklappte Geräte; punch fehlt in alten Ständen (Etappe 4b) */
  open: { synth: boolean; smp: boolean; mix: boolean; fx: boolean; punch?: boolean };
  smp: { sel: number; pads: Pad[] };
  mix: Record<ChannelId, MixChannel>;
  fx: Fx;
  /** 8 Mixer-Szenen; fehlt, solange keine gesichert ist */
  scenes?: (SceneMix | null)[];
}
