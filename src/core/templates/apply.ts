import { CHANNELS, DRUM_DEFAULTS, PARTS, VOICE_IDS } from '../constants.ts';
import { fxDefaults, mixDefaults } from '../defaults.ts';
import { keepOpt } from '../stepopts.ts';
import { setTape, setWarm } from '../tone.ts';
import type {
  DrumParams,
  OptMap,
  Part,
  Pattern,
  Slot,
  State,
  SubMap,
  SynthPatch,
  VoiceId,
} from '../types.ts';
import { must } from '../util.ts';
import { KITS } from './kits.ts';
import { parseTemplatePattern } from './parse.ts';
import { SYNTH_SOUNDS } from './sounds.ts';
import type { KitParams, Template, TemplateScope, TemplateSound } from './types.ts';

/** Kit-Werte über den Werkseinstellungen; fehlende Stimmen und Werte bleiben beim Standard */
export function kitParams(...layers: readonly KitParams[]): Record<VoiceId, DrumParams> {
  return Object.fromEntries(
    VOICE_IDS.map((id) => [
      id,
      Object.assign({ ...DRUM_DEFAULTS[id] }, ...layers.map((l) => l[id] ?? {})) as DrumParams,
    ]),
  ) as Record<VoiceId, DrumParams>;
}

export const kitByName = (name: string): KitParams =>
  must(
    KITS.find((k) => k.name === name),
    `Kit ${name}`,
  ).v;

/** Kit laden: Level, Tune und Decay aller Stimmen */
export const applyKit = (s: State, kit: KitParams): State => ({ ...s, params: kitParams(kit) });

/** Sound einer Vorlage → Patch (Preset, Abweichungen, Oktave, Arp, LFO) */
export function soundPatch(part: Part, snd: TemplateSound): SynthPatch {
  const preset = must(
    SYNTH_SOUNDS[part].find((p) => p.name === snd.p),
    `Preset ${part} ${snd.p}`,
  );
  return {
    oct: snd.oct ?? 0,
    mute: false,
    // mit Abweichungen ist es nicht mehr das reine Preset
    preset: snd.v ? null : preset.name,
    ...preset.v,
    ...snd.v,
    ...(snd.arp ? { arp: { ...snd.arp } } : {}),
    ...(snd.lfo ? { lfo: { ...snd.lfo } } : {}),
  };
}

const slotsOf = (t: Template): Slot[] => Object.keys(t.pat) as Slot[];
const isPadKey = (k: string): boolean => k.startsWith('P');

/** Drums der Vorlage in ein bestehendes Pattern: Noten, Sampler-Steps und Pad-Optionen bleiben */
function mergeDrums(old: Pattern, tpl: Pattern): Pattern {
  const next: Pattern = { ...old };
  for (const id of VOICE_IDS) next[id] = tpl[id];
  const pads = Object.fromEntries(Object.entries(old.sub).filter(([k]) => isPadKey(k))) as SubMap;
  next.sub = { ...pads, ...tpl.sub };
  const opt: OptMap = { ...keepOpt(old, isPadKey), ...tpl.opt };
  if (Object.keys(opt).length) next.opt = opt;
  else delete next.opt;
  return next;
}

function withSound(s: State, t: Template): State {
  const mix = mixDefaults();
  // der Sampler-Kanal gehört den eigenen Samples: unverändert übernehmen
  mix.SM = { ...s.mix.SM };
  for (const id of CHANNELS) {
    const m = t.mix?.[id];
    if (m) Object.assign(mix[id], m);
  }
  const synth = Object.fromEntries(PARTS.map((p) => [p, soundPatch(p, t.sound[p])])) as Record<
    Part,
    SynthPatch
  >;
  const next: State = {
    ...s,
    params: kitParams(kitByName(t.kit), t.drums ?? {}),
    synth,
    mix,
    fx: { ...fxDefaults(), ...t.fx },
  };
  return setTape(setWarm(next, t.warm), t.tape);
}

function withPatterns(s: State, t: Template, drumsOnly: boolean): State {
  const patterns = { ...s.patterns };
  for (const slot of slotsOf(t)) {
    const parsed = parseTemplatePattern(must(t.pat[slot], `Pattern ${slot}`));
    patterns[slot] = drumsOnly ? mergeDrums(s.patterns[slot], parsed) : parsed;
  }
  return { ...s, patterns, tempo: t.tempo, swing: t.swing, preset: t.name };
}

/**
 * Vorlage laden.
 * - 'all': Tempo, Swing, Tonart, Patterns der Vorlage (A bis höchstens D), Kit, Sounds, Mixer, FX,
 *   Klangcharakter und Song-Kette. Übrige Pattern-Plätze und der Sampler bleiben.
 * - 'drums': nur die Drum-Spuren dieser Patterns, dazu Kit, Tempo und Swing.
 * - 'sound': nur Kit, Sounds, Mixer, FX und Klangcharakter.
 */
export function applyTemplate(s: State, t: Template, scope: TemplateScope): State {
  if (scope === 'sound') return withSound(s, t);
  if (scope === 'drums')
    return { ...withPatterns(s, t, true), params: kitParams(kitByName(t.kit), t.drums ?? {}) };
  return {
    ...withPatterns(withSound(s, t), t, false),
    key: t.key,
    scale: t.scale,
    cur: 'A',
    song: t.song.map(([p, n]) => ({ p, n })),
  };
}
