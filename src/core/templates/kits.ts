import type { KitParams } from './types.ts';

/*
 * Drum-Kits: Sätze aus Level, Tune und Decay für die zehn Stimmen. Nicht genannte Werte bleiben
 * beim Standard (DRUM_DEFAULTS).
 */

export const KITS: readonly { name: string; hint: string; v: KitParams }[] = [
  { name: 'Classic', hint: 'die 808 ab Werk', v: {} },
  {
    name: 'Boom',
    hint: 'lange, tiefe Bass Drum',
    v: {
      BD: { tune: 0.35, decay: 0.85 },
      SD: { tune: 0.45, decay: 0.5 },
      CH: { decay: 0.3 },
      OH: { decay: 0.45 },
    },
  },
  {
    name: 'Tight',
    hint: 'kurz und trocken',
    v: {
      BD: { tune: 0.5, decay: 0.3 },
      SD: { tune: 0.55, decay: 0.3 },
      LT: { decay: 0.3 },
      HT: { decay: 0.3 },
      CP: { decay: 0.35 },
      CH: { decay: 0.2 },
      OH: { decay: 0.3 },
      CY: { decay: 0.3 },
    },
  },
  {
    name: 'Lo-Fi',
    hint: 'tief gestimmt, leise Hats',
    v: {
      BD: { level: 0.85, tune: 0.4, decay: 0.45 },
      SD: { level: 0.7, tune: 0.35, decay: 0.35 },
      RS: { level: 0.6, tune: 0.4, decay: 0.4 },
      CP: { level: 0.65, tune: 0.35, decay: 0.4 },
      CH: { level: 0.5, tune: 0.3, decay: 0.25 },
      OH: { level: 0.5, tune: 0.3, decay: 0.35 },
      CY: { level: 0.4, tune: 0.3, decay: 0.4 },
    },
  },
  {
    name: 'Hard',
    hint: 'harte Kick, helle Hats',
    v: {
      BD: { level: 1, tune: 0.55, decay: 0.4 },
      SD: { tune: 0.6, decay: 0.4 },
      RS: { tune: 0.6 },
      CP: { tune: 0.6, decay: 0.4 },
      CH: { tune: 0.7, decay: 0.25 },
      OH: { tune: 0.65, decay: 0.45 },
    },
  },
  {
    name: 'Trap',
    hint: 'tiefe 808, knappe Hats',
    v: {
      BD: { level: 0.95, tune: 0.3, decay: 0.95 },
      SD: { tune: 0.6, decay: 0.35 },
      CP: { tune: 0.55, decay: 0.45 },
      CH: { level: 0.7, tune: 0.75, decay: 0.15 },
      OH: { level: 0.6, tune: 0.7, decay: 0.4 },
    },
  },
];
