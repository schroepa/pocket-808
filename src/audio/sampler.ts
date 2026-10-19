import { PAD_COUNT, SMP_RATE } from '../core/constants.ts';
import type { Pad } from '../core/types.ts';

/* Sampler-Pads wie Legacy smpPlay: Ausschnitt, Tune, Attack/Decay, Reverse; pro Pad klingt ein Treffer. */

export interface Sampler {
  setPcm(pad: number, pcm: Float32Array | null): void;
  has(pad: number): boolean;
  play(pad: number, time: number, params: Pad, dest: AudioNode): void;
}

interface Playing {
  src: AudioBufferSourceNode;
  g: GainNode;
  v: number;
  /** Start und Ende der Stimme: das Abschneiden betrifft nur, was schon begonnen hat */
  t0: number;
  end: number;
}

export function createSampler(
  ctx: BaseAudioContext,
  initial: readonly (Float32Array | null)[],
): Sampler {
  const pcm = Array.from({ length: PAD_COUNT }, (_, i) => initial[i] ?? null);
  const fwd = new Array<AudioBuffer | null>(PAD_COUNT).fill(null);
  const rev = new Array<AudioBuffer | null>(PAD_COUNT).fill(null);
  const last = Array.from({ length: PAD_COUNT }, (): Playing[] => []);

  const bufferFor = (i: number, data: Float32Array, reversed: boolean): AudioBuffer => {
    const cache = reversed ? rev : fwd;
    const cached = cache[i];
    if (cached) return cached;
    const b = ctx.createBuffer(1, data.length, SMP_RATE);
    const d = b.getChannelData(0);
    if (reversed) data.forEach((x, k) => (d[data.length - 1 - k] = x));
    else d.set(data);
    cache[i] = b;
    return b;
  };
  /**
   * Stimmen des Pads abschneiden, die bei `t` schon klingen. Schon geplante spätere Treffer
   * (Vorlauf des Schedulers, Vorhören und Tastatur beim Spielen) bleiben stehen.
   */
  const steal = (i: number, t: number): void => {
    const keep: Playing[] = [];
    for (const l of last[i] ?? []) {
      if (l.end < t) continue;
      if (l.t0 >= t) {
        keep.push(l);
        continue;
      }
      try {
        l.g.gain.setValueAtTime(l.v, t);
        l.g.gain.linearRampToValueAtTime(0, t + 0.006);
        l.src.stop(t + 0.008);
      } catch {
        /* schon gestoppt */
      }
    }
    last[i] = keep;
  };

  return {
    setPcm(i, data) {
      pcm[i] = data;
      fwd[i] = null;
      rev[i] = null;
    },
    has: (i) => !!pcm[i],
    play(i, t, p, dest) {
      const data = pcm[i];
      if (!data) return;
      const buf = bufferFor(i, data, p.rev);
      const len = buf.duration;
      const s0 = (p.rev ? 1 - p.end : p.start) * len;
      const s1 = Math.max(s0 + 0.02, (p.rev ? 1 - p.start : p.end) * len);
      const rate = Math.pow(2, (p.tune - 0.5) * 2);
      const play = Math.max(0.04, ((s1 - s0) / rate) * (0.08 + 0.92 * p.dec * p.dec));
      const atk = Math.min(0.002 + p.att * 0.3, play * 0.5);
      const fade = Math.min(play - atk, p.dec < 1 ? play * 0.8 : 0.012);
      steal(i, t);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = rate;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(1, t + atk);
      g.gain.setValueAtTime(1, t + play - fade);
      g.gain.exponentialRampToValueAtTime(0.0001, t + play);
      const v = p.lvl * p.lvl * 1.2;
      const out = ctx.createGain();
      out.gain.value = v;
      src.connect(g);
      g.connect(out);
      out.connect(dest);
      src.start(t, s0);
      src.stop(t + play + 0.02);
      last[i]?.push({ src, g: out, v, t0: t, end: t + play + 0.02 });
    },
  };
}
