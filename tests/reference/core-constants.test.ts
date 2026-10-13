import { afterAll, describe, expect, it } from 'vitest';
import * as C from '../../src/core/constants.ts';
import { loadLegacy } from './legacy/harness.ts';

const page = loadLegacy();
const L = page.t;
const plain = (v: unknown): unknown => JSON.parse(JSON.stringify(v));

describe('core-Konstanten = Legacy', () => {
  afterAll(() => {
    page.close();
  });
  it.each([
    ['VOICES', C.VOICES, L.VOICES],
    ['DRUM_DEFAULTS', C.DRUM_DEFAULTS, L.DEFAULTS],
    ['PRESETS', C.PRESETS, L.PRESETS],
    ['SLOTS', C.SLOTS, L.SLOTS],
    ['SEED_B', C.SEED_B, L.SEED_B],
    ['SEED_NOTES', C.SEED_NOTES, L.SEED_NOTES],
    ['PARTS', C.PARTS, L.PARTS],
    ['NOTE_NAMES', C.NOTE_NAMES, L.NAMES],
    ['SCALES', C.SCALES, L.SCALES],
    ['WAVES', C.WAVES, L.WAVES],
    ['ROWS', C.ROWS, L.ROWS],
    ['SYN_KEYS', C.SYN_KEYS, L.SYN_KEYS],
    ['SYN_PRESETS', C.SYN_PRESETS, L.SYN_PRESETS],
    ['SMP_RATE', C.SMP_RATE, L.SMP_RATE],
    ['SMP_MAX', C.SMP_MAX, L.SMP_MAX],
    ['PAD_DEFAULT', C.PAD_DEFAULT, L.SMP_DEF],
    ['CHANNELS', C.CHANNELS, L.CHS],
    ['CHANNEL_NAMES', C.CHANNEL_NAMES, L.CH_FULL],
    ['STORAGE_KEY', C.STORAGE_KEY, L.KEY],
    ['SAMPLE_STORAGE_KEY', C.SAMPLE_STORAGE_KEY, L.SMP_KEY],
    ['FACTORY_NAMES', C.FACTORY_NAMES, L.FACTORY.map((f) => f.name)],
  ])('%s', (_, core, legacy) => {
    expect(plain(core)).toEqual(plain(legacy));
  });

  it('PART_NAMES und PART_BASE', () => {
    for (const id of C.PARTS) {
      expect(C.PART_NAMES[id]).toBe(L.PART_INFO[id].name);
      expect(C.PART_BASE[id]).toBe(L.PART_INFO[id].base);
    }
  });
});
