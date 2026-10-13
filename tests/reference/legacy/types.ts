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
  VOICES: readonly { id: string; name: string }[];
  SYN_PRESETS: Record<Part, readonly { name: string; v: SynthPatch }[]>;
}

/** Step-Reihe einer Drum-Spur. */
export function row(p: LegacyPattern, id: string): number[] {
  const r = p[id];
  if (!Array.isArray(r)) throw new Error(`Keine Step-Reihe für ${id}`);
  return r as number[];
}
