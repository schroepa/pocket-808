import { magnitudeSpectrum } from './fft.ts';

/** Kompakte, vergleichbare Beschreibung eines gerenderten Klangs. */
export interface Fingerprint {
  sampleRate: number;
  length: number;
  peak: number;
  /** Anzahl NaN/Infinity-Samples. Muss 0 sein. */
  nonFinite: number;
  /** RMS je 10-ms-Fenster in dBFS, Stille = SILENCE_DB */
  rmsDb: number[];
  /** energiegewichteter spektraler Schwerpunkt in Hz */
  centroidHz: number;
  /** Schwerpunkt nur unter 2 kHz: erfasst Tonhöhen auch unter lautem Rauschen (z. B. Snare) */
  lowCentroidHz: number;
}

export interface Tolerance {
  /** erlaubte relative Abweichung der Spitze */
  peakRel: number;
  /** nur Fenster vergleichen, die höchstens so viele dB unter dem lautesten liegen (negativ) */
  rmsFloorDb: number;
  /** erlaubte mittlere Abweichung der verglichenen Fenster in dB */
  rmsMeanDb: number;
  /** erlaubte größte Abweichung eines Fensters in dB */
  rmsMaxDb: number;
  /** erlaubte relative Abweichung des Schwerpunkts */
  centroidRel: number;
  /** erlaubte relative Abweichung des Schwerpunkts unter 2 kHz */
  lowCentroidRel: number;
}

export const SILENCE_DB = -180;
const WINDOW_S = 0.01;
const FRAME = 2048;
const LOW_HZ = 2000;
const round = (v: number, digits: number) => Math.round(v * 10 ** digits) / 10 ** digits;
const HANN = Float64Array.from(
  { length: FRAME },
  (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (FRAME - 1)),
);

function spectralCentroids(samples: Float32Array, sampleRate: number): [all: number, low: number] {
  let num = 0;
  let den = 0;
  let lowNum = 0;
  let lowDen = 0;
  const frame = new Float64Array(FRAME);
  for (let start = 0; start < samples.length; start += FRAME) {
    for (let i = 0; i < FRAME; i++) {
      const x = samples[start + i] ?? 0;
      frame[i] = Number.isFinite(x) ? x * HANN[i]! : 0;
    }
    const mag = magnitudeSpectrum(frame);
    for (let k = 1; k < mag.length; k++) {
      const power = mag[k]! * mag[k]!;
      const hz = (k * sampleRate) / FRAME;
      num += hz * power;
      den += power;
      if (hz < LOW_HZ) {
        lowNum += hz * power;
        lowDen += power;
      }
    }
  }
  return [den > 0 ? num / den : 0, lowDen > 0 ? lowNum / lowDen : 0];
}

export function fingerprint(samples: Float32Array, sampleRate: number): Fingerprint {
  let peak = 0;
  let nonFinite = 0;
  for (const x of samples) {
    if (!Number.isFinite(x)) nonFinite++;
    else if (Math.abs(x) > peak) peak = Math.abs(x);
  }
  const win = Math.round(sampleRate * WINDOW_S);
  const rmsDb: number[] = [];
  for (let i = 0; i < samples.length; i += win) {
    const end = Math.min(samples.length, i + win);
    let sum = 0;
    for (let k = i; k < end; k++) {
      const x = samples[k]!;
      if (Number.isFinite(x)) sum += x * x;
    }
    const rms = Math.sqrt(sum / (end - i));
    rmsDb.push(rms > 0 ? round(20 * Math.log10(rms), 2) : SILENCE_DB);
  }
  const [centroid, lowCentroid] = spectralCentroids(samples, sampleRate);
  return {
    sampleRate,
    length: samples.length,
    peak: round(peak, 5),
    nonFinite,
    rmsDb,
    centroidHz: round(centroid, 1),
    lowCentroidHz: round(lowCentroid, 1),
  };
}

const pct = (v: number) => `${(v * 100).toFixed(1)} %`;

export function compareFingerprints(
  expected: Fingerprint,
  actual: Fingerprint,
  tol: Tolerance,
): string[] {
  const problems: string[] = [];
  if (actual.nonFinite > 0) problems.push(`${actual.nonFinite} ungültige Samples (NaN/Infinity)`);
  if (expected.sampleRate !== actual.sampleRate || expected.length !== actual.length) {
    problems.push(
      `Länge/Rate weicht ab: ${expected.length}@${expected.sampleRate} → ${actual.length}@${actual.sampleRate}`,
    );
    return problems;
  }
  const peakDiff = Math.abs(actual.peak - expected.peak) / Math.max(expected.peak, 1e-6);
  if (peakDiff > tol.peakRel) {
    problems.push(`Spitze ${expected.peak} → ${actual.peak} (${pct(peakDiff)})`);
  }
  // Schwelle aus der Referenz, verglichen werden Fenster, die in Referenz ODER Ist laut sind:
  // so fällt auch zusätzlicher Klang in einer sonst stillen Stelle auf
  const floor = Math.max(...expected.rmsDb) + tol.rmsFloorDb;
  const diffs = expected.rmsDb.flatMap((e, i) => {
    const a = actual.rmsDb[i] ?? SILENCE_DB;
    return Math.max(e, a) >= floor ? [Math.abs(a - e)] : [];
  });
  const mean = diffs.length ? diffs.reduce((a, b) => a + b, 0) / diffs.length : 0;
  const max = Math.max(0, ...diffs);
  if (mean > tol.rmsMeanDb || max > tol.rmsMaxDb) {
    problems.push(`RMS-Verlauf weicht ab: Mittel ${mean.toFixed(2)} dB, Max ${max.toFixed(2)} dB`);
  }
  const cDiff =
    Math.abs(actual.centroidHz - expected.centroidHz) / Math.max(expected.centroidHz, 1);
  if (cDiff > tol.centroidRel) {
    problems.push(
      `Schwerpunkt ${expected.centroidHz} Hz → ${actual.centroidHz} Hz (${pct(cDiff)})`,
    );
  }
  const lDiff =
    Math.abs(actual.lowCentroidHz - expected.lowCentroidHz) / Math.max(expected.lowCentroidHz, 1);
  if (lDiff > tol.lowCentroidRel) {
    problems.push(
      `Schwerpunkt <2 kHz ${expected.lowCentroidHz} Hz → ${actual.lowCentroidHz} Hz (${pct(lDiff)})`,
    );
  }
  return problems;
}
