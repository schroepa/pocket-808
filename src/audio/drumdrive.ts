import { softClipCurve } from './dsp.ts';
import { level } from './partfx.ts';

/*
 * Drum Drive: eine gemeinsame Verzerrung für die Drum-Summe, zwischen Panorama und Bus:
 * Drum-Panner → Summe → (trocken | Vorverstärkung → Sättigung → Ausgleich) → Bus
 * Alles entsteht erst bei Bedarf, einmal für alle Drums; bei 0 baut der Graph die Kette ab.
 */

export interface DrumDrive {
  /** t = null: Werte direkt setzen (Aufbau), sonst weich ab t */
  set(v: number, t: number | null): void;
  /** aus: die Kette darf nach der Blende weg */
  readonly idle: boolean;
  /** abbauen und den direkten Weg wiederherstellen */
  dispose(): void;
}

/** Verstärkung in die Sättigung: 1 (kaum hörbar) bis 1 + RANGE */
const RANGE = 50;
/** Aussteuerbereich der Kennlinie: Eingänge bis ±CURVE_SPAN werden erfasst */
const CURVE_SPAN = 4;
const CURVE = softClipCurve(CURVE_SPAN, false);
/** Arbeitspunkt: Pegel in die Sättigung bei Verstärkung 1 */
const INPUT = 0.7;
/**
 * Pegelausgleich hinter der Sättigung am Bezugspegel (etwa der Effektivwert der Drum-Summe): Ein
 * Signal dieser Höhe verlässt die Kette bei jeder Reglerstellung unverändert, so bleibt die
 * Lautheit über den Regelweg etwa gleich.
 */
const REF = 0.13;
const makeup = (g: number): number => REF / Math.tanh(INPUT * g * REF);

export function createDrumDrive(
  ctx: BaseAudioContext,
  sources: readonly AudioNode[],
  output: AudioNode,
): DrumDrive {
  const gain = (v: number): [GainNode, ReturnType<typeof level>] => {
    const g = ctx.createGain();
    return [g, level(g, v)];
  };
  const [sum] = gain(1);
  const [dry, setDry] = gain(1);
  const [pre, setPre] = gain(INPUT / CURVE_SPAN);
  const shaper = ctx.createWaveShaper();
  shaper.curve = CURVE as Float32Array<ArrayBuffer>;
  shaper.oversample = '2x';
  const [post, setPost] = gain(0);
  sum.connect(dry);
  dry.connect(output);
  sum.connect(pre);
  pre.connect(shaper);
  shaper.connect(post);
  post.connect(output);
  for (const s of sources) {
    s.connect(sum);
    s.disconnect(output);
  }

  let idle = true;
  return {
    get idle() {
      return idle;
    },
    set(v, t) {
      idle = v <= 0;
      if (idle) {
        setPost(0, t);
        setDry(1, t);
        return;
      }
      const g = 1 + v * RANGE;
      setPre((INPUT * g) / CURVE_SPAN, t);
      setPost(makeup(g), t);
      setDry(0, t);
    },
    dispose() {
      for (const s of sources) {
        s.connect(output);
        s.disconnect(sum);
      }
      for (const n of [sum, dry, pre, shaper, post]) n.disconnect();
    },
  };
}
