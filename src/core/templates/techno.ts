import type { Template } from './types.ts';

/* Techno: harte Kick, treibende Hats, Bass als Grollen oder Acid-Linie. */

const SONG = [
  ['A', 4],
  ['B', 2],
  ['C', 2],
  ['A', 4],
  ['B', 2],
] as const;
const FOUR = 'x...x...x...x...';
const CLAP = '....x.......x...';
const OFFBEAT = '..x...x...x...x.';
const HATS = 'o-.-o-.-o-.-o-.-';

export const TECHNO: readonly Template[] = [
  {
    id: 'techno-peak',
    name: 'Peak Techno',
    genre: 'techno',
    hint: 'grollender Bass zwischen den Kicks, Moll-Stabs mit Hall',
    tempo: 132,
    swing: 0,
    key: 9,
    scale: 0,
    kit: 'Hard',
    sound: {
      BA: { p: 'Reese', oct: -1, v: { cut: 0.34, ad: 0.3, as: 0.4, ar: 0.12 } },
      LD: { p: 'Stab', oct: -1, v: { dly: 0.55 } },
    },
    mix: {
      LD: { v: 0.6, r: 0.5 },
      CH: { v: 0.6, p: 0.58 },
      OH: { v: 0.7, p: 0.42 },
      CP: { v: 0.7 },
    },
    fx: { size: 0.65, damp: 0.5, ret: 0.5 },
    warm: true,
    tape: 0,
    pat: {
      A: {
        d: { BD: FOUR, CP: CLAP, CH: HATS, OH: OFFBEAT, RS: '......%.......%.' },
        n: { BA: '2:0:1 3:0:1 6:0:1 7:0:1 10:0:1 11:0:1 14:0:1 15:0:1' },
      },
      B: {
        d: {
          BD: FOUR,
          CP: CLAP,
          CH: HATS,
          OH: OFFBEAT,
          CY: '1...............',
          HT: '.............-o.',
        },
        n: {
          BA: '2:0:1 3:0:1 6:0:1 7:0:1 10:0:1 11:0:1 14:1:1 15:1:1',
          LD: '3:0:1T 6:0:1T 11:1:1T 14:0:1T',
        },
      },
      C: {
        d: { CP: CLAP, CH: HATS, OH: OFFBEAT },
        n: { BA: '0:0:16', LD: '0:0:2T 3:0:2T 6:0:2T 11:0:2T 14:0:2T' },
      },
    },
    song: SONG,
  },
  {
    id: 'techno-acid',
    name: 'Acid Techno',
    genre: 'techno',
    hint: 'Sechzehntel-Linie mit Akzent und Slide, phrygisch',
    tempo: 135,
    swing: 0,
    key: 0,
    scale: 3,
    kit: 'Hard',
    sound: {
      BA: { p: 'Acid', v: { res: 0.65, cut: 0.3 } },
      LD: { p: 'Squelch', oct: -1, v: { dly: 0.5 } },
    },
    mix: {
      BA: { v: 0.78 },
      LD: { v: 0.5, r: 0.4, p: 0.6 },
      CH: { v: 0.6, p: 0.58 },
      OH: { v: 0.7 },
    },
    fx: { size: 0.5, ret: 0.45 },
    warm: true,
    tape: 0,
    pat: {
      A: {
        d: { BD: FOUR, CP: CLAP, CH: HATS, OH: OFFBEAT },
        n: {
          BA: '0:0:1a 1:0:1 2:7:1s 3:0:1 4:0:1 6:3:1a 7:0:1 8:0:1 10:1:1s 11:0:1a 12:0:1 13:7:1 14:6:2s',
          LD: '4:7:1 12:8:1',
        },
      },
      B: {
        d: { BD: FOUR, CP: CLAP, CH: HATS, OH: OFFBEAT, RS: '...o......o..o..' },
        n: {
          BA: '0:0:1a 1:0:1 2:7:1s 3:0:1 5:5:1a 6:3:1s 7:0:1 8:0:1a 9:7:1 10:1:1s 11:0:1 12:3:1a 13:1:1s 14:0:1 15:7:1a',
          LD: '4:7:1 7:8:1 12:7:1 14:10:1',
        },
      },
      C: {
        d: { CH: HATS, OH: OFFBEAT },
        n: {
          BA: '0:0:1a 1:0:1 2:7:1s 3:0:1 4:0:1 6:3:1a 7:0:1 8:0:1 10:1:1s 11:0:1a 12:0:1 13:7:1 14:6:2s',
        },
      },
    },
    song: SONG,
  },
  {
    id: 'techno-minimal',
    name: 'Minimal',
    genre: 'techno',
    hint: 'wenig Material, das sich über Zufall und Bedingungen ständig verschiebt',
    tempo: 128,
    swing: 0.1,
    key: 4,
    scale: 0,
    kit: 'Tight',
    drums: { BD: { decay: 0.35, level: 1 }, CB: { level: 0.5, tune: 0.7 }, RS: { level: 0.6 } },
    sound: {
      BA: { p: 'Sub', v: { ad: 0.3, as: 0.3, ar: 0.12 } },
      LD: { p: 'Bell', oct: -1, v: { dly: 0.6 } },
    },
    mix: {
      LD: { v: 0.5, r: 0.5, p: 0.62 },
      RS: { p: 0.35, r: 0.35 },
      CB: { p: 0.68, r: 0.3 },
      LT: { p: 0.3, v: 0.65, r: 0.3 },
      HT: { p: 0.7, v: 0.65, r: 0.3 },
      CH: { v: 0.75 },
    },
    fx: { size: 0.55, damp: 0.45, ret: 0.5 },
    warm: true,
    tape: 0,
    pat: {
      A: {
        d: {
          BD: FOUR,
          CP: '....-.......x...',
          CH: '..o...o...o...o.',
          RS: '...x......%..?..',
          CB: '.......1......2.',
          LT: '..........?....4',
        },
        n: { BA: '3:0:1 7:0:1 10:0:1 14:3:1', LD: '6:4:1 13:7:1' },
      },
      B: {
        d: {
          BD: FOUR,
          CP: '....-.......x...',
          CH: '..o...o...o.....',
          OH: '..............o.',
          RS: '...x......%..?..',
          HT: '.....%.....?....',
        },
        n: { BA: '3:0:1 7:0:1 10:0:1 14:5:1', LD: '6:4:1 9:2:1 13:7:1' },
      },
      C: {
        d: { BD: 'x.......x.......', CH: '..o...o...o...o.', RS: '...x......%..?..' },
        n: { BA: '3:0:1 7:0:1 10:0:1 14:3:1', LD: '6:4:1 13:7:1' },
      },
    },
    song: SONG,
  },
  {
    id: 'techno-detroit',
    name: 'Detroit',
    genre: 'techno',
    hint: 'synkopierte Septakkorde wie Streicher, Bass in Oktaven',
    tempo: 130,
    swing: 0.05,
    key: 5,
    scale: 0,
    kit: 'Classic',
    drums: { BD: { tune: 0.52, decay: 0.42, level: 1 }, CH: { decay: 0.3 }, OH: { decay: 0.4 } },
    sound: {
      BA: { p: 'Deep' },
      LD: { p: 'Stab', oct: -1, v: { fd: 0.35, ad: 0.4, ar: 0.3, dly: 0.45 } },
    },
    mix: {
      LD: { v: 0.65, r: 0.5 },
      CH: { v: 0.6, p: 0.58 },
      OH: { v: 0.7, p: 0.42 },
      RS: { p: 0.35 },
    },
    fx: { size: 0.6, damp: 0.5, ret: 0.55 },
    warm: true,
    tape: 0.1,
    pat: {
      A: {
        d: { BD: FOUR, CP: CLAP, CH: HATS, OH: OFFBEAT, RS: '.......o.....o..' },
        n: {
          BA: '0:0:2 3:0:1 6:7:2 8:6:2 11:6:1 14:5:2',
          LD: '0:0:2S 3:0:2S 8:6:2S 11:6:2S 14:5:2S',
        },
      },
      B: {
        d: { BD: FOUR, CP: CLAP, CH: HATS, OH: OFFBEAT, HT: '..........o..o..' },
        n: {
          BA: '0:3:2 3:3:1 6:10:2 8:4:2 11:4:1 14:6:2',
          LD: '0:3:2S 3:3:2S 8:4:2S 11:4:2S 14:6:2S',
        },
      },
      C: {
        d: { CH: HATS, OH: OFFBEAT, CY: 'x...............' },
        n: { BA: '0:0:8 8:6:8', LD: '0:0:2S 3:0:2S 8:6:2S 11:6:2S 14:5:2S' },
      },
    },
    song: SONG,
  },
];
