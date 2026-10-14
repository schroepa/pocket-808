import { SAMPLE_STORAGE_KEY } from '../core/constants.ts';
import { encodePcm, parseSampleStore, type DrumSample } from '../core/samples.ts';
import type { VoiceId } from '../core/types.ts';
import type { StorageLike } from './persist.ts';
import { signal, type ReadonlySignal } from './signals.ts';

export type DrumSamples = ReadonlyMap<VoiceId, DrumSample>;

export interface SampleBank {
  readonly drums: ReadonlySignal<DrumSamples>;
  setDrum(voice: VoiceId, sample: DrumSample | null): void;
}

/**
 * Eigene Drum-Samples (Speicher 'pocket808.smp.v1', Schlüssel 'D:<Stimme>'). Wie Legacy wird sofort
 * gespeichert; andere Einträge (Pads) bleiben unberührt. Speicherfehler werden still übergangen.
 */
export function createSampleBank(
  storage: StorageLike,
  initial: Partial<Record<VoiceId, DrumSample>>,
  key = SAMPLE_STORAGE_KEY,
): SampleBank {
  const drums = signal<DrumSamples>(new Map(Object.entries(initial) as [VoiceId, DrumSample][]));
  const persist = (voice: VoiceId, sample: DrumSample | null): void => {
    try {
      const k = `D:${voice}`;
      const rest = Object.fromEntries(
        Object.entries(parseSampleStore(storage.getItem(key))).filter(([x]) => x !== k),
      );
      const next = sample ? { ...rest, [k]: { d: encodePcm(sample.pcm), n: sample.name } } : rest;
      storage.setItem(key, JSON.stringify(next));
    } catch {
      /* Speicher voll oder gesperrt: wie Legacy still weitermachen */
    }
  };
  return {
    drums,
    setDrum(voice, sample) {
      const m = new Map(drums.peek());
      if (sample) m.set(voice, sample);
      else m.delete(voice);
      drums.value = m;
      persist(voice, sample);
    },
  };
}
