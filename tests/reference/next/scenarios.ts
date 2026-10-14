import { createRequire } from 'node:module';
import { noiseData, softClipCurve } from '../../../src/audio/dsp.ts';
import { renderVoice, type OfflineFactory } from '../../../src/audio/voices.ts';
import { DRUM_DEFAULTS, VOICE_IDS } from '../../../src/core/constants.ts';
import { seededRandom } from '../../../src/core/random.ts';
import type { DrumParams, VoiceId } from '../../../src/core/types.ts';
import { fingerprint, type Fingerprint } from '../../support/fingerprint.ts';

/*
 * Dieselben Szenarien wie tests/reference/legacy/scenarios.ts, aber mit der neuen Engine.
 * Zufall je Zweck wie in der Legacy-Harness (seededRandom), damit Rauschen und Reverb übereinstimmen.
 */

const require = createRequire(import.meta.url);
const wa = require('node-web-audio-api') as { OfflineAudioContext: typeof OfflineAudioContext };
export const SR = 44100;
export const createOffline: OfflineFactory = (ch, len, sr) =>
  new wa.OfflineAudioContext(ch, len, sr);

/** Wie Legacy: Rauschpuffer (2 s, Strom 'graph') gehört dem Haupt-Kontext. */
export function sharedNoise(seed: number): AudioBuffer {
  const oc = createOffline(1, SR, SR);
  const b = oc.createBuffer(1, SR * 2, SR);
  b.getChannelData(0).set(noiseData(SR * 2, seededRandom(seed)('graph')));
  return b;
}

export async function drumVariants(args: {
  voice: VoiceId;
  seed?: number;
  variants: Record<string, Partial<DrumParams>>;
}): Promise<Record<string, Fingerprint>> {
  const seed = args.seed ?? 1;
  const random = seededRandom(seed);
  const noise = sharedNoise(seed);
  const kick = softClipCurve(1.6, true);
  const index = VOICE_IDS.indexOf(args.voice);
  const out: Record<string, Fingerprint> = {};
  for (const [name, change] of Object.entries(args.variants)) {
    const buf = await renderVoice({
      createOffline,
      sampleRate: SR,
      voice: args.voice,
      params: { ...DRUM_DEFAULTS[args.voice], ...change },
      noise,
      kick,
      rnd: random(`voice:${index}`),
    });
    out[name] = fingerprint(buf.getChannelData(0), buf.sampleRate);
  }
  return out;
}

export const SCENARIOS: Record<string, (args: never) => Promise<unknown>> = { drumVariants };
