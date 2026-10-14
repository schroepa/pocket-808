import { createRequire } from 'node:module';
import { factorySamples, noiseData, softClipCurve } from '../../../src/audio/dsp.ts';
import { createGraph } from '../../../src/audio/graph.ts';
import { createSampler } from '../../../src/audio/sampler.ts';
import { synthNote } from '../../../src/audio/synth.ts';
import { renderVoice, type OfflineFactory } from '../../../src/audio/voices.ts';
import { CHANNELS, DRUM_DEFAULTS, SYN_PRESETS, VOICE_IDS } from '../../../src/core/constants.ts';
import { initialState } from '../../../src/core/initial.ts';
import { audibleChannels } from '../../../src/core/mix.ts';
import { seededRandom } from '../../../src/core/random.ts';
import type { DrumParams, Part, State, VoiceId } from '../../../src/core/types.ts';
import { must } from '../../../src/core/util.ts';
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

export interface StereoPrint {
  L: Fingerprint;
  R: Fingerprint;
}

export async function renderStereo(ctx: OfflineAudioContext): Promise<StereoPrint> {
  const buf = await ctx.startRendering();
  const right = buf.numberOfChannels > 1 ? 1 : 0;
  return {
    L: fingerprint(buf.getChannelData(0), buf.sampleRate),
    R: fingerprint(buf.getChannelData(right), buf.sampleRate),
  };
}

/** Wie das Legacy-Szenario: Zustand nach init, angepasst, Graph bei currentTime 0 aufgebaut. */
function graphFor(s: State, seconds: number, seed: number) {
  const ctx = createOffline(2, Math.ceil(seconds * SR), SR);
  const graph = createGraph(ctx, s, audibleChannels(s.mix), seededRandom(seed));
  return { ctx, graph };
}

export async function synthPreset(args: {
  part: Part;
  preset: string;
  midi: number;
  seed?: number;
}): Promise<StereoPrint> {
  const s = structuredClone(initialState());
  const preset = must(
    SYN_PRESETS[args.part].find((x) => x.name === args.preset),
    args.preset,
  );
  s.tempo = 120;
  Object.assign(s.synth[args.part], preset.v);
  for (const id of CHANNELS) s.mix[id].r = 0;
  const { ctx, graph } = graphFor(s, 2, args.seed ?? 1);
  synthNote({
    ctx,
    dest: graph.parts[args.part].inp,
    patch: s.synth[args.part],
    midi: args.midi,
    time: 0.1,
    duration: 0.5,
    previous: undefined,
  });
  return renderStereo(ctx);
}

export async function samplerPad(args: { pad: number; seed?: number }): Promise<StereoPrint> {
  const seed = args.seed ?? 1;
  const s = structuredClone(initialState());
  s.mix.SM.r = 0;
  const { ctx, graph } = graphFor(s, 2, seed);
  const sampler = createSampler(ctx, factorySamples(seededRandom(seed)('factory')));
  sampler.play(args.pad, 0.1, must(s.smp.pads[args.pad], `Pad ${args.pad}`), graph.chan.SM.in);
  return renderStereo(ctx);
}

export const SCENARIOS: Record<string, (args: never) => Promise<unknown>> = {
  drumVariants,
  synthPreset,
  samplerPad,
};
