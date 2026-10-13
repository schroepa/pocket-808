const j = (v: unknown) => JSON.stringify(v);
const ones = () => new Array<number>(16).fill(1);

/** Rohwerte für localStorage['pocket808.v1']. null = nichts gespeichert. */
export const SAVES: Record<string, string | null> = {
  leer: null,
  kaputtesJson: '{nicht json',
  zahl: '42',
  array: '[1,2,3]',
  altFormatEinPattern: j({
    tempo: 128,
    swing: 0.1,
    pat: { BD: 'x...x...x...x...', SD: '....x.......x...' },
  }),
  altFormatKompat: j({
    tempo: 100,
    swing: 0.2,
    master: 0.7,
    sel: 2,
    patterns: {
      A: { BD: 'x...x...x...x...' },
      C: { SD: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0] },
    },
    cur: 'C',
    song: [{ p: 'A', n: 2 }],
    mode: 'pattern',
    params: {},
    preset: null,
  }),
  synthSus: j({ synth: { BA: { sus: 0.3, cut: 0.5, wave: 1 }, LD: { sus: 1, fa: 0.2 } } }),
  synthMute: j({ synth: { BA: { mute: true }, LD: { mute: false } } }),
  grenzwerte: j({
    tempo: 500,
    swing: -1,
    master: 2,
    sel: 99,
    key: 15,
    scale: 99,
    noteLen: 3,
    cur: 'Z',
    mode: 'x',
    part: 'XX',
    song: [{ p: 'A', n: 40 }, { p: 'Q', n: 1 }, null, { p: 'B' }, { p: 'C', n: 0.4 }],
    params: { BD: { level: 2, tune: -1, decay: 'a' } },
  }),
  subUndSampler: j({
    patterns: {
      A: {
        sub: {
          BD: { 0: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0], 16: ones() },
          XX: { 0: ones() },
          P3: { 2: new Array<number>(16).fill(0), 5: ones() },
        },
        smp: Array.from({ length: 8 }, (_, i) => (i === 0 ? ones() : 'kaputt')),
      },
    },
    smp: {
      sel: 3,
      pads: [
        { start: 0.5, end: 0.51, name: 'ein sehr langer Name' },
        { tune: 2, rev: true },
      ],
    },
  }),
  mixUndFx: j({
    mix: { BD: { v: 0.3, p: 0, r: 0.9, m: true, s: false }, LD: { v: 'laut' }, XX: { v: 1 } },
    fx: { size: 0.9, dj: 1.5, unbekannt: 1 },
  }),
  notenAlt: j({
    patterns: {
      B: {
        notes: {
          BA: Array.from({ length: 16 }, (_, i) => (i % 4 === 0 ? { d: i % 12, l: 3.6 } : null)),
          LD: [{ d: 99, l: 1 }],
        },
      },
    },
  }),
};

const b64 = (xs: number[]) => Buffer.from(Int16Array.from(xs).buffer).toString('base64');

/** Rohwert für localStorage['pocket808.smp.v1']: Pad 0 geleert, Pad 5 eigenes Sample, eigenes BD-Sample, Müll. */
export const SAMPLE_STORE = j({
  0: { d: '' },
  5: { d: b64([0, 16383, -16384, 32767]) },
  'D:BD': { d: b64([1000, -1000]), n: 'Mein Kick' },
  'D:XX': { d: b64([1]) },
  9: { d: b64([1]) },
});
