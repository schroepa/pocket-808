import { PAD_COUNT, VOICE_IDS } from './constants.ts';
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
