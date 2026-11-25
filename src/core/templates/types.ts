import type {
  ArpSettings,
  ChannelId,
  DrumParams,
  Fx,
  LfoSettings,
  Part,
  Slot,
  SynthValues,
  VoiceId,
} from '../types.ts';

/*
 * Vorlagen: komplette Starter-Projekte je Musikstil. Eine Vorlage beschreibt Tempo, Tonart, Kit,
 * Sounds, Mixer, FX, Klangcharakter und bis zu vier Patterns in einer kompakten Schreibweise
 * (siehe parse.ts). Das Speicherformat bleibt unberührt: Laden erzeugt einen gewöhnlichen Zustand.
 */

export type Genre = 'lofi' | 'hiphop' | 'trap' | 'house' | 'techno';
export const GENRES: readonly { id: Genre; name: string }[] = [
  { id: 'lofi', name: 'Lo-Fi' },
  { id: 'hiphop', name: 'Hip-Hop' },
  { id: 'trap', name: 'Trap' },
  { id: 'house', name: 'House' },
  { id: 'techno', name: 'Techno' },
];

export type KitParams = Partial<Record<VoiceId, Partial<DrumParams>>>;

/** Sound einer Synth-Stimme: Preset beim Namen, dazu Abweichungen */
export interface TemplateSound {
  /** Name aus SYN_PRESETS des Parts */
  p: string;
  oct?: number;
  /** einzelne Reglerwerte abweichend vom Preset */
  v?: Partial<SynthValues>;
  arp?: ArpSettings;
  lfo?: LfoSettings;
}

/** Ein Pattern in Kurzschreibweise (parse.ts) */
export interface TemplatePattern {
  /** Drum-Zeilen, je Step ein Zeichen */
  d: Partial<Record<VoiceId, string>>;
  /** Noten je Part: 'Step:Stufe:Länge' plus Kennbuchstaben, durch Leerzeichen getrennt */
  n?: Partial<Record<Part, string>>;
}

export interface Template {
  id: string;
  name: string;
  genre: Genre;
  /** ein Satz für die Liste: was die Vorlage ausmacht */
  hint: string;
  tempo: number;
  swing: number;
  /** Grundton 0 (C) bis 11 (B) und Index in SCALES */
  key: number;
  scale: number;
  /** Name aus KITS, dazu Abweichungen */
  kit: string;
  drums?: KitParams;
  sound: Record<Part, TemplateSound>;
  /** Abweichungen vom Standard-Mixer (Pegel, Panorama, Reverb-Send) */
  mix?: Partial<Record<ChannelId, { v?: number; p?: number; r?: number }>>;
  fx?: Partial<Fx>;
  warm: boolean;
  tape: number;
  pat: Partial<Record<Slot, TemplatePattern>> & { A: TemplatePattern };
  song: readonly (readonly [Slot, number])[];
}

/** Was eine Vorlage beim Laden ersetzt */
export type TemplateScope = 'all' | 'drums' | 'sound';
export const TEMPLATE_SCOPES: readonly { id: TemplateScope; name: string }[] = [
  { id: 'all', name: 'Alles' },
  { id: 'drums', name: 'Drums' },
  { id: 'sound', name: 'Sound' },
];
