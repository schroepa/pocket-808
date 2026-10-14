import { initialState } from './initial.ts';
import { loadState, parseStored } from './persist.ts';
import { applySampleStore, parseSampleStore } from './samples.ts';

/**
 * Startzustand wie Legacy init(): Startzustand → gespeicherter Zustand → Host-Zustand
 * (window.claude.hot, `data.state`) → Sample-Speicher.
 */
export function bootState(
  stored: string | null,
  sampleStore: string | null,
  factoryPcm: readonly (Float32Array | null)[],
  host?: unknown,
): ReturnType<typeof applySampleStore> {
  const state = loadState(host, loadState(parseStored(stored), initialState()));
  return applySampleStore(state, parseSampleStore(sampleStore), factoryPcm);
}
