import { SMP_RATE, VOICE_IDS } from '../core/constants.ts';
import type { Rng } from '../core/random.ts';
import type { DrumSample } from '../core/samples.ts';
import type { DrumParams, VoiceId } from '../core/types.ts';
import type { Graph } from './graph.ts';
import type { EngineTimer } from './timer.ts';
import { RENDER_ORDER, renderVoice, VOICE_FN, type OfflineFactory } from './voices.ts';

/*
 * Drum-Bank wie Legacy: Stimmen einmal offline vorrendern und nur als Buffer abspielen (zwei Knoten
 * pro Treffer). Pro Spur klingt ein Treffer, ein neuer schneidet den alten kurz ab; CH würgt OH ab.
 */

interface Playing {
  src: AudioBufferSourceNode;
  g: GainNode;
  v: number;
}

export interface DrumBank {
  prerenderAll(): Promise<void>;
  /** Tune/Decay geändert: entprellt (90 ms) neu rendern */
  rerender(voice: VoiceId): void;
  ready(voice: VoiceId): boolean;
  setSample(voice: VoiceId, sample: DrumSample | null): void;
  hit(voice: VoiceId, time: number, params: DrumParams): void;
  /** Zeitgeber löschen, ausstehende Renderaufträge verwerfen */
  dispose(): void;
}

export function createDrumBank(o: {
  graph: Graph;
  createOffline: OfflineFactory;
  random: (tag: string) => Rng;
  timer: EngineTimer;
  params: () => Record<VoiceId, DrumParams>;
  samples?: ReadonlyMap<VoiceId, DrumSample>;
}): DrumBank {
  const { graph, timer } = o;
  const ctx = graph.ctx;
  const buffers: Partial<Record<VoiceId, AudioBuffer>> = {};
  const tokens: Partial<Record<VoiceId, number>> = {};
  const rerenderTimers: Partial<Record<VoiceId, unknown>> = {};
  const samples = new Map(o.samples);
  const sampleBuffers = new Map<VoiceId, AudioBuffer>();
  const last = new Map<VoiceId, Playing>();
  const choke = { gain: null as GainNode | null };
  // Eine Warteschlange für alle Offline-Renderings: nie zwei gleichzeitig (iPhone)
  let renders: Promise<void> = Promise.resolve();
  let prerendering: Promise<void> | null = null;
  let disposed = false;

  const render = async (voice: VoiceId): Promise<void> => {
    const tok = (tokens[voice] ?? 0) + 1;
    tokens[voice] = tok;
    try {
      const buf = await renderVoice({
        createOffline: o.createOffline,
        sampleRate: ctx.sampleRate,
        voice,
        params: o.params()[voice],
        noise: graph.noise,
        kick: graph.kick,
        rnd: o.random(`voice:${VOICE_IDS.indexOf(voice)}`),
      });
      if (tokens[voice] === tok) buffers[voice] = buf;
    } catch {
      /* Rückfall: Live-Synthese (wie Legacy) */
    }
  };
  const pause = (ms: number): Promise<void> =>
    new Promise((resolve) => {
      timer.setTimeout(resolve, ms);
    });
  const enqueue = (job: () => Promise<void>): Promise<void> => {
    // ein fehlgeschlagener Auftrag darf die Warteschlange nicht dauerhaft blockieren
    renders = renders.then(() => (disposed ? undefined : job())).catch(() => undefined);
    return renders;
  };
  const steal = (voice: VoiceId, t: number): void => {
    const l = last.get(voice);
    if (!l) return;
    try {
      l.g.gain.setValueAtTime(l.v, t);
      l.g.gain.linearRampToValueAtTime(0, t + 0.006);
      l.src.stop(t + 0.008);
    } catch {
      /* schon gestoppt */
    }
    last.delete(voice);
  };
  const sampleBuffer = (voice: VoiceId, s: DrumSample): AudioBuffer => {
    const cached = sampleBuffers.get(voice);
    if (cached) return cached;
    const b = ctx.createBuffer(1, s.pcm.length, SMP_RATE);
    b.getChannelData(0).set(s.pcm);
    sampleBuffers.set(voice, b);
    return b;
  };
  /** Eigenes Sample statt des synthetischen Klangs: Level, Tune und Decay der Spur gelten weiter. */
  const playSample = (voice: VoiceId, s: DrumSample, t: number, p: DrumParams): void => {
    const buf = sampleBuffer(voice, s);
    const rate = Math.pow(2, (p.tune - 0.5) * 2);
    const frac = Math.min(1, 0.2 + p.decay * 1.6);
    const play = Math.max(0.04, (buf.duration / rate) * frac);
    const fade = Math.min(play * 0.5, 0.04);
    steal(voice, t);
    if (voice === 'CH') steal('OH', t);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(1, t + 0.002);
    g.gain.setValueAtTime(1, t + play - fade);
    g.gain.exponentialRampToValueAtTime(0.0001, t + play);
    const v = p.level * 1.15;
    const out = ctx.createGain();
    out.gain.value = v;
    src.connect(g);
    g.connect(out);
    out.connect(graph.chan[voice].in);
    src.start(t);
    src.stop(t + play + 0.02);
    last.set(voice, { src, g: out, v });
  };

  return {
    prerenderAll() {
      // nacheinander statt alle gleichzeitig; dazwischen kurz Luft für Audio-Thread und UI
      prerendering ??= Promise.all(
        RENDER_ORDER.map((voice) =>
          enqueue(async () => {
            await render(voice);
            await pause(25);
          }),
        ),
      ).then(() => undefined);
      return prerendering;
    },
    rerender(voice) {
      timer.clearTimeout(rerenderTimers[voice]);
      rerenderTimers[voice] = timer.setTimeout(() => void enqueue(() => render(voice)), 90);
    },
    ready: (voice) => !!buffers[voice],
    setSample(voice, s) {
      if (s) samples.set(voice, s);
      else samples.delete(voice);
      sampleBuffers.delete(voice);
    },
    hit(voice, t, p) {
      const custom = samples.get(voice);
      if (custom) {
        playSample(voice, custom, t, p);
        return;
      }
      const dest = graph.chan[voice].in;
      const buf = buffers[voice];
      if (!buf) {
        // noch nicht vorgerendert: live synthetisieren (Legacy-Rückfall). Abwürgen und Stehlen
        // greifen dabei nur unter Live-Stimmen (choke), nicht gegenüber Buffern – wie Legacy.
        VOICE_FN[voice](
          { ctx, out: dest, noise: graph.noise, kick: graph.kick, rnd: Math.random, choke },
          t,
          p,
        );
        return;
      }
      steal(voice, t);
      if (voice === 'CH') steal('OH', t);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const g = ctx.createGain();
      g.gain.value = p.level;
      src.connect(g);
      g.connect(dest);
      src.start(t, 0);
      last.set(voice, { src, g, v: p.level });
    },
    dispose() {
      disposed = true;
      for (const id of VOICE_IDS) timer.clearTimeout(rerenderTimers[id]);
    },
  };
}
