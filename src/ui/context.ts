import type { Part, VoiceId } from '../core/types.ts';
import type { SampleBank } from '../store/samples.ts';
import type { ReadonlySignal } from '../store/signals.ts';
import type { Store } from '../store/store.ts';
import type { Scope } from './dom.ts';
import type { Readout } from './readout.ts';

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
  decode(data: ArrayBuffer): Promise<Float32Array>;
}

/** Datei wählen (platform/files.ts über main.ts); null bei Abbruch */
export interface UiFiles {
  pickAudio(opts?: { capture?: boolean }): Promise<{ data: ArrayBuffer; name: string } | null>;
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
