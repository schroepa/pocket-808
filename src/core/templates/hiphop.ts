import type { Template } from './types.ts';

/* Hip-Hop: Boom Bap bis Südstaaten, kräftige Kick, Snare auf 2 und 4. */

const SONG = [
  ['A', 3],
  ['B', 1],
  ['C', 2],
  ['A', 3],
  ['B', 1],
] as const;

export const HIPHOP: readonly Template[] = [
  {
    id: 'hiphop-boom-bap',
    name: 'Classic Boom Bap',
    genre: 'hiphop',
    hint: 'der Standard: schwere Kick, trockene Snare, Sub-Bass',
    tempo: 90,
    swing: 0.5,
    key: 0,
    scale: 0,
    kit: 'Boom',
    sound: { BA: { p: 'Sub' }, LD: { p: 'Keys' } },
    mix: { LD: { v: 0.65, r: 0.3 }, CH: { p: 0.6 } },
    fx: { size: 0.35, ret: 0.45 },
    warm: true,
    tape: 0.2,
    pat: {
      A: {
        d: { BD: 'x......x..x.....', SD: '....x.......x...', CH: 'x.o.x.o.x.o.x.o.' },
        n: { BA: '0:0:3 7:0:1 10:0:2 13:6:2', LD: '2:2:2 6:4:2 10:2:2 12:0:3' },
      },
      B: {
        d: {
          BD: 'x......x..x..x..',
          SD: '....x.......x.-o',
          CH: 'x.o.x.o.x.o.x...',
          OH: '..............x.',
        },
        n: { BA: '0:5:3 7:5:1 10:6:2 13:6:2', LD: '2:4:2 6:5:2 10:4:2 12:6:3' },
      },
      C: {
        d: { BD: 'x...............', SD: '....x.......x...', RS: '..-...-...-...-.' },
        n: { BA: '0:0:8', LD: '0:0:4T 8:5:4T' },
      },
    },
    song: SONG,
  },
  {
    id: 'hiphop-golden-era',
    name: 'Golden Era',
    genre: 'hiphop',
    hint: 'Bläser-Stabs und ein hüpfender Bass',
    tempo: 94,
    swing: 0.4,
    key: 9,
    scale: 2,
    kit: 'Classic',
    drums: { BD: { tune: 0.42, decay: 0.6 }, SD: { tune: 0.45 } },
    sound: { BA: { p: 'Rubber' }, LD: { p: 'Stab', oct: -1 } },
    mix: { LD: { v: 0.7, r: 0.3, p: 0.42 }, CH: { v: 0.7, p: 0.6 }, CB: { v: 0.6, p: 0.3 } },
    fx: { size: 0.35, ret: 0.45 },
    warm: true,
    tape: 0.15,
    pat: {
      A: {
        d: {
          BD: 'x..x......x.....',
          SD: '....x.......x...',
          CH: 'x.o.x.o.x...x.o.',
          OH: '..........o.....',
        },
        n: { BA: '0:0:2 3:0:1 6:6:2 10:0:2 13:4:2', LD: '0:0:2S 3:0:1S 10:3:2S' },
      },
      B: {
        d: { BD: 'x..x......x..x..', SD: '....x..-....x...', CH: 'x.o.x.o.x.o.x.o.' },
        n: { BA: '0:3:2 3:3:1 6:2:2 10:4:2 13:4:2', LD: '0:3:2S 3:3:1S 10:4:2S' },
      },
      C: {
        d: {
          BD: 'x.........x.....',
          SD: '............x...',
          CH: '....x.......x...',
          CB: '..x.....x.......',
        },
        n: { BA: '0:0:4 8:6:4', LD: '0:0:8S' },
      },
    },
    song: SONG,
  },
  {
    id: 'hiphop-g-funk',
    name: 'G-Funk',
    genre: 'hiphop',
    hint: 'singende Säge mit Slide und Vibrato, Clap auf der Snare',
    tempo: 92,
    swing: 0.25,
    key: 5,
    scale: 0,
    kit: 'Classic',
    drums: { BD: { tune: 0.45, decay: 0.6 }, CP: { level: 0.6 } },
    sound: {
      BA: { p: 'Rubber' },
      LD: {
        p: 'Saw',
        v: { det: 0.15, cut: 0.68, dly: 0.25, aa: 0.04 },
        lfo: { r: 0.72, d: 0.18, t: 'pit' },
      },
    },
    mix: { LD: { v: 0.62, r: 0.3 }, CH: { v: 0.65, p: 0.6 }, OH: { v: 0.6, p: 0.6 } },
    fx: { size: 0.4, ret: 0.45 },
    warm: true,
    tape: 0.1,
    pat: {
      A: {
        d: {
          BD: 'x..x..x...x.....',
          SD: '....x.......x...',
          CP: '....x.......x...',
          CH: 'o...o.-.o.-.o...',
          OH: '..o...........o.',
        },
        n: {
          BA: '0:0:2 3:0:1 6:0:1 7:2:1 10:3:2 13:4:2',
          LD: '0:7:4 4:6:2s 6:4:2s 8:7:4 12:9:3s',
        },
      },
      B: {
        d: {
          BD: 'x..x..x...x..x..',
          SD: '....x.......x...',
          CP: '....x.......x...',
          CH: 'o...o.-.o.-.o...',
          OH: '..o...........o.',
        },
        n: {
          BA: '0:5:2 3:5:1 6:5:1 7:6:1 10:4:2 13:4:2',
          LD: '0:9:4 4:7:2s 6:6:2s 8:4:6s',
        },
      },
      C: {
        d: { BD: 'x.....x.........', CP: '....x.......x...', CH: 'o.-.o.-.o.-.o.-.' },
        n: { BA: '0:0:6 8:3:6', LD: '0:4:8 8:6:8s' },
      },
    },
    song: SONG,
  },
  {
    id: 'hiphop-dirty-south',
    name: 'Dirty South',
    genre: 'hiphop',
    hint: 'gerade Sechzehntel-Hats mit Rolls, 808-Bass, Cowbell',
    tempo: 82,
    swing: 0,
    key: 7,
    scale: 0,
    kit: 'Boom',
    drums: { CH: { decay: 0.2, level: 0.6 }, CB: { level: 0.55 } },
    sound: { BA: { p: '808' }, LD: { p: 'Pulse', oct: -1 } },
    mix: { LD: { v: 0.6, r: 0.25 }, CH: { p: 0.6 }, CB: { p: 0.35 }, CP: { v: 0.7 } },
    fx: { size: 0.3, ret: 0.4 },
    warm: true,
    tape: 0,
    pat: {
      A: {
        d: {
          BD: 'x.....x..x......',
          SD: '....x.......x...',
          CP: '....x.......x...',
          CH: 'x.oxx.oxx.oxx.rx',
          CB: '..x.......x.....',
        },
        n: { BA: '0:0:5 6:0:2 9:0:3 13:6:3', LD: '0:0:1 3:0:1 6:2:1 8:0:1 11:0:1 14:3:1' },
      },
      B: {
        d: {
          BD: 'x.....x..x...x..',
          SD: '....x.......x..-',
          CP: '....x.......x...',
          CH: 'x.oxx.oxx.oxR.rx',
          CB: '..x.......x.....',
        },
        n: { BA: '0:5:5 6:5:2 9:4:3 13:4:3', LD: '0:2:1 3:2:1 6:4:1 8:2:1 11:2:1 14:1:1' },
      },
      C: {
        d: { BD: 'x...............', CP: '....x.......x...', CH: 'x...x...x...x...' },
        n: { BA: '0:0:14', LD: '0:0:1 3:0:1 6:2:1 8:0:1 11:0:1 14:3:1' },
      },
    },
    song: SONG,
  },
];
