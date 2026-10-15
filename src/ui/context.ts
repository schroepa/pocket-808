import type { Part, State, VoiceId } from '../core/types.ts';
import type { SampleBank } from '../store/samples.ts';
import type { ReadonlySignal } from '../store/signals.ts';
import type { Store } from '../store/store.ts';
import type { Scope } from './dom.ts';
import type { Readout } from './readout.ts';

/** Punch-in-Effekte (gleich der Engine, ohne die Schicht zu importieren) */
export type PunchKind = 'loop8' | 'loop16' | 'half' | 'tape' | 'crush' | 'lp' | 'hp' | 'echo';

/** Was die Oberfläche von der Audioseite braucht (main.ts verbindet die Engine). */
export interface UiAudio {
  /** false: kein Web Audio, die App bleibt bedienbar */
  readonly available: boolean;
  readonly playing: ReadonlySignal<boolean>;
  readonly playhead: ReadonlySignal<{ step: number; songIndex: number }>;
  start(): void;
  stop(): void;
  tick(): void;
  audition(voice: VoiceId): void;
  /** Stufe des Parts vorhören (Länge in Steps) */
  auditionNote(part: Part, degree: number, length: number): void;
  /** Pad vorhören (nur wenn es ein Sample hat) */
  auditionPad(pad: number): void;
  /** Stutter an (Bruchteil eines Schlags: 1, 0,5, 0,25, 0,125) bzw. aus */
  stutterOn(fraction: number): void;
  stutterOff(): void;
  /** Fill-Taste gehalten bzw. losgelassen */
  setFill(on: boolean): void;
  /** Punch-in-Effekt halten bzw. loslassen */
  punchOn(kind: PunchKind): void;
  punchOff(kind: PunchKind): void;
  decode(data: ArrayBuffer): Promise<Float32Array>;
  /** WAV offline rendern (eigene Engine-Instanz); null bei Abbruch */
  exportWav(
    state: State,
    playFor: number,
    seconds: number,
    onProgress: (fraction: number) => void,
    signal: AbortSignal,
  ): Promise<Blob | null>;
}

/** Datei wählen (platform/files.ts über main.ts); null bei Abbruch */
export interface UiFiles {
  pickAudio(opts?: { capture?: boolean }): Promise<{ data: ArrayBuffer; name: string } | null>;
  /** Projektdatei wählen (.json) */
  pickProject(): Promise<{ text: string; name: string } | null>;
  /** Datei hinausgeben: Teilen-Menü (iPhone) oder Download */
  save(blob: Blob, name: string): Promise<'shared' | 'downloaded' | 'cancelled' | 'failed'>;
}

/** Mikrofon-Aufnahme (platform/recorder.ts über main.ts) */
export interface UiRecorder {
  start(
    maxMs: number,
  ): Promise<
    { done: Promise<ArrayBuffer | null>; stop(): void } | { error: 'unavailable' | 'denied' }
  >;
}

export interface UiContext {
  store: Store;
  samples: SampleBank;
  audio: UiAudio;
  files: UiFiles;
  recorder: UiRecorder;
  readout: Readout;
  scope: Scope;
}
