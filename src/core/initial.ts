import { FACTORY_NAMES, PARTS, PRESETS, SEED_B, SEED_NOTES, VOICE_IDS } from './constants.ts';
import { baseState, blankPattern, parsePattern } from './defaults.ts';
import { applyPreset } from './presets.ts';
import type { State } from './types.ts';
import { must } from './util.ts';

/** Startzustand der App ohne gespeicherte Daten (Legacy init() vor merge). */
export function initialState(): State {
  const hipHop = must(
    PRESETS.find((p) => p.name === 'Hip-Hop'),
    'Preset Hip-Hop',
  );
  const s = structuredClone(applyPreset(baseState(), hipHop));
  const b = blankPattern();
  for (const id of VOICE_IDS) b[id] = parsePattern(SEED_B[id] ?? '');
  s.patterns.B = b;
  for (const slot of ['A', 'B'] as const) {
    for (const id of PARTS) {
      for (const [step, d, l] of SEED_NOTES[slot][id]) s.patterns[slot].notes[id][step] = { d, l };
    }
  }
  s.song = [
    { p: 'A', n: 3 },
    { p: 'B', n: 1 },
  ];
  FACTORY_NAMES.forEach((name, i) => {
    must(s.smp.pads[i], `Pad ${i}`).name = name;
  });
  must(s.patterns.A.smp[1], 'A Pad 2')[15] = 1;
  must(s.patterns.B.smp[2], 'B Pad 3')[8] = 1;
  return s;
}
