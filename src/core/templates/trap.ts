import type { Template } from './types.ts';

/* Trap und Drill: halbes Tempo auf der Snare, Hat-Rolls, lange 808-Bässe mit Slide. */

const SONG = [
  ['A', 3],
  ['B', 1],
  ['C', 2],
  ['A', 3],
  ['B', 1],
] as const;
const FX = { size: 0.35, ret: 0.4 };

export const TRAP: readonly Template[] = [
  {
    id: 'trap-atlanta',
    name: 'Atlanta Trap',
    genre: 'trap',
    hint: 'Hat-Rolls, 808 mit Slide, Glöckchen-Melodie',
    tempo: 140,
    swing: 0,
    key: 6,
    scale: 0,
    kit: 'Trap',
    sound: { BA: { p: '808' }, LD: { p: 'Bell', oct: -1 } },
    mix: {
      BA: { v: 0.68 },
      LD: { v: 0.62, r: 0.35 },
      CH: { p: 0.6 },
      OH: { p: 0.6 },
      CP: { v: 0.7 },
    },
    fx: FX,
    warm: true,
    tape: 0,
    pat: {
      A: {
        d: {
          BD: 'x......x..x.....',
          SD: '........x.......',
          CP: '........x.......',
          CH: 'x.o.x...x.r.x.t.',
          OH: '......o.........',
        },
        n: { BA: '0:0:6 7:0:3 10:5:5s', LD: '0:7:2 3:9:2 6:7:2 8:4:3 12:6:2 14:5:2' },
      },
      B: {
        d: {
          BD: 'x......x..x..x..',
          SD: '........x.....-.',
          CP: '........x.......',
          CH: 'x.o.x.R.x.o.r.t.',
        },
        n: { BA: '0:3:6 7:3:3 10:2:5s', LD: '0:10:2 3:9:2 6:7:2 8:5:3 12:4:4' },
      },
      C: {
        d: { BD: 'x...............', CP: '........x.......', CH: 'x...x...x...x.R.' },
        n: { BA: '0:0:15', LD: '0:7:2 3:9:2 6:7:2 8:4:3 12:6:2 14:5:2' },
      },
    },
    song: SONG,
  },
  {
    id: 'trap-dark',
    name: 'Dark Trap',
    genre: 'trap',
    hint: 'phrygisch und düster, tiefe Fläche, sparsame Kick',
    tempo: 145,
    swing: 0,
    key: 1,
    scale: 3,
    kit: 'Trap',
    sound: { BA: { p: '808' }, LD: { p: 'Soft', oct: -1, v: { cut: 0.5, dly: 0.5 } } },
    mix: { BA: { v: 0.68 }, LD: { v: 0.7, r: 0.5 }, CH: { p: 0.6 }, RS: { r: 0.4, p: 0.35 } },
    fx: { size: 0.6, damp: 0.6, ret: 0.5 },
    warm: true,
    tape: 0.15,
    pat: {
      A: {
        d: {
          BD: 'x..x......x.....',
          SD: '........x.......',
          CH: 'o.o.o.o.xto.o.r.',
          RS: '.....-.......-..',
        },
        n: { BA: '0:0:3 3:0:5 10:1:5', LD: '0:0:4 4:1:4 8:0:4 12:6:4' },
      },
      B: {
        d: { BD: 'x..x......x.x...', SD: '........x......-', CH: 'o.o.R.o.xto.o.t.' },
        n: { BA: '0:3:3 3:3:5 10:1:5', LD: '0:2:4 4:1:4 8:0:8' },
      },
      C: {
        d: { BD: 'x...............', SD: '........x.......', CH: 'o...o...o...o.R.' },
        n: { BA: '0:0:16', LD: '0:0:4 4:1:4 8:0:4 12:6:4' },
      },
    },
    song: SONG,
  },
  {
    id: 'trap-uk-drill',
    name: 'UK Drill',
    genre: 'trap',
    hint: 'stolpernde Hats im 3-3-2-Muster, gleitende 808',
    tempo: 142,
    swing: 0,
    key: 7,
    scale: 0,
    kit: 'Trap',
    drums: { SD: { tune: 0.7, decay: 0.3 }, BD: { decay: 0.8 } },
    sound: { BA: { p: '808', v: { fr: 0.2 } }, LD: { p: 'Bell', oct: -1, v: { cut: 0.6 } } },
    mix: {
      BA: { v: 0.68 },
      LD: { v: 0.6, r: 0.4 },
      CH: { p: 0.58 },
      OH: { p: 0.6, v: 0.6 },
      RS: { p: 0.35 },
    },
    fx: { size: 0.45, ret: 0.45 },
    warm: true,
    tape: 0,
    pat: {
      A: {
        d: {
          BD: 'x..x......x.....',
          SD: '........x.......',
          CH: 'x..x..x.x..x..x.',
          OH: '.....o..........',
          RS: '..............o.',
        },
        n: {
          BA: '0:0:3 3:0:4 8:5:3s 11:6:3s 14:4:2s',
          LD: '0:4:3 3:2:3 6:0:2 8:5:3 11:4:3 14:2:2',
        },
      },
      B: {
        d: {
          BD: 'x..x......x..x..',
          SD: '........x.....x.',
          CH: 'x..x..x.x.tx..x.',
        },
        n: {
          BA: '0:3:3 3:3:4 8:2:3s 11:4:3s 14:6:2s',
          LD: '0:6:3 3:4:3 6:2:2 8:4:3 11:2:3 14:0:2',
        },
      },
      C: {
        d: { BD: 'x...............', SD: '........x.......', CH: 'x..x..x.x..x..x.' },
        n: { BA: '0:0:8 8:5:8s', LD: '0:4:3 3:2:3 6:0:2 8:5:3 11:4:3 14:2:2' },
      },
    },
    song: SONG,
  },
  {
    id: 'trap-melodic',
    name: 'Melodic Trap',
    genre: 'trap',
    hint: 'Akkorde als Arpeggio über zwei Oktaven',
    tempo: 138,
    swing: 0,
    key: 9,
    scale: 0,
    kit: 'Trap',
    sound: {
      BA: { p: '808' },
      LD: { p: 'Keys', oct: -1, v: { dly: 0.4 }, arp: { m: 'up', r: 1, o: 2 } },
    },
    mix: { BA: { v: 0.68 }, LD: { v: 0.65, r: 0.4 }, CH: { p: 0.6 }, CP: { v: 0.7, r: 0.35 } },
    fx: FX,
    warm: true,
    tape: 0.1,
    pat: {
      A: {
        d: {
          BD: 'x.....x...x.....',
          SD: '........x.......',
          CP: '........x.......',
          CH: 'x.o.x.o.x.o.r.o.',
        },
        n: { BA: '0:0:6 6:0:2 8:5:6 14:5:2', LD: '0:0:8T 8:5:8T' },
      },
      B: {
        d: {
          BD: 'x.....x...x..x..',
          SD: '........x.......',
          CP: '........x.......',
          CH: 'x.o.x.o.x.t.r.R.',
        },
        n: { BA: '0:3:6 6:3:2 8:4:6 14:4:2', LD: '0:3:8T 8:4:8T' },
      },
      C: {
        d: { CP: '........x.......', CH: 'x...x...x...x...' },
        n: { BA: '0:0:8 8:5:8', LD: '0:0:8T 8:5:8T' },
      },
    },
    song: SONG,
  },
];
