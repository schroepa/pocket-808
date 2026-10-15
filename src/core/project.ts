import { APP_VERSION, PAD_COUNT } from './constants.ts';
import { initialState } from './initial.ts';
import { loadState, serialize } from './persist.ts';
import { applySampleStore, encodePcm, type DrumSample } from './samples.ts';
import type { State, VoiceId } from './types.ts';

/** Inhalt einer Projektdatei (.pocket808.json): Zustand plus eigene Samples. */
export interface ProjectData {
  state: State;
  pads: (Float32Array | null)[];
  drums: Partial<Record<VoiceId, DrumSample>>;
}

const FORMAT = 'pocket808';
const VERSION = 1;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Projekt als JSON-Text: Zustand wie im Browserspeicher, Samples im Format von 'pocket808.smp.v1'. */
export function encodeProject(p: ProjectData, saved: Date): string {
  const pads = Object.fromEntries(
    Array.from({ length: PAD_COUNT }, (_, i) => {
      const pcm = p.pads[i];
      return [String(i), pcm ? encodePcm(pcm) : ''];
    }),
  );
  const drums = Object.fromEntries(
    Object.entries(p.drums).map(([id, s]) => [id, { d: encodePcm(s.pcm), n: s.name }]),
  );
  return JSON.stringify({
    format: FORMAT,
    version: VERSION,
    app: APP_VERSION,
    saved: saved.toISOString(),
    state: serialize(p.state),
    samples: { pads, drums },
  });
}

/**
 * Projektdatei lesen. Fremde oder kaputte Dateien liefern { error: 'invalid' }. Der Zustand läuft durch
 * loadState (Grenzen, Migrationen); fehlende Pads gelten als leer, damit keine Werks-Samples zurückkehren.
 */
export function decodeProject(text: string): ProjectData | { error: 'invalid' } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { error: 'invalid' };
  }
  if (
    !isObj(raw) ||
    raw.format !== FORMAT ||
    !Number.isInteger(raw.version) ||
    (raw.version as number) < 1 ||
    !isObj(raw.state)
  ) {
    return { error: 'invalid' };
  }
  const samples = isObj(raw.samples) ? raw.samples : {};
  const pads = isObj(samples.pads) ? samples.pads : {};
  const drums = isObj(samples.drums) ? samples.drums : {};
  const store: Obj = {};
  for (let i = 0; i < PAD_COUNT; i++) {
    const d = pads[String(i)];
    store[String(i)] = { d: typeof d === 'string' ? d : '' };
  }
  for (const [id, e] of Object.entries(drums)) {
    if (isObj(e)) store[`D:${id}`] = e;
  }
  return applySampleStore(loadState(raw.state, initialState()), store, []);
}

const day = (d: Date): string => d.toISOString().slice(0, 10);

export const projectFileName = (d: Date): string => `pocket808-${day(d)}.pocket808.json`;
export { day as fileDay };
