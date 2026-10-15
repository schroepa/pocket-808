import { PAD_COUNT, SAMPLE_STORAGE_KEY } from '../core/constants.ts';
import { encodePcm, parseSampleStore, type DrumSample } from '../core/samples.ts';
import type { VoiceId } from '../core/types.ts';
import type { StorageLike } from './persist.ts';
import { batch, signal, type ReadonlySignal } from './signals.ts';

export type DrumSamples = ReadonlyMap<VoiceId, DrumSample>;
export type PadSamples = readonly (Float32Array | null)[];

export interface SampleBank {
  readonly drums: ReadonlySignal<DrumSamples>;
  readonly pads: ReadonlySignal<PadSamples>;
  setDrum(voice: VoiceId, sample: DrumSample | null): void;
  /** Pad-Sample setzen oder leeren (null: gespeichert als { d: "" }, Legacy clearSample) */
  setPad(i: number, pcm: Float32Array | null): void;
  /** alle Pads und Drum-Samples ersetzen (Projekt öffnen), ein Schreibvorgang */
  replaceAll(
    pads: readonly (Float32Array | null)[],
    drums: Partial<Record<VoiceId, DrumSample>>,
  ): void;
}

/**
 * Eigene Samples (Speicher 'pocket808.smp.v1'): Drums unter 'D:<Stimme>', Pads unter '0'–'7'.
 * Wie Legacy wird sofort gespeichert; andere Einträge bleiben unberührt, Fehler werden übergangen.
 */
export function createSampleBank(
  storage: StorageLike,
  initialDrums: Partial<Record<VoiceId, DrumSample>>,
  initialPads: PadSamples = [],
  key = SAMPLE_STORAGE_KEY,
): SampleBank {
  const drums = signal<DrumSamples>(
    new Map(Object.entries(initialDrums) as [VoiceId, DrumSample][]),
  );
  const pads = signal<PadSamples>([...initialPads]);
  /** Einträge ersetzen: drop entscheidet, welche alten Schlüssel wegfallen */
  const write = (
    drop: (k: string) => boolean,
    add: Record<string, Record<string, string>>,
  ): void => {
    try {
      const rest = Object.fromEntries(
        Object.entries(parseSampleStore(storage.getItem(key))).filter(([x]) => !drop(x)),
      );
      storage.setItem(key, JSON.stringify({ ...rest, ...add }));
    } catch {
      /* Speicher voll oder gesperrt: wie Legacy still weitermachen */
    }
  };
  const persist = (k: string, entry: Record<string, string> | null): void => {
    write((x) => x === k, entry ? { [k]: entry } : {});
  };
  return {
    drums,
    pads,
    setDrum(voice, sample) {
      const m = new Map(drums.peek());
      if (sample) m.set(voice, sample);
      else m.delete(voice);
      drums.value = m;
      persist(`D:${voice}`, sample ? { d: encodePcm(sample.pcm), n: sample.name } : null);
    },
    setPad(i, pcm) {
      const next = [...pads.peek()];
      next[i] = pcm;
      pads.value = next;
      persist(String(i), { d: pcm ? encodePcm(pcm) : '' });
    },
    replaceAll(nextPads, nextDrums) {
      const list = Array.from({ length: PAD_COUNT }, (_, i) => nextPads[i] ?? null);
      const map = new Map(Object.entries(nextDrums) as [VoiceId, DrumSample][]);
      batch(() => {
        pads.value = list;
        drums.value = map;
      });
      const add: Record<string, Record<string, string>> = {};
      list.forEach((pcm, i) => {
        add[String(i)] = { d: pcm ? encodePcm(pcm) : '' };
      });
      for (const [id, s] of map) add[`D:${id}`] = { d: encodePcm(s.pcm), n: s.name };
      write((x) => x.startsWith('D:') || /^[0-7]$/.test(x), add);
    },
  };
}
