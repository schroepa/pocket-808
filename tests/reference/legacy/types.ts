/** Was die Harness aus dem Legacy-Script herausreicht (siehe HOOK in harness.ts). */
export interface DrumParams {
  level: number;
  tune: number;
  decay: number;
}
export interface MixChannel {
  v: number;
  p: number;
  r: number;
  m: boolean;
  s: boolean;
}
export type SynthPatch = Record<string, number | string | boolean | null>;
export type Part = 'BA' | 'LD';

export interface LegacyPattern {
  [voice: string]: unknown;
  notes: Record<Part, unknown[]>;
  smp: number[][];
  sub: Record<string, unknown>;
}

export interface LegacyState {
  tempo: number;
  swing: number;
  master: number;
  mode: string;
  cur: string;
  pat: LegacyPattern;
  patterns: Record<string, LegacyPattern>;
  params: Record<string, DrumParams>;
  synth: Record<Part, SynthPatch>;
  mix: Record<string, MixChannel>;
  fx: Record<string, number>;
  song: { p: string; n: number }[];
  part: Part;
  noteLen: number;
  key: number;
  scale: number;
  sel: number;
  preset: string | null;
  smp: { sel: number; pads: Record<string, unknown>[] };
}

export interface LegacyHooks {
  state: LegacyState;
  readonly ctx: BaseAudioContext | null;
  serial(): unknown;
  ensureAudio(): boolean;
  applyMixAll(): void;
  stutterOn(fraction: number): void;
  stutterOff(): void;
  synthNote(part: Part, midi: number, time: number, duration: number): void;
  smpPlay(pad: number, time: number): void;
  renderVoice(index: number): Promise<void>;
  prerenderAll(): Promise<void>;
  pump(): void;
  begin(): void;
  stop(): void;
  voiceBuf: Record<string, AudioBuffer | undefined>;
  smpPcm: (Float32Array | null)[];
  drumPcm: Record<string, Float32Array | undefined>;
  drumName: Record<string, string | undefined>;
  queue: { step: number; time: number; slot: string; song: boolean; si: number }[];
  DEFAULTS: Record<string, DrumParams>;
  PRESETS: readonly { name: string; tempo: number; swing: number; pat: Record<string, string> }[];
  SLOTS: readonly string[];
  SEED_B: Record<string, string>;
  SEED_NOTES: Record<string, Record<string, [number, number, number][]>>;
  PARTS: readonly Part[];
  PART_INFO: Record<Part, { name: string; base: number; color: string }>;
  NAMES: readonly string[];
  SCALES: readonly { name: string; s: number[] }[];
  WAVES: readonly [string, string][];
  ROWS: number;
  SYN_KEYS: readonly string[];
  SMP_RATE: number;
  SMP_MAX: number;
  SMP_DEF: Record<string, unknown>;
  CHS: readonly string[];
  CH_FULL: Record<string, string>;
  KEY: string;
  SMP_KEY: string;
  FACTORY: readonly { name: string }[];
  mkCurve(k: number, norm: boolean): Float32Array;
  buildIR(
    c: {
      sampleRate: number;
      createBuffer(ch: number, n: number, sr: number): { getChannelData(i: number): Float32Array };
    },
    size: number,
    damp: number,
  ): { getChannelData(i: number): Float32Array };
  degMidi(part: Part, degree: number): number;
  degName(degree: number): string;
  effLen(row: unknown[], step: number): number;
  calcAud(): void;
  aud: Record<string, boolean>;
  tA(x: number): number;
  tD(x: number): number;
  tR(x: number): number;
  mastGain(v: number): number;
  toggle(voiceIndex: number, step: number): void;
  placeNote(degree: number, step: number): void;
  toggleSub(key: string, step: number, k: number): number;
  setSub(key: string, step: number, row: number[]): void;
  clearTrack(): void;
  clearAll(): void;
  loadPreset(preset: unknown): void;
  viewPattern(slot: string): void;
  copyPattern(): void;
  pastePattern(): void;
  snap(): void;
  undoLast(): void;
  VOICES: readonly { id: string; name: string }[];
  SYN_PRESETS: Record<Part, readonly { name: string; v: SynthPatch }[]>;
}

/** Step-Reihe einer Drum-Spur. */
export function row(p: LegacyPattern, id: string): number[] {
  const r = p[id];
  if (!Array.isArray(r)) throw new Error(`Keine Step-Reihe für ${id}`);
  return r as number[];
}
