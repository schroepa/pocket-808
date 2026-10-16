import type {
  ChannelId,
  DrumParams,
  Pad,
  Part,
  Preset,
  Slot,
  SynthKey,
  SynthValues,
  VoiceId,
} from './types.ts';

export const STEPS = 16;
export const PAD_COUNT = 8;
export const ROWS = 12;
/** App-Version (gleich package.json, Werkzeugtest), steht in Projektdateien */
export const APP_VERSION = '0.20.0';
export const STORAGE_KEY = 'pocket808.v1';
export const SAMPLE_STORAGE_KEY = 'pocket808.smp.v1';

export const VOICES: readonly { id: VoiceId; name: string }[] = [
  { id: 'BD', name: 'Bass Drum' },
  { id: 'SD', name: 'Snare Drum' },
  { id: 'LT', name: 'Low Tom' },
  { id: 'HT', name: 'High Tom' },
  { id: 'RS', name: 'Rim Shot' },
  { id: 'CP', name: 'Hand Clap' },
  { id: 'CB', name: 'Cowbell' },
  { id: 'CH', name: 'Closed Hi-Hat' },
  { id: 'OH', name: 'Open Hi-Hat' },
  { id: 'CY', name: 'Cymbal' },
];
export const VOICE_IDS: readonly VoiceId[] = VOICES.map((v) => v.id);

export const DRUM_DEFAULTS: Readonly<Record<VoiceId, Readonly<DrumParams>>> = {
  BD: { level: 0.9, tune: 0.5, decay: 0.55 },
  SD: { level: 0.8, tune: 0.5, decay: 0.45 },
  LT: { level: 0.8, tune: 0.5, decay: 0.5 },
  HT: { level: 0.8, tune: 0.5, decay: 0.45 },
  RS: { level: 0.7, tune: 0.5, decay: 0.4 },
  CP: { level: 0.8, tune: 0.5, decay: 0.5 },
  CB: { level: 0.7, tune: 0.5, decay: 0.4 },
  CH: { level: 0.7, tune: 0.5, decay: 0.4 },
  OH: { level: 0.7, tune: 0.5, decay: 0.5 },
  CY: { level: 0.6, tune: 0.5, decay: 0.5 },
};

export const PRESETS: readonly Preset[] = [
  {
    name: 'House',
    tempo: 124,
    swing: 0,
    pat: {
      BD: 'x...x...x...x...',
      CP: '....x.......x...',
      CH: 'x.x.x.x.x.x.x.x.',
      OH: '..x...x...x...x.',
    },
  },
  {
    name: 'Electro',
    tempo: 128,
    swing: 0,
    pat: {
      BD: 'x..x..x...x..x..',
      CP: '....x.......x...',
      HT: '...x.......x..x.',
      CH: 'x.x.x.x.x.x.x.x.',
      CB: '..x.....x.......',
    },
  },
  {
    name: 'Hip-Hop',
    tempo: 90,
    swing: 0.35,
    pat: {
      BD: 'x.....x.x.....x.',
      SD: '....x.......x...',
      RS: '.........x......',
      CH: 'x.x.x.x.x.x.x.x.',
      OH: '..............x.',
    },
  },
  {
    name: 'Trap',
    tempo: 140,
    swing: 0,
    pat: {
      BD: 'x.....x...x.....',
      SD: '........x.......',
      CP: '........x.......',
      CH: 'x.x.x.x.xxx.x.xx',
      OH: '..............x.',
    },
  },
];

export const SLOTS: readonly Slot[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
export const SEED_B: Partial<Record<VoiceId, string>> = {
  BD: 'x.....x.x..x..x.',
  SD: '....x.......x.xx',
  RS: '.........x......',
  CH: 'x.x.x.x.x.x.x.x.',
  OH: '..............x.',
  CY: 'x...............',
};
/** [Step, Stufe, Länge in Steps] */
export const SEED_NOTES: Readonly<
  Record<'A' | 'B', Record<Part, readonly (readonly [number, number, number])[]>>
> = {
  A: {
    BA: [
      [0, 0, 2],
      [6, 0, 1],
      [8, 3, 2],
      [14, 2, 1],
    ],
    LD: [
      [4, 2, 1],
      [7, 4, 1],
      [10, 3, 2],
      [12, 0, 2],
    ],
  },
  B: {
    BA: [
      [0, 0, 1],
      [3, 0, 1],
      [6, 0, 1],
      [8, 5, 2],
      [11, 4, 1],
      [14, 3, 2],
    ],
    LD: [
      [0, 4, 2],
      [4, 2, 2],
      [8, 3, 1],
      [10, 2, 1],
      [12, 4, 4],
    ],
  },
};

export const PARTS: readonly Part[] = ['BA', 'LD'];
export const PART_NAMES: Readonly<Record<Part, string>> = { BA: 'Bass', LD: 'Lead' };
/** Oktave des Grundtons je Part */
export const PART_BASE: Readonly<Record<Part, number>> = { BA: 2, LD: 4 };
export const NOTE_NAMES: readonly string[] = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
];
export const SCALES: readonly { name: string; s: readonly number[] }[] = [
  { name: 'Moll', s: [0, 2, 3, 5, 7, 8, 10] },
  { name: 'Dur', s: [0, 2, 4, 5, 7, 9, 11] },
  { name: 'Dorisch', s: [0, 2, 3, 5, 7, 9, 10] },
  { name: 'Phrygisch', s: [0, 1, 3, 5, 7, 8, 10] },
  { name: 'Moll-Pentatonik', s: [0, 3, 5, 7, 10] },
  { name: 'Dur-Pentatonik', s: [0, 2, 4, 7, 9] },
];
export const WAVES: readonly (readonly [label: string, type: OscillatorType])[] = [
  ['Saw', 'sawtooth'],
  ['Square', 'square'],
  ['Tri', 'triangle'],
  ['Sine', 'sine'],
];
export const SYN_KEYS: readonly SynthKey[] = [
  'cut',
  'res',
  'env',
  'fa',
  'fd',
  'fs',
  'fr',
  'aa',
  'ad',
  'as',
  'ar',
  'det',
  'sub',
  'dly',
  'lvl',
];
export const SYN_PRESETS: Readonly<
  Record<Part, readonly { name: string; v: Readonly<SynthValues> }[]>
> = {
  BA: [
    {
      name: 'Sub',
      v: {
        wave: 3,
        cut: 0.45,
        res: 0.05,
        env: 0.1,
        fa: 0,
        fd: 0.3,
        fs: 0.5,
        fr: 0.2,
        aa: 0,
        ad: 0.5,
        as: 0.9,
        ar: 0.2,
        det: 0,
        sub: 0.45,
        dly: 0,
        lvl: 0.85,
      },
    },
    {
      name: 'Acid',
      v: {
        wave: 0,
        cut: 0.26,
        res: 0.55,
        env: 0.7,
        fa: 0,
        fd: 0.28,
        fs: 0,
        fr: 0.15,
        aa: 0,
        ad: 0.6,
        as: 0.5,
        ar: 0.15,
        det: 0,
        sub: 0.3,
        dly: 0,
        lvl: 0.75,
      },
    },
    {
      name: 'Pluck',
      v: {
        wave: 1,
        cut: 0.38,
        res: 0.25,
        env: 0.55,
        fa: 0,
        fd: 0.22,
        fs: 0,
        fr: 0.1,
        aa: 0,
        ad: 0.3,
        as: 0.15,
        ar: 0.12,
        det: 0.1,
        sub: 0.35,
        dly: 0,
        lvl: 0.8,
      },
    },
  ],
  LD: [
    {
      name: 'Saw',
      v: {
        wave: 0,
        cut: 0.62,
        res: 0.2,
        env: 0.3,
        fa: 0.02,
        fd: 0.35,
        fs: 0.3,
        fr: 0.3,
        aa: 0.02,
        ad: 0.5,
        as: 0.65,
        ar: 0.3,
        det: 0.4,
        sub: 0,
        dly: 0.3,
        lvl: 0.6,
      },
    },
    {
      name: 'Pulse',
      v: {
        wave: 1,
        cut: 0.55,
        res: 0.3,
        env: 0.45,
        fa: 0,
        fd: 0.3,
        fs: 0.1,
        fr: 0.2,
        aa: 0,
        ad: 0.4,
        as: 0.35,
        ar: 0.25,
        det: 0.2,
        sub: 0,
        dly: 0.35,
        lvl: 0.55,
      },
    },
    {
      name: 'Soft',
      v: {
        wave: 2,
        cut: 0.7,
        res: 0.05,
        env: 0.1,
        fa: 0.1,
        fd: 0.4,
        fs: 0.6,
        fr: 0.4,
        aa: 0.15,
        ad: 0.5,
        as: 0.85,
        ar: 0.4,
        det: 0.2,
        sub: 0,
        dly: 0.45,
        lvl: 0.65,
      },
    },
  ],
};

/** Sampler: 22,05-kHz-Mono-PCM, höchstens 3 s */
export const SMP_RATE = 22050;
export const SMP_MAX = 3;
export const PAD_DEFAULT: Readonly<Pad> = {
  name: '',
  start: 0,
  end: 1,
  tune: 0.5,
  att: 0,
  dec: 1,
  lvl: 0.8,
  rev: false,
};
export const FACTORY_NAMES: readonly string[] = ['Stab', 'Zap', 'Riser', 'Bell'];

/** Mixer: ein Kanal pro Drum-Stimme plus Bass, Lead und Sampler */
export const CHANNELS: readonly ChannelId[] = [...VOICE_IDS, 'BA', 'LD', 'SM'];
export const CHANNEL_NAMES: Readonly<Record<ChannelId, string>> = {
  ...(Object.fromEntries(VOICES.map((v) => [v.id, v.name])) as Record<VoiceId, string>),
  BA: 'Bass',
  LD: 'Lead',
  SM: 'Sampler',
};
/** voreingestellte Reverb-Sends */
export const DEFAULT_SENDS: Readonly<Partial<Record<ChannelId, number>>> = {
  SD: 0.2,
  RS: 0.15,
  CP: 0.3,
  LD: 0.15,
  SM: 0.15,
};
