import { NOTE_NAMES, PART_NAMES, SCALES } from '../../../core/constants.ts';
import { currentPattern } from '../../../core/pattern.ts';
import type { Part, State } from '../../../core/types.ts';
import { must } from '../../../core/util.ts';

export const partName = (p: Part): string => PART_NAMES[p];

/** Zeitangabe wie Legacy fmtT */
export const fmtTime = (sec: number): string =>
  sec < 1 ? `${Math.round(sec * 1000)} ms` : `${sec.toFixed(2)} s`;

/** Zusammenfassung im Gerätekopf (Legacy renderSum) */
export function synthSummary(s: State): string {
  const n = currentPattern(s).notes[s.part].filter(Boolean).length;
  const key = must(NOTE_NAMES[s.key], 'Tonart');
  const scale = must(SCALES[s.scale], 'Skala').name;
  const mute = s.mix[s.part].m ? ' · stumm' : '';
  const arp = s.synth[s.part].arp ? ' · Arp' : '';
  return `${partName(s.part)} · ${key} ${scale} · ${n} ${n === 1 ? 'Note' : 'Noten'}${mute}${arp}`;
}
