import { PART_NAMES } from '../../../core/constants.ts';
import type { Part } from '../../../core/types.ts';

export const partName = (p: Part): string => PART_NAMES[p];

/** Zeitangabe wie Legacy fmtT */
export const fmtTime = (sec: number): string =>
  sec < 1 ? `${Math.round(sec * 1000)} ms` : `${sec.toFixed(2)} s`;
