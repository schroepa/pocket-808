import type { Template } from './types.ts';

/*
 * Berlin: Electro, Electroclash, Big Beat und Punk-Techno der frühen 2000er. Jede Vorlage hat ihren
 * eigenen Rhythmus-Kern, eigene Tonart und eigenen Klang; nichts davon ist ein Techno-Muster mit
 * anderem Kit. Melodien und Beats sind frei erfunden.
 */

export const BERLIN: readonly Template[] = [
  {
    // kühl und trocken: Kick auf den Vierteln, Snare statt Clap, Hats in Achteln, Cowbell als Zeiger.
    // Der Bass steht wie eine Maschine auf einem Ton, der Lead sagt nur drei Töne.
    id: 'berlin-kajal',
    name: 'Kajal',
    genre: 'berlin',
    hint: 'kühle, trockene Drums, stoischer Bass, sparsamer Lead',
    tempo: 124,
    swing: 0,
    key: 9,
    scale: 0,
    kit: 'Electro',
    sound: { BA: { p: 'Roboter' }, LD: { p: 'Neon' } },
    mix: {
      BA: { v: 0.85 },
      LD: { v: 0.62, r: 0.08, p: 0.56 },
      SD: { v: 0.75, r: 0.05 },
      CH: { v: 0.6, p: 0.6 },
      CB: { v: 0.55, p: 0.35 },
      RS: { v: 0.6, p: 0.66, r: 0 },
    },
    fx: { size: 0.3, damp: 0.6, ret: 0.4 },
    warm: false,
    tape: 0,
    pat: {
      A: {
        d: {
          BD: 'x...x...x...x...',
          SD: '....x.......x...',
          CH: 'x.o.x.o.x.o.x.o.',
          CB: '...........o....',
        },
        n: {
          BA: '0:0:1 2:0:1 4:0:1 6:0:1 8:0:1 10:0:1 12:0:1 14:0:1',
          LD: '4:7:2 7:6:1 10:4:4',
        },
      },
      B: {
        d: {
          BD: 'x...x...x...x...',
          SD: '....x.......x...',
          CH: 'x.o.x.o.x.o.x...',
          OH: '..............o.',
          CB: '...........o..o.',
          RS: '.......-.....-..',
        },
        n: {
          BA: '0:0:1 2:0:1 4:0:1 6:0:1 8:5:1 10:5:1 12:5:1 14:5:1',
          LD: '0:7:2 4:6:2 8:4:4 13:3:3',
        },
      },
      C: {
        d: { CH: 'x.o.x.o.x.o.x.o.', CB: '...........o....', RS: '....x.......x...' },
        n: { BA: '0:0:8 8:5:8', LD: '0:4:6 8:3:6' },
      },
      D: {
        d: {
          BD: 'x...x...x...x...',
          SD: '....x.......x.oo',
          CH: 'x.o.x.o.x.o.x.o.',
          CB: '...........o....',
          LT: '..........o..o..',
        },
        n: {
          BA: '0:0:1 2:0:1 4:0:1 6:0:1 8:0:1 10:0:1 12:0:1 14:0:1',
          LD: '4:7:2 7:6:1 10:4:2 12:6:4',
        },
      },
    },
    song: [
      ['A', 4],
      ['B', 2],
      ['C', 2],
      ['D', 1],
      ['A', 2],
      ['B', 2],
    ],
  },
  {
    // Pop mit Säge: Oktav-Bass, der unter der Hook E-Moll, C und D abläuft; die Hook kommt in A
    // und antwortet in B nach unten. Die Kick stolpert am Taktende in den nächsten Takt.
    id: 'berlin-koenigin',
    name: 'Königin',
    genre: 'berlin',
    hint: 'sägender Bass und eine Pop-Hook',
    tempo: 128,
    swing: 0,
    key: 4,
    scale: 0,
    kit: 'Electro',
    sound: {
      BA: { p: 'Kreissäge' },
      LD: { p: 'Neon', v: { dly: 0.2, ar: 0.2 } },
    },
    mix: {
      BA: { v: 0.72 },
      LD: { v: 0.6, r: 0.22, p: 0.45 },
      CP: { v: 0.72, r: 0.25 },
      CH: { v: 0.55, p: 0.62 },
      SD: { v: 0.7 },
    },
    fx: { size: 0.45, damp: 0.5, ret: 0.45 },
    warm: false,
    tape: 0,
    drumDrive: 0.25,
    pat: {
      A: {
        d: {
          BD: 'x...x...x...x..x',
          CP: '....x.......x...',
          CH: 'x-o-x-o-x-o-x-o-',
        },
        n: {
          BA: '0:0:2 2:7:1 3:0:1 4:0:1 6:7:1 7:0:1 8:5:2 10:5:1 11:5:1a 12:6:2 14:6:1 15:7:1s',
          LD: '0:7:2 2:7:1 3:6:1 4:4:3 8:5:2 10:4:2 12:6:4',
        },
      },
      B: {
        d: {
          BD: 'x...x...x...x..x',
          CP: '....x.......x...',
          CH: 'x-o-x-o-x-o-x-o-',
          SD: '..............oo',
          CY: '1...............',
        },
        n: {
          BA: '0:0:2 2:7:1 3:0:1 4:0:1 6:7:1 7:0:1 8:5:2 10:5:1 11:5:1a 12:6:2 14:6:1 15:7:1s',
          LD: '0:7:2 2:7:1 3:6:1 4:4:3 8:3:2 10:2:2 12:1:2 14:0:2',
        },
      },
      C: {
        d: { CP: '....x.......x...', CH: 'x...x...x...x...', RS: '......o.......o.' },
        n: { BA: '0:0:8 8:5:4 12:6:4', LD: '0:4:8T 8:5:4T 12:6:4T' },
      },
      D: {
        d: {
          BD: 'x...x...x...x...',
          CP: '....x.......x...',
          CH: 'x-o-x-o-x-o-x-o-',
          SD: '........x.x.RRRR',
        },
        n: {
          BA: '0:0:1 1:0:1 2:7:1 3:0:1 4:0:1 5:0:1 6:7:1 7:0:1 8:6:1 9:6:1 10:6:1 11:6:1 12:6:1 13:6:1 14:7:1 15:7:1',
          LD: '0:7:2 2:7:1 3:6:1 4:4:3 8:6:8',
        },
      },
    },
    song: [
      ['A', 4],
      ['B', 4],
      ['C', 2],
      ['D', 1],
      ['A', 2],
      ['B', 2],
    ],
  },
  {
    // harter Electro-Techno: gebrochene Kick, Snare wie ein Schlag auf Stahl, ein Sechzehntel-Teppich
    // aus Hats. Phrygische Dreiklang-Stabs werfen viel Hall an die Hallenwand.
    id: 'berlin-westwerk',
    name: 'Westwerk',
    genre: 'berlin',
    hint: 'gebrochene Kick, harte Snare, Stabs im Hall',
    tempo: 135,
    swing: 0,
    key: 1,
    scale: 3,
    kit: 'Beton',
    drums: { BD: { decay: 0.5 }, CH: { decay: 0.18 } },
    sound: {
      BA: { p: 'Beton' },
      LD: { p: 'Zerre', v: { dly: 0.3 } },
    },
    mix: {
      BA: { v: 0.72 },
      LD: { v: 0.5, r: 0.65, p: 0.55 },
      SD: { v: 0.75, r: 0.3 },
      CH: { v: 0.55, p: 0.4 },
      RS: { v: 0.6, p: 0.68, r: 0.2 },
      CY: { v: 0.55, p: 0.6 },
    },
    fx: { size: 0.75, damp: 0.4, ret: 0.55 },
    warm: false,
    tape: 0,
    drumDrive: 0.45,
    pat: {
      A: {
        d: {
          BD: 'x..x..x...x.x...',
          SD: '....x.......x...',
          CH: 'x-x-x-x-x-x-x-x-',
          RS: '.......o......o.',
        },
        n: {
          BA: '0:0:2 3:0:2 6:1:1 7:0:1 10:0:2 12:1:1a 14:0:1 15:3:1',
          LD: '2:0:1T 9:1:1T 13:0:1T',
        },
      },
      B: {
        d: {
          BD: 'x..x..x...x.x..o',
          SD: '....x.......x...',
          CH: 'x-x-x-x-x-x-x-x-',
          RS: '.......o..o...o.',
          CY: '1...............',
        },
        n: {
          BA: '0:0:2 3:0:2 6:1:1 7:0:1 10:3:2 12:1:1a 14:0:1 15:6:1',
          LD: '2:0:1T 5:0:1T 9:1:1T 13:3:2T',
        },
      },
      C: {
        d: { CH: 'x-x-x-x-x-x-x-x-', RS: '.......o......o.', SD: '............x...' },
        n: { BA: '0:0:16', LD: '2:0:1T 9:1:1T 13:0:3T' },
      },
      D: {
        d: {
          BD: 'x..x..x...x.x...',
          SD: '....x.......xoxx',
          CH: 'x-x-x-x-x-x-....',
          LT: '..........o..o..',
          HT: '........o..o....',
        },
        n: {
          BA: '0:0:2 3:0:2 6:1:1 7:0:1 10:0:2 12:1:1a 14:0:1 15:3:1',
          LD: '2:0:1T 9:1:1T 12:1:1T 14:3:2T',
        },
      },
    },
    song: [
      ['A', 4],
      ['B', 4],
      ['C', 2],
      ['D', 1],
      ['B', 4],
    ],
  },
  {
    // Big Beat: dicker Break mit Geister-Snares, darunter eine Acid-Linie mit Akzent und Slide in
    // G-Moll-Pentatonik. Die Sirene heult in langen Tönen. D baut mit Rolls auf.
    id: 'berlin-breitwand',
    name: 'Breitwand',
    genre: 'berlin',
    hint: 'dicke Breaks, Acid-Linie und Roll-Aufbau',
    tempo: 126,
    swing: 0.2,
    key: 7,
    scale: 4,
    kit: 'Break',
    sound: {
      BA: { p: 'Acid', v: { cut: 0.32, res: 0.6 } },
      LD: { p: 'Sirene', oct: -1 },
    },
    mix: {
      BA: { v: 0.74 },
      LD: { v: 0.5, r: 0.35, p: 0.58 },
      SD: { v: 0.8, r: 0.22 },
      CH: { v: 0.6, p: 0.6 },
      OH: { v: 0.6, p: 0.42 },
      CY: { v: 0.55, p: 0.35 },
    },
    fx: { size: 0.55, damp: 0.5, ret: 0.45 },
    warm: true,
    tape: 0,
    drumDrive: 0.45,
    pat: {
      A: {
        d: {
          BD: 'x.x.......xx....',
          SD: '....x..-.-..x..-',
          CH: 'x.x.x.x.x.x.x...',
          OH: '..............o.',
        },
        n: {
          BA: '0:0:1a 1:0:1 2:5:1s 3:0:1 4:2:1a 6:0:1 7:3:1s 8:4:1 10:0:1a 11:5:1s 12:4:2 14:2:1s 15:1:1',
          LD: '0:5:8 12:4:4',
        },
      },
      B: {
        d: {
          BD: 'x.x.......xx..o.',
          SD: '....x..-.-..x.-o',
          CH: 'x.x.x.x.x.x.x...',
          OH: '..............o.',
          CY: '1...............',
        },
        n: {
          BA: '0:0:1a 1:0:1 2:5:1s 3:0:1 4:2:1a 6:0:1 7:3:1s 8:4:1 10:3:1a 11:6:1s 12:5:2 14:4:1s 15:2:1',
          LD: '0:7:6 8:6:8',
        },
      },
      C: {
        d: { CH: 'x.x.x.x.x.x.x...', OH: '..............o.', SD: '............x...' },
        n: {
          BA: '0:0:1a 1:0:1 2:5:1s 3:0:1 4:2:1a 6:0:1 7:3:1s 8:4:1 10:0:1a 11:5:1s 12:4:2 14:2:1s 15:1:1',
        },
      },
      D: {
        d: {
          BD: 'x.x.x.x.x.x.x.x.',
          SD: '....r...r.r.tRRR',
          CH: 'x.x.x.x.x.x.x.x.',
          CY: '............x...',
        },
        n: {
          BA: '0:0:1a 2:0:1 4:0:1a 6:0:1 8:2:1a 10:2:1 12:3:1a 13:3:1 14:4:1a 15:5:1s',
          LD: '0:4:16',
        },
      },
    },
    song: [
      ['A', 4],
      ['B', 2],
      ['C', 2],
      ['D', 1],
      ['A', 2],
      ['B', 4],
    ],
  },
  {
    // klein und verspielt: fünf Drum-Spuren, Rimshot statt Snare, ein Gummi-Bass, der hüpft, und
    // ein Motiv in C-Dur-Pentatonik, das man nach zweimal Hören mitsummt.
    id: 'berlin-zimmerlinde',
    name: 'Zimmerlinde',
    genre: 'berlin',
    hint: 'verspielt und klein, mit einem Motiv zum Mitsummen',
    tempo: 118,
    swing: 0.15,
    key: 0,
    scale: 5,
    kit: 'Draht',
    sound: {
      BA: { p: 'Rubber' },
      LD: { p: 'Pulse', v: { dly: 0.18 } },
    },
    mix: {
      BA: { v: 0.85 },
      LD: { v: 0.65, r: 0.18, p: 0.55 },
      BD: { v: 0.9 },
      RS: { v: 0.75, r: 0.15 },
      CH: { v: 0.65, p: 0.62 },
      CB: { v: 0.6, p: 0.3 },
      HT: { v: 0.65, p: 0.72 },
    },
    fx: { size: 0.3, damp: 0.6, ret: 0.4 },
    warm: true,
    tape: 0,
    pat: {
      A: {
        d: {
          BD: 'x.......x.x.....',
          RS: '....x.......x...',
          CH: '..x...x...x...x.',
          CB: '......o......o..',
        },
        n: {
          BA: '0:0:1 3:0:1 6:3:1 8:0:1 10:4:1 11:3:1 14:1:1',
          LD: '0:4:2 2:3:1 4:2:2 6:3:2 8:4:1 9:4:1 10:5:3 14:3:2',
        },
      },
      B: {
        d: {
          BD: 'x.......x.x.....',
          RS: '....x.......x..-',
          CH: '..x...x...x...x.',
          CB: '......o......o..',
          HT: '...........o..o.',
        },
        n: {
          BA: '0:0:1 3:0:1 6:3:1 8:2:1 10:1:1 11:2:1 14:4:1',
          LD: '0:4:2 2:3:1 4:2:2 6:1:2 8:2:1 9:1:1 10:0:4',
        },
      },
      C: {
        d: { RS: '....x.......x...', CB: '......o......o..', HT: '...........o..o.' },
        n: { BA: '0:0:4 8:3:4', LD: '0:7:1 2:6:1 4:5:1 6:4:2 10:5:1 12:3:4' },
      },
      D: {
        d: {
          BD: 'x.......x.x...x.',
          RS: '....x.......x.xx',
          CH: '..x...x...x...x.',
          CB: '......o......o..',
          HT: '...........o.oo.',
        },
        n: {
          BA: '0:0:1 3:0:1 6:3:1 8:0:1 10:4:1 11:3:1 14:1:1',
          LD: '0:4:2 2:3:1 4:2:2 6:3:2 8:4:1 9:4:1 10:7:3 14:5:2',
        },
      },
    },
    song: [
      ['A', 2],
      ['B', 2],
      ['A', 2],
      ['C', 2],
      ['D', 2],
      ['B', 2],
    ],
  },
  {
    // melodischer Electro-House: gerader Puls mit Auftakt-Kick, offene Hat im Offbeat, darüber
    // breite Orgel-Akkorde in F-Moll (Fm, Db, Ab, Eb). In B und D steigt die große Melodie auf.
    id: 'berlin-ostkreuz',
    name: 'Ostkreuz',
    genre: 'berlin',
    hint: 'gerader Puls, breite Akkorde, große Melodie',
    tempo: 128,
    swing: 0,
    key: 5,
    scale: 0,
    kit: 'Tight',
    drums: { BD: { decay: 0.4, level: 1 }, OH: { decay: 0.35 } },
    sound: {
      BA: { p: 'Deep', v: { cut: 0.45 } },
      LD: { p: 'Orgel', v: { dly: 0.2 } },
    },
    mix: {
      BA: { v: 0.8 },
      LD: { v: 0.55, r: 0.4 },
      CP: { v: 0.7, r: 0.35 },
      CH: { v: 0.5, p: 0.62 },
      OH: { v: 0.65, p: 0.42 },
    },
    fx: { size: 0.65, damp: 0.5, ret: 0.5 },
    warm: true,
    tape: 0,
    pat: {
      A: {
        d: {
          BD: 'x...x...x...x..o',
          CP: '....x.......x...',
          CH: '.-.-.-.-.-.-.-.-',
          OH: '..x...x...x...x.',
        },
        n: {
          BA: '0:0:2 3:7:1 6:0:1 8:5:2 11:5:1 13:4:1 14:5:2',
          LD: '0:0:3T 3:0:3T 6:0:2T 8:5:3T 11:5:3T 14:5:2T',
        },
      },
      B: {
        d: {
          BD: 'x...x...x...x..o',
          CP: '....x.......x...',
          CH: '.-.-.-.-.-.-.-.-',
          OH: '..x...x...x...x.',
          CY: '1...............',
        },
        n: {
          BA: '0:2:2 3:9:1 6:2:1 8:6:2 11:6:1 13:5:1 14:6:2',
          LD: '0:7:4 4:9:2 6:8:2 8:9:3 11:11:2 13:9:3',
        },
      },
      C: {
        d: { CH: '.-.-.-.-.-.-.-.-', OH: '..x...x...x...x.', CP: '............x...' },
        n: { BA: '0:0:8 8:5:8', LD: '0:0:8T 8:5:8T' },
      },
      D: {
        d: {
          BD: 'x...x...x...x...',
          CP: '....x.......x.oo',
          CH: '.-.-.-.-.-.-.-.-',
          OH: '..x...x...x...x.',
          RS: '.......o.......o',
        },
        n: {
          BA: '0:0:2 3:7:1 6:0:1 8:5:2 11:5:1 13:4:1 14:5:2',
          LD: '0:7:4 4:6:2 6:4:2 8:5:4 12:7:4',
        },
      },
    },
    song: [
      ['A', 4],
      ['B', 4],
      ['C', 2],
      ['D', 4],
      ['B', 2],
    ],
  },
  {
    // zerschnittene Beats: Kick und Snare an ungewohnten Stellen, Hats mit Wirbeln und Zufall.
    // Ein eleganter, laufender Bass in D-Dorisch trägt eine wehmütige Glas-Melodie mit Echo.
    id: 'berlin-spreeufer',
    name: 'Spreeufer',
    genre: 'berlin',
    hint: 'zerschnittene Beats unter einer wehmütigen Melodie',
    tempo: 126,
    swing: 0.1,
    key: 2,
    scale: 2,
    kit: 'Break',
    drums: { BD: { decay: 0.45 }, CH: { decay: 0.35 } },
    sound: {
      BA: { p: 'Pluck', v: { ad: 0.45, as: 0.4 } },
      LD: { p: 'Glas' },
    },
    mix: {
      BA: { v: 0.72 },
      LD: { v: 0.6, r: 0.4, p: 0.55 },
      SD: { v: 0.72, r: 0.25 },
      CH: { v: 0.6, p: 0.62 },
      OH: { v: 0.55, p: 0.4 },
      RS: { v: 0.6, p: 0.35, r: 0.25 },
    },
    fx: { size: 0.6, damp: 0.55, ret: 0.5 },
    warm: true,
    tape: 0.15,
    pat: {
      A: {
        d: {
          BD: 'x.....x..x......',
          SD: '....x......-x...',
          CH: 'x.?.r.x?..x.t.?.',
          OH: '...............%',
          RS: '..-....?.....-..',
        },
        n: {
          BA: '0:0:3 3:4:1 4:3:2 6:7:1 8:2:3 11:3:1 12:4:2 14:6:2',
          LD: '2:4:4 6:3:2 8:2:6 14:1:2',
        },
      },
      B: {
        d: {
          BD: 'x.....x..x...o..',
          SD: '....x......-x..-',
          CH: 'x.?.r.x?..x.t.?.',
          OH: '...............%',
          RS: '..-....?.....-..',
        },
        n: {
          BA: '0:5:3 3:4:1 4:3:2 6:7:1 8:3:3 11:4:1 12:5:2 14:4:2',
          LD: '2:4:3 5:5:1 6:6:4 10:4:6',
        },
      },
      C: {
        d: { CH: 'x.?.r.x?..x.t.?.', OH: '...............%', RS: '..-....?.....-..' },
        n: { BA: '0:0:8 8:5:8', LD: '2:4:4 6:3:2 8:2:6 14:1:2' },
      },
      D: {
        d: {
          BD: 'x.....x..x....x.',
          SD: '....x......-x.r.',
          CH: 'x.?.r.x?..x.t...',
          OH: '...............%',
          LT: '..........-..o..',
        },
        n: {
          BA: '0:0:3 3:4:1 4:3:2 6:7:1 8:2:3 11:3:1 12:4:2 14:6:2',
          LD: '2:7:3 5:6:1 6:4:4 10:3:6',
        },
      },
    },
    song: [
      ['A', 4],
      ['B', 2],
      ['C', 2],
      ['A', 2],
      ['D', 2],
      ['B', 2],
    ],
  },
  {
    // Punk-Techno: Kick stampft, Snare und Clap schlagen zusammen, alles läuft durch viel Drum
    // Drive und schwingt im Shuffle. Knurr-Bass in E-Phrygisch, Zerre spielt Quinten wie eine Gitarre.
    id: 'berlin-presslufthalle',
    name: 'Presslufthalle',
    genre: 'berlin',
    hint: 'verzerrter Punk-Techno, der stampft und schwingt',
    tempo: 132,
    swing: 0.35,
    key: 4,
    scale: 3,
    kit: 'Beton',
    sound: {
      BA: { p: 'Knurr' },
      LD: { p: 'Zerre', oct: -1, v: { dly: 0.1 } },
    },
    mix: {
      BA: { v: 0.68 },
      LD: { v: 0.5, r: 0.2, p: 0.45 },
      SD: { v: 0.7, r: 0.15 },
      CP: { v: 0.65, r: 0.2 },
      CH: { v: 0.55, p: 0.6 },
      OH: { v: 0.55, p: 0.4 },
    },
    fx: { size: 0.4, damp: 0.6, ret: 0.4 },
    warm: false,
    tape: 0,
    drumDrive: 0.8,
    pat: {
      A: {
        d: {
          BD: 'x...x...x...x.x.',
          SD: '....x.......x...',
          CP: '....x.......x...',
          CH: '-x.x-x.x-x.x-x.x',
          OH: '..o.......o.....',
        },
        n: {
          BA: '0:0:1a 2:0:1 3:1:1s 4:0:1 6:0:1a 8:0:1 10:3:1 11:1:1 12:0:1a 14:7:1 15:0:1',
          LD: '0:0:2P 3:0:1P 6:1:2P 10:3:2P 13:1:2P',
        },
      },
      B: {
        d: {
          BD: 'x...x...x...x.x.',
          SD: '....x.......x..o',
          CP: '....x.......x...',
          CH: '-x.x-x.x-x.x-x.x',
          OH: '..o.......o.....',
          CY: '1...............',
          LT: '.............o..',
        },
        n: {
          BA: '0:0:1a 2:0:1 3:1:1s 4:0:1 6:0:1a 8:3:1 10:3:1 11:4:1s 12:3:1a 14:1:1 15:0:1',
          LD: '0:0:2P 3:0:1P 6:1:2P 8:3:2P 11:4:2P 14:3:2P',
        },
      },
      C: {
        d: { CP: '....x.......x...', CH: '-x.x-x.x-x.x-x.x', OH: '..o.......o.....' },
        n: { BA: '0:0:6 6:1:2 8:0:6 14:1:2', LD: '0:0:4P 8:1:4P' },
      },
      D: {
        d: {
          BD: 'x...x...x.x.xxxx',
          SD: '....x.......x...',
          CP: '....x.......x...',
          CH: '-x.x-x.x-x.x....',
          HT: '............o.o.',
          LT: '.............o.o',
        },
        n: {
          BA: '0:0:1a 2:7:1 4:0:1a 6:7:1 8:0:1a 10:7:1 12:0:1a 13:0:1 14:0:1a 15:0:1',
          LD: '0:0:2P 4:0:2P 8:1:2P 12:3:4P',
        },
      },
    },
    song: [
      ['A', 4],
      ['B', 4],
      ['C', 1],
      ['D', 1],
      ['A', 2],
      ['B', 4],
    ],
  },
  {
    // schwer und tief: gebrochene Kick mit Hip-Hop-Schwerpunkt, Snare auf 2 und 4, Wummer-Bass in
    // G#-Moll. Die Sirene zieht lange Töne durch ein Echo wie in einem Keller.
    id: 'berlin-tiefgang',
    name: 'Tiefgang',
    genre: 'berlin',
    hint: 'schwerer Bass, gebrochener Beat, Echo wie im Keller',
    tempo: 130,
    swing: 0.1,
    key: 8,
    scale: 0,
    kit: 'Break',
    drums: { SD: { decay: 0.5 } },
    sound: {
      BA: { p: 'Wummer' },
      LD: { p: 'Sirene', oct: -1, v: { dly: 0.7 } },
    },
    mix: {
      BA: { v: 0.75 },
      LD: { v: 0.5, r: 0.3, p: 0.42 },
      SD: { v: 0.78, r: 0.3 },
      CH: { v: 0.55, p: 0.6 },
      OH: { v: 0.55, p: 0.4 },
      RS: { v: 0.55, p: 0.7, r: 0.35 },
    },
    fx: { size: 0.7, damp: 0.6, ret: 0.5 },
    warm: true,
    tape: 0,
    drumDrive: 0.2,
    pat: {
      A: {
        d: {
          BD: 'x..x......x..x..',
          SD: '....x.......x...',
          CH: '..x..-x...x..-x.',
          OH: '...............o',
          RS: '.......o........',
        },
        n: {
          BA: '0:0:3 3:0:2 6:5:4 10:0:3 13:3:3',
          LD: '2:4:6 10:2:6',
        },
      },
      B: {
        d: {
          BD: 'x..x......x..x..',
          SD: '....x.......x...',
          CH: '..x..-x...x..-x.',
          OH: '...............o',
          RS: '.......o.....o..',
          LT: '.........o......',
        },
        n: {
          BA: '0:0:3 3:0:2 6:5:4 10:2:3 13:4:3',
          LD: '2:7:6 10:5:6',
        },
      },
      C: {
        d: { SD: '............x...', CH: '..x.......x.....', RS: '.......o.......o' },
        n: { BA: '0:0:10 10:5:6', LD: '0:4:12' },
      },
      D: {
        d: {
          BD: 'x..x......x..x.x',
          SD: '....x.......x.oo',
          CH: '..x..-x...x..-x.',
          LT: '..........o.....',
          HT: '.........o......',
        },
        n: {
          BA: '0:0:3 3:0:2 6:5:4 10:0:3 13:6:3',
          LD: '2:4:4 6:5:4 10:7:6',
        },
      },
    },
    song: [
      ['A', 4],
      ['B', 2],
      ['C', 2],
      ['A', 2],
      ['D', 2],
      ['B', 2],
    ],
  },
];
