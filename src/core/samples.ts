import { PAD_COUNT, SMP_MAX, SMP_RATE, VOICE_IDS } from './constants.ts';
import type { State, VoiceId } from './types.ts';

export interface DrumSample {
  pcm: Float32Array;
  name: string;
}

type Store = Record<string, unknown>;

/** Float-PCM → 16-Bit-Little-Endian → Base64 (Format von 'pocket808.smp.v1'). */
export function encodePcm(pcm: Float32Array): string {
  const ints = new Int16Array(pcm.length);
  for (const [i, x] of pcm.entries()) ints[i] = Math.max(-1, Math.min(1, x)) * 32767;
  const bytes = new Uint8Array(ints.buffer);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 8192) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return btoa(bin);
}

/** Base64 → Float-PCM. Wirft bei ungültigem Base64. */
export function decodePcm(b64: string): Float32Array {
  const bin = atob(b64);
  const out = new Float32Array(bin.length >> 1);
  for (let i = 0; i < out.length; i++) {
    out[i] = (((bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8)) << 16) >> 16) / 32767;
  }
  return out;
}

export function parseSampleStore(raw: string | null): Store {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw) as unknown;
    return typeof v === 'object' && v !== null ? (v as Store) : {};
  } catch {
    return {};
  }
}

const field = (e: unknown, key: string): unknown =>
  typeof e === 'object' && e !== null ? (e as Store)[key] : undefined;

/** Ungültiges Base64 wird wie in Legacy stillschweigend übergangen. */
function tryDecode(d: string): Float32Array | undefined {
  try {
    return decodePcm(d);
  } catch {
    return undefined;
  }
}

/**
 * Wendet den Sample-Speicher an (Legacy applySmpStore): eigene Pad-Samples, geleerte Pads,
 * eigene Drum-Samples. Pads ohne Sample verlieren ihren Namen.
 */
export function applySampleStore(
  state: State,
  store: Store,
  pcm: readonly (Float32Array | null)[],
): { state: State; pads: (Float32Array | null)[]; drums: Partial<Record<VoiceId, DrumSample>> } {
  const pads = Array.from({ length: PAD_COUNT }, (_, i) => pcm[i] ?? null);
  const drums: Partial<Record<VoiceId, DrumSample>> = {};
  for (const [k, e] of Object.entries(store)) {
    const d = field(e, 'd');
    if (typeof d !== 'string') continue;
    if (k.startsWith('D:')) {
      const id = k.slice(2) as VoiceId;
      const decoded = VOICE_IDS.includes(id) && d ? tryDecode(d) : undefined;
      if (decoded) {
        const n = field(e, 'n');
        drums[id] = { pcm: decoded, name: typeof n === 'string' ? n : 'Sample' };
      }
      continue;
    }
    const i = Number(k);
    if (!Number.isInteger(i) || i < 0 || i >= PAD_COUNT) continue;
    if (d === '') pads[i] = null;
    else pads[i] = tryDecode(d) ?? pads[i] ?? null;
  }
  const changed = state.smp.pads.some((p, i) => !pads[i] && p.name !== '');
  const out = changed
    ? {
        ...state,
        smp: {
          ...state.smp,
          pads: state.smp.pads.map((p, i) => (pads[i] ? p : { ...p, name: '' })),
        },
      }
    : state;
  return { state: out, pads, drums };
}

/**
 * Dekodiertes Audio → Sample-Format (Legacy toPcm): mono gemischt, auf SMP_MAX Sekunden gekürzt,
 * per Mittelwert auf SMP_RATE umgerechnet und auf Spitze 0,9 normalisiert. Rechnet wie Legacy in Float32.
 */
export function toPcm(channels: readonly Float32Array[], sampleRate: number): Float32Array {
  const n = Math.min(channels[0]?.length ?? 0, Math.floor(sampleRate * SMP_MAX));
  const mono = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let v = 0;
    for (const d of channels) v = Math.fround(v + (d[i] ?? 0) / channels.length);
    mono[i] = v;
  }
  const r = sampleRate / SMP_RATE;
  const m = Math.max(1, Math.floor(n / r));
  const out = new Float32Array(m);
  let peak = 0;
  for (let i = 0; i < m; i++) {
    const j = Math.floor(i * r);
    const e = Math.min(n, Math.max(j + 1, Math.floor((i + 1) * r)));
    let sum = 0;
    for (const x of mono.subarray(j, e)) sum += x;
    const v = Math.fround(sum / Math.max(1, e - j));
    out[i] = v;
    peak = Math.max(peak, Math.abs(v));
  }
  const g = peak > 0.0001 ? 0.9 / peak : 1;
  return out.map((x) => x * g);
}

/** Stille am Anfang abschneiden (Schwelle 0,02), 40 Samples Vorlauf bleiben (Legacy loadDrumSample). */
export function trimLeadingSilence(pcm: Float32Array): Float32Array {
  const a = pcm.findIndex((x) => Math.abs(x) >= 0.02);
  return pcm.subarray(Math.max(0, (a < 0 ? pcm.length : a) - 40));
}

/** Letzte n Samples linear auf 0 ausblenden (gegen Knacken am Ende, z. B. nach dem Bounce). */
export function fadeOut(pcm: Float32Array, n: number): Float32Array {
  const out = pcm.slice();
  const m = Math.min(n, out.length);
  for (let k = 0; k < m; k++) {
    const i = out.length - m + k;
    out[i] = Number(out[i]) * ((m - 1 - k) / m);
  }
  return out;
}
