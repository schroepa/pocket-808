import type { PartFx } from '../core/types.ts';
import { softClipCurve } from './dsp.ts';
import { rampFrom } from './params.ts';

/*
 * Effekte eines Synth-Parts (Etappe 10a), zwischen Eingang und Pegel:
 * Eingang → (trocken | Vorverstärkung → Sättigung → Ausgleich) → Mitte → Summe → Ausgang
 * Mitte → Hochpass → zwei modulierte Verzögerungen (links, rechts) → Chorus-Anteil → Summe
 * Die Summe ist immer stereo (links = rechts beim trockenen Signal) mit Pegel 1, damit Delay und
 * Reverb unverändert bleiben. Nur der Panner verteilt Stereo anders als Mono; das gleicht der
 * Graph direkt davor aus (`stereoTrim`).
 * Alles entsteht erst bei Bedarf; die LFOs laufen nur, solange Chorus > 0 ist.
 */

export interface PartFxChain {
  /** t = null: Werte direkt setzen (Aufbau), sonst weich ab t */
  set(fx: PartFx, t: number | null): void;
  /** beide Effekte aus: die Kette darf nach der Blende weg */
  readonly idle: boolean;
  /** abbauen und den direkten Weg wiederherstellen */
  dispose(): void;
}

/**
 * Pegel vor dem Panner, solange die Kette stereo speist: Für gleiche Seiten ergibt er bei jedem
 * Panorama p (−1..1) exakt dieselben Ausgänge wie der Mono-Weg.
 */
export const stereoTrim = (p: number): number =>
  1 / (2 * Math.cos(((1 - Math.abs(p)) * Math.PI) / 4));

const FADE = 0.03;
/** Verstärkung in die Sättigung: 1 (kaum hörbar) bis 1 + DRIVE_RANGE */
const DRIVE_RANGE = 5;
/** Aussteuerbereich der Kennlinie: Eingänge bis ±CURVE_SPAN werden erfasst */
const CURVE_SPAN = 4;
const CURVE = softClipCurve(CURVE_SPAN, false);
/** Pegelausgleich hinter der Sättigung: DRIVE_MAKEUP / Verstärkung^DRIVE_FALL */
const DRIVE_MAKEUP = 0.85;
const DRIVE_FALL = 0.62;
/** Chorus: tiefe Anteile bleiben außen vor und damit mittig */
const CHORUS_HP = 250;
const CHORUS_LEVEL = 0.65;
const CHORUS_DEPTH = 0.003;
/** je Seite: Grundverzögerung (s), Rate (Hz), Panorama */
const CHORUS_VOICES = [
  [0.012, 0.6, -1],
  [0.017, 0.83, 1],
] as const;

/** Pegel mit bekanntem Verlauf: der Anker der nächsten Rampe stimmt auch mitten in einer Blende */
function level(g: GainNode, start: number): (to: number, t: number | null) => void {
  let from = start;
  let to = start;
  let t0 = 0;
  g.gain.value = start;
  return (next, t) => {
    if (t === null) {
      g.gain.value = next;
      from = to = next;
      return;
    }
    if (next === to) return;
    const now = from + (to - from) * Math.min(1, Math.max(0, (t - t0) / FADE));
    rampFrom(g.gain, now, next, t, FADE);
    from = now;
    to = next;
    t0 = t;
  };
}

export function createPartFx(
  ctx: BaseAudioContext,
  input: AudioNode,
  output: AudioNode,
): PartFxChain {
  const gain = (v: number): [GainNode, ReturnType<typeof level>] => {
    const g = ctx.createGain();
    return [g, level(g, v)];
  };
  const [mid] = gain(1);
  const [sum] = gain(1);
  sum.channelCount = 2;
  sum.channelCountMode = 'explicit';
  const [dry, setDry] = gain(1);
  input.connect(dry);
  dry.connect(mid);
  mid.connect(sum);
  sum.connect(output);
  input.disconnect(output);

  interface Drive {
    nodes: AudioNode[];
    pre: ReturnType<typeof level>;
    post: ReturnType<typeof level>;
  }
  let drive: Drive | null = null;
  const makeDrive = (): Drive => {
    const [pre, setPre] = gain(1 / CURVE_SPAN);
    const shaper = ctx.createWaveShaper();
    shaper.curve = CURVE as Float32Array<ArrayBuffer>;
    shaper.oversample = '2x';
    const [post, setPost] = gain(0);
    input.connect(pre);
    pre.connect(shaper);
    shaper.connect(post);
    post.connect(mid);
    return { nodes: [pre, shaper, post], pre: setPre, post: setPost };
  };

  interface Chorus {
    set: ReturnType<typeof level>;
    stop(at: number): void;
  }
  let chorus: Chorus | null = null;
  const makeChorus = (t: number | null): Chorus => {
    const start = t ?? ctx.currentTime;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = CHORUS_HP;
    const [wet, setWet] = gain(0);
    mid.connect(hp);
    wet.connect(sum);
    const voices = CHORUS_VOICES.map(([base, rate, side]) => {
      const dly = ctx.createDelay(0.05);
      dly.delayTime.value = base;
      const pan = ctx.createStereoPanner();
      pan.pan.value = side;
      const osc = ctx.createOscillator();
      osc.frequency.value = rate;
      const depth = ctx.createGain();
      depth.gain.value = CHORUS_DEPTH;
      osc.connect(depth);
      depth.connect(dly.delayTime);
      hp.connect(dly);
      dly.connect(pan);
      pan.connect(wet);
      osc.start(start);
      return { osc, nodes: [dly, pan, depth] };
    });
    return {
      set: setWet,
      stop(at) {
        for (const v of voices) {
          v.osc.addEventListener('ended', () => {
            for (const n of [...v.nodes, hp, wet]) n.disconnect();
            try {
              mid.disconnect(hp);
            } catch {
              /* Kette schon abgebaut */
            }
          });
          v.osc.stop(at);
        }
      },
    };
  };

  let idle = true;
  return {
    get idle() {
      return idle;
    },
    set(fx, t) {
      const d = fx.drive ?? 0;
      const c = fx.chorus ?? 0;
      idle = d <= 0 && c <= 0;
      if (d > 0) {
        drive ??= makeDrive();
        const g = 1 + d * DRIVE_RANGE;
        drive.pre(g / CURVE_SPAN, t);
        drive.post(DRIVE_MAKEUP / Math.pow(g, DRIVE_FALL), t);
        setDry(0, t);
      } else {
        drive?.post(0, t);
        setDry(1, t);
      }
      if (c > 0) {
        chorus ??= makeChorus(t);
        chorus.set(c * CHORUS_LEVEL, t);
      } else if (chorus) {
        const at = t ?? ctx.currentTime;
        chorus.set(0, at);
        chorus.stop(at + FADE + 0.02);
        chorus = null;
      }
    },
    dispose() {
      chorus?.stop(ctx.currentTime);
      chorus = null;
      input.connect(output);
      for (const n of [dry, ...(drive?.nodes ?? [])]) {
        try {
          input.disconnect(n);
        } catch {
          /* nicht verbunden */
        }
        n.disconnect();
      }
      mid.disconnect();
      sum.disconnect();
      drive = null;
    },
  };
}
