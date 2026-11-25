import type { Template } from './types.ts';

/* Lo-Fi: langsam, viel Swing, tief gestimmtes Kit, Septakkorde, Band-Charakter. */

const FX = { size: 0.5, damp: 0.6, ret: 0.55 };
const SONG = [
  ['A', 3],
  ['B', 1],
  ['C', 2],
  ['A', 3],
  ['B', 1],
] as const;

export const LOFI: readonly Template[] = [
  {
    id: 'lofi-dusty-tape',
    name: 'Dusty Tape',
    genre: 'lofi',
    hint: 'Boom-Bap-Groove mit Septakkorden, wie von der Kassette',
    tempo: 78,
    swing: 0.55,
    key: 2,
    scale: 2,
    kit: 'Lo-Fi',
    sound: { BA: { p: 'Mellow' }, LD: { p: 'Keys' } },
    mix: { LD: { v: 0.7, r: 0.35 }, SD: { r: 0.3 }, CH: { p: 0.62 } },
    fx: FX,
    warm: true,
    tape: 0.6,
    pat: {
      A: {
        d: {
          BD: 'x......o..x.....',
          SD: '....x.......x...',
          CH: 'x.o.x.o-x.o.x.o?',
          RS: '.........-......',
        },
        n: { BA: '0:0:3 7:0:1 10:3:3 14:4:2', LD: '0:0:7S 8:3:7S' },
      },
      B: {
        d: {
          BD: 'x......o..x..o..',
          SD: '....x.......x..-',
          CH: 'x.o.x.o-x.o.x...',
          OH: '..............o.',
        },
        n: { BA: '0:4:3 7:4:1 10:3:3 14:3:1', LD: '0:4:7S 8:3:7S' },
      },
      C: {
        d: { BD: '..........x.....', SD: '............x...', CH: 'x...x...x.o.x.o.' },
        n: { BA: '0:0:8', LD: '0:0:8S 8:6:8S' },
      },
    },
    song: SONG,
  },
  {
    id: 'lofi-rainy-day',
    name: 'Rainy Day',
    genre: 'lofi',
    hint: 'Dur-Akkorde, Rimshot statt Snare, sehr weich',
    tempo: 72,
    swing: 0.5,
    key: 5,
    scale: 1,
    kit: 'Lo-Fi',
    sound: { BA: { p: 'Mellow' }, LD: { p: 'Keys', oct: -1 } },
    mix: { LD: { v: 0.72, r: 0.45 }, RS: { r: 0.4, v: 0.7 }, CH: { v: 0.6, p: 0.4 } },
    fx: { size: 0.6, damp: 0.6, ret: 0.6 },
    warm: true,
    tape: 0.7,
    pat: {
      A: {
        d: { BD: 'x.........x.o...', RS: '....x.......x...', CH: 'o.-.o.-.o.-.o.-?' },
        n: { BA: '0:0:5 6:0:2 8:5:5 14:5:2', LD: '0:0:8S 8:5:8S' },
      },
      B: {
        d: {
          BD: 'x.....o...x.....',
          RS: '....x.......x.-.',
          CH: 'o.-.o...o.-.o.-.',
          OH: '......o.........',
        },
        n: { BA: '0:1:5 6:1:2 8:4:5 14:4:2', LD: '0:1:8S 8:4:8S' },
      },
      C: {
        d: { BD: 'x...............', CH: '..o...o...o...o.' },
        n: { BA: '0:0:8 8:5:8', LD: '0:0:4S 4:2:4T 8:5:4S 12:4:4T' },
      },
    },
    song: SONG,
  },
  {
    id: 'lofi-late-night',
    name: 'Late Night Study',
    genre: 'lofi',
    hint: 'Moll-Melodie mit Glöckchen über ruhigen Hats',
    tempo: 84,
    swing: 0.45,
    key: 9,
    scale: 0,
    kit: 'Lo-Fi',
    sound: { BA: { p: 'Mellow' }, LD: { p: 'Bell', oct: -1 } },
    mix: { LD: { v: 0.65, r: 0.4, p: 0.58 }, SD: { r: 0.35 } },
    fx: FX,
    warm: true,
    tape: 0.5,
    pat: {
      A: {
        d: { BD: 'x..o......x.....', SD: '....x.......x...', CH: 'o.-.o.-.o.-.o.-.' },
        n: { BA: '0:0:3 3:0:1 10:5:3 14:6:2', LD: '0:4:2 3:2:2 6:0:4 10:2:2 12:1:4' },
      },
      B: {
        d: { BD: 'x..o......x..o..', SD: '....x.......x..?', CH: 'o.-.o.-.o.-.o.r.' },
        n: { BA: '0:3:3 3:3:1 10:4:3 14:4:2', LD: '0:3:2 3:5:2 6:4:4 10:6:2 12:4:4' },
      },
      C: {
        d: { BD: 'x.........o.....', RS: '....x.......x...' },
        n: { BA: '0:0:8 8:5:8', LD: '0:7:4 4:4:4 8:5:4 12:4:4' },
      },
    },
    song: SONG,
  },
  {
    id: 'lofi-jazzy-hop',
    name: 'Jazzy Hop',
    genre: 'lofi',
    hint: 'laufender Bass, kurze Akkord-Tupfer, viel Shuffle',
    tempo: 86,
    swing: 0.6,
    key: 7,
    scale: 2,
    kit: 'Lo-Fi',
    drums: { CH: { level: 0.55 } },
    sound: { BA: { p: 'Mellow' }, LD: { p: 'Keys', oct: -1 } },
    mix: { LD: { v: 0.7, r: 0.3, p: 0.4 }, SD: { r: 0.3 }, CH: { p: 0.6 } },
    fx: FX,
    warm: true,
    tape: 0.5,
    pat: {
      A: {
        d: {
          BD: 'x......x..o.....',
          SD: '....x.......x...',
          CH: 'x.-ox.-ox.-ox.-o',
          RS: '.......-.....-..',
        },
        n: {
          BA: '0:0:2 3:2:1 4:4:2 7:6:1 8:3:2 11:4:1 12:6:2 14:4:2',
          LD: '2:0:2S 10:3:2S',
        },
      },
      B: {
        d: { BD: 'x......x..o..o..', SD: '....x.......x.-.', CH: 'x.-ox.-ox.-ox.-o' },
        n: {
          BA: '0:3:2 3:4:1 4:6:2 7:7:1 8:4:2 11:3:1 12:2:2 14:1:2',
          LD: '2:3:2S 10:4:2S',
        },
      },
      C: {
        d: { BD: 'x...............', CH: 'x.-ox.-ox.-ox.-o' },
        n: { BA: '0:0:4 8:3:4', LD: '0:0:6S 8:3:6S' },
      },
    },
    song: SONG,
  },
  {
    id: 'lofi-sleepy-halftime',
    name: 'Sleepy Halftime',
    genre: 'lofi',
    hint: 'halbes Tempo, lange Flächen, stark angezerrtes Band',
    tempo: 64,
    swing: 0.4,
    key: 4,
    scale: 4,
    kit: 'Lo-Fi',
    drums: { BD: { decay: 0.6 } },
    sound: { BA: { p: 'Mellow' }, LD: { p: 'Pad', oct: -1 } },
    mix: { LD: { v: 0.7, r: 0.5 }, SD: { r: 0.45 }, RS: { r: 0.45 } },
    fx: { size: 0.7, damp: 0.55, ret: 0.6 },
    warm: true,
    tape: 0.8,
    pat: {
      A: {
        d: { BD: 'x.....o.......o.', SD: '........x.......', CH: 'o...o...o...o.-.' },
        n: { BA: '0:0:7 8:2:6', LD: '0:0:8T 8:2:8T' },
      },
      B: {
        d: {
          BD: 'x.....o...o.....',
          SD: '........x.....-.',
          CH: 'o...o...o...o...',
          OH: '..............o.',
        },
        n: { BA: '0:1:7 8:4:6', LD: '0:1:8T 8:4:8T' },
      },
      C: {
        d: { RS: '........x.......', CH: '....o.......o...' },
        n: { BA: '0:0:16', LD: '0:5:4 4:4:4 8:3:4 12:1:4' },
      },
    },
    song: SONG,
  },
];
