import {
  CHANNELS,
  DEFAULT_SENDS,
  DRUM_DEFAULTS,
  PAD_COUNT,
  PAD_DEFAULT,
  PARTS,
  SLOTS,
  STEPS,
  SYN_PRESETS,
  VOICE_IDS,
} from './constants.ts';
import type {
  Bit,
  ChannelId,
  DrumParams,
  Fx,
  MixChannel,
  NoteRow,
  Pad,
  Part,
  Pattern,
  State,
  StepRow,
  SynthPatch,
  VoiceId,
} from './types.ts';
import { must } from './util.ts';

export const emptyRow = (): StepRow => new Array<Bit>(STEPS).fill(0);
export const parsePattern = (s: string): StepRow =>
  Array.from({ length: STEPS }, (_, i) => (s.charAt(i) === 'x' ? 1 : 0));

export function blankPattern(): Pattern {
  const rows = Object.fromEntries(VOICE_IDS.map((id) => [id, emptyRow()])) as Record<
    VoiceId,
    StepRow
  >;
  const notes = Object.fromEntries(
    PARTS.map((id) => [id, new Array<null>(STEPS).fill(null) as NoteRow]),
  ) as Record<Part, NoteRow>;
  return { ...rows, notes, smp: Array.from({ length: PAD_COUNT }, emptyRow), sub: {} };
}

export const drumDefaults = (): Record<VoiceId, DrumParams> =>
  Object.fromEntries(VOICE_IDS.map((id) => [id, { ...DRUM_DEFAULTS[id] }])) as Record<
    VoiceId,
    DrumParams
  >;

export function synthDefaults(): Record<Part, SynthPatch> {
  const ba = must(SYN_PRESETS.BA[1], 'Bass-Preset Acid');
  const ld = must(SYN_PRESETS.LD[0], 'Lead-Preset Saw');
  return {
    BA: { oct: 0, mute: false, preset: ba.name, ...ba.v },
    LD: { oct: 0, mute: false, preset: ld.name, ...ld.v },
  };
}

export const padDefaults = (): Pad[] =>
  Array.from({ length: PAD_COUNT }, () => ({ ...PAD_DEFAULT }));

export const mixDefaults = (): Record<ChannelId, MixChannel> =>
  Object.fromEntries(
    CHANNELS.map((id) => [id, { v: 0.8, p: 0.5, r: DEFAULT_SENDS[id] ?? 0, m: false, s: false }]),
  ) as Record<ChannelId, MixChannel>;

export const fxDefaults = (): Fx => ({ size: 0.4, damp: 0.5, ret: 0.5, dj: 0.5, djq: 0.2 });

/** Legacy-`state` vor init(): alle Patterns leer, Werkseinstellungen. */
export function baseState(): State {
  return {
    tempo: 90,
    swing: 0.35,
    master: 0.8,
    sel: 0,
    patterns: Object.fromEntries(SLOTS.map((k) => [k, blankPattern()])) as State['patterns'],
    cur: 'A',
    song: [],
    mode: 'pattern',
    params: drumDefaults(),
    preset: null,
    key: 9,
    scale: 0,
    part: 'BA',
    noteLen: 1,
    synth: synthDefaults(),
    open: { synth: false, smp: false, mix: false, fx: false },
    smp: { sel: 0, pads: padDefaults() },
    mix: mixDefaults(),
    fx: fxDefaults(),
  };
}
