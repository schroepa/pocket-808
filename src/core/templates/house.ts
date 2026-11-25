import type { Template } from './types.ts';

/* House: Kick auf jedem Viertel, offene Hat auf dem Offbeat, Akkorde und laufender Bass. */

const SONG = [
  ['A', 3],
  ['B', 1],
  ['C', 2],
  ['A', 3],
  ['B', 1],
] as const;
const FOUR = 'x...x...x...x...';
const CLAP = '....x.......x...';
const OFFBEAT = '..x...x...x...x.';

export const HOUSE: readonly Template[] = [
  {
    id: 'house-classic',
    name: 'Classic House',
    genre: 'house',
    hint: 'Piano-Stabs im Offbeat, Bass in Oktaven',
    tempo: 124,
    swing: 0,
    key: 0,
    scale: 0,
    kit: 'Classic',
    drums: { BD: { decay: 0.45 }, OH: { decay: 0.4 }, CP: { level: 0.75 } },
    sound: { BA: { p: 'Deep' }, LD: { p: 'Stab' } },
    mix: { LD: { v: 0.65, r: 0.3 }, CH: { v: 0.65, p: 0.6 }, OH: { v: 0.7, p: 0.42 } },
    fx: { size: 0.45, ret: 0.5 },
    warm: true,
    tape: 0,
    pat: {
      A: {
        d: { BD: FOUR, CP: CLAP, CH: 'x..-x..-x..-x..-', OH: OFFBEAT },
        n: { BA: '2:0:2 6:0:2 10:0:2 14:6:2', LD: '0:0:2S 3:0:2S 6:0:2S 10:5:2S 13:5:2S' },
      },
      B: {
        d: { BD: FOUR, CP: CLAP, SD: '............--oo', CH: 'x..-x..-x..-x..-', OH: OFFBEAT },
        n: { BA: '2:3:2 6:3:2 10:4:2 14:4:2', LD: '0:3:2S 3:3:2S 6:3:2S 10:4:2S 13:4:2S' },
      },
      C: {
        d: { CP: CLAP, CH: 'x..-x..-x..-x..-', OH: OFFBEAT, CY: 'x...............' },
        n: { LD: '0:0:2S 3:0:2S 6:0:2S 10:5:2S 13:5:2S' },
      },
    },
    song: SONG,
  },
  {
    id: 'house-deep',
    name: 'Deep House',
    genre: 'house',
    hint: 'lange Septakkorde, runder Bass, leichter Shuffle',
    tempo: 122,
    swing: 0.12,
    key: 9,
    scale: 2,
    kit: 'Classic',
    drums: {
      BD: { tune: 0.45, decay: 0.45 },
      CP: { level: 0.6, decay: 0.4 },
      OH: { level: 0.55, decay: 0.35 },
      CH: { level: 0.55 },
      RS: { level: 0.55 },
    },
    sound: { BA: { p: 'Deep' }, LD: { p: 'Keys', oct: -1, v: { dly: 0.35 } } },
    mix: { LD: { v: 0.72, r: 0.45 }, RS: { r: 0.4, p: 0.35 }, CH: { p: 0.6 }, OH: { p: 0.42 } },
    fx: { size: 0.55, damp: 0.55, ret: 0.55 },
    warm: true,
    tape: 0.15,
    pat: {
      A: {
        d: {
          BD: FOUR,
          CP: CLAP,
          CH: 'o-..o-..o-..o-..',
          OH: '..o...o...o...o.',
          RS: '.......o..o.....',
        },
        n: { BA: '0:0:3 3:0:1 6:4:2 8:3:3 11:3:1 14:2:2', LD: '2:0:5S 10:3:5S' },
      },
      B: {
        d: {
          BD: FOUR,
          CP: CLAP,
          CH: 'o-..o-..o-..o-..',
          OH: '..o...o...o...o.',
          RS: '.......o..o..-..',
        },
        n: { BA: '0:5:3 3:5:1 6:4:2 8:4:3 11:4:1 14:6:2', LD: '2:5:5S 10:4:5S' },
      },
      C: {
        d: { CH: 'o-..o-..o-..o-..', RS: '.......o..o.....' },
        n: { BA: '0:0:8 8:3:8', LD: '0:0:8S 8:3:8S' },
      },
    },
    song: SONG,
  },
  {
    id: 'house-chicago-jack',
    name: 'Chicago Jack',
    genre: 'house',
    hint: 'roh und perkussiv: Rimshots, Toms, Snare-Wirbel, hüpfender Bass',
    tempo: 125,
    swing: 0.1,
    key: 5,
    scale: 4,
    kit: 'Tight',
    drums: { BD: { decay: 0.4, level: 0.95 }, RS: { level: 0.6 } },
    sound: { BA: { p: 'Rubber' }, LD: { p: 'Pulse', oct: -1, v: { dly: 0.25 } } },
    mix: {
      LD: { v: 0.58, r: 0.25, p: 0.6 },
      RS: { p: 0.35 },
      LT: { p: 0.3, v: 0.7 },
      HT: { p: 0.7, v: 0.7 },
      CH: { v: 0.7 },
    },
    fx: { size: 0.3, ret: 0.4 },
    warm: true,
    tape: 0.1,
    pat: {
      A: {
        d: { BD: FOUR, CP: CLAP, CH: OFFBEAT, RS: '...o..o....o..o.', LT: '..........-..-..' },
        n: {
          BA: '0:0:1 2:0:1 3:0:1 6:0:1 8:0:1 10:0:1 11:2:1 14:3:1',
          LD: '0:5:1 3:5:1 6:4:1 8:5:1 11:5:1 14:3:1',
        },
      },
      B: {
        d: {
          BD: FOUR,
          CP: CLAP,
          CH: OFFBEAT,
          RS: '...o..o....o....',
          SD: '............o.xx',
          HT: '......o......o..',
        },
        n: {
          BA: '0:0:1 2:0:1 3:0:1 6:0:1 8:3:1 10:3:1 11:2:1 14:1:1',
          LD: '0:6:1 3:6:1 6:5:1 8:4:1 11:4:1 14:3:1',
        },
      },
      C: {
        d: { BD: FOUR, CP: CLAP, CB: 'o.-.o.-.o.-.o.-.' },
        n: { BA: '0:0:1 2:0:1 3:0:1 6:0:1 8:0:1 10:0:1 11:2:1 14:3:1' },
      },
    },
    song: SONG,
  },
  {
    id: 'house-tech',
    name: 'Tech House',
    genre: 'house',
    hint: 'rollender Bass zwischen den Kicks, Percussion mit Zufall',
    tempo: 126,
    swing: 0.15,
    key: 2,
    scale: 0,
    kit: 'Tight',
    drums: { BD: { decay: 0.38, level: 1 }, OH: { decay: 0.35 } },
    sound: { BA: { p: 'Rubber', v: { cut: 0.34 } }, LD: { p: 'Stab', v: { dly: 0.55 } } },
    mix: {
      LD: { v: 0.55, r: 0.4 },
      RS: { p: 0.65, r: 0.3 },
      LT: { p: 0.3, v: 0.65 },
      HT: { p: 0.7, v: 0.65 },
      CH: { v: 0.6, p: 0.58 },
      OH: { v: 0.65, p: 0.42 },
    },
    fx: { size: 0.4, ret: 0.45 },
    warm: true,
    tape: 0,
    pat: {
      A: {
        d: {
          BD: FOUR,
          CP: CLAP,
          CH: '.-.-.-.-.-.-.-.-',
          OH: '..o...o...o...o.',
          RS: '...%......%..%..',
          LT: '.......?......?.',
        },
        n: { BA: '1:0:1 3:0:1 5:0:1 7:0:1 9:0:1 11:3:1 13:0:1 15:6:1', LD: '6:0:1S 14:0:1S' },
      },
      B: {
        d: {
          BD: FOUR,
          CP: CLAP,
          CH: '.-.-.-.-.-.-.-.-',
          OH: '..o...o...o...o.',
          RS: '...%......%..%..',
          HT: '......?.....o...',
          SD: '..............-o',
        },
        n: { BA: '1:0:1 3:0:1 5:0:1 7:2:1 9:0:1 11:3:1 13:4:1 15:6:1', LD: '6:0:1S 14:3:1S' },
      },
      C: {
        d: { BD: '........x...x...', CP: CLAP, CH: '.-.-.-.-.-.-.-.-', OH: '..o...o...o...o.' },
        n: { BA: '1:0:1 3:0:1 5:0:1 7:0:1 9:0:1 11:3:1 13:0:1 15:6:1' },
      },
    },
    song: SONG,
  },
];
