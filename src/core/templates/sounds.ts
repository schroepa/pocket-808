import { SYN_PRESETS } from '../constants.ts';
import type { Part, PartFx, SynthValues } from '../types.ts';
import { must } from '../util.ts';

/*
 * Synth-Sounds: die drei Werks-Presets je Stimme (SYN_PRESETS, unverändert) plus weitere, nach
 * Charakter abgestimmt. Reihenfolge der Werte wie in SYN_PRESETS.
 */

export interface SynthSound {
  name: string;
  v: Readonly<SynthValues>;
  fx?: Readonly<PartFx>;
}
type Sound = Pick<SynthSound, 'name' | 'v'>;

const v = (
  wave: number,
  cut: number,
  res: number,
  env: number,
  f: readonly [number, number, number, number],
  a: readonly [number, number, number, number],
  det: number,
  sub: number,
  dly: number,
  lvl: number,
): SynthValues => ({
  wave,
  cut,
  res,
  env,
  fa: f[0],
  fd: f[1],
  fs: f[2],
  fr: f[3],
  aa: a[0],
  ad: a[1],
  as: a[2],
  ar: a[3],
  det,
  sub,
  dly,
  lvl,
});

const BASS: readonly Sound[] = [
  // langer, tiefer Sinus wie eine gestimmte 808
  { name: '808', v: v(3, 0.5, 0, 0.15, [0, 0.4, 0.3, 0.3], [0, 0.75, 0.55, 0.35], 0, 0.5, 0, 0.9) },
  // zwei stark verstimmte Sägen, dunkel gefiltert
  {
    name: 'Reese',
    v: v(0, 0.3, 0.15, 0.1, [0, 0.4, 0.6, 0.3], [0.02, 0.5, 0.9, 0.25], 0.85, 0.3, 0, 0.7),
  },
  // runder House-Bass
  {
    name: 'Deep',
    v: v(2, 0.4, 0.1, 0.3, [0, 0.25, 0.2, 0.15], [0, 0.35, 0.5, 0.15], 0.1, 0.4, 0, 0.85),
  },
  // kurzes Rechteck mit Filter-Schnapp
  {
    name: 'Rubber',
    v: v(1, 0.3, 0.35, 0.5, [0, 0.18, 0.1, 0.1], [0, 0.3, 0.3, 0.1], 0, 0.25, 0, 0.8),
  },
  // weicher Bass für ruhige Beats
  {
    name: 'Mellow',
    v: v(2, 0.32, 0.05, 0.15, [0.02, 0.3, 0.4, 0.25], [0.02, 0.5, 0.75, 0.25], 0.05, 0.5, 0, 0.85),
  },
  // offene, sägende Säge, leicht verstimmt
  {
    name: 'Kreissäge',
    v: v(0, 0.55, 0.2, 0.2, [0, 0.35, 0.55, 0.15], [0, 0.4, 0.8, 0.12], 0.35, 0.25, 0, 0.75),
  },
  // kurzes, hohles Rechteck ohne Sub, kaum Filterbewegung
  {
    name: 'Roboter',
    v: v(1, 0.42, 0.15, 0.1, [0, 0.15, 0.5, 0.08], [0, 0.2, 0.6, 0.06], 0, 0, 0, 0.7),
  },
  // tiefer, langer Sinus mit viel Sub
  {
    name: 'Wummer',
    v: v(3, 0.35, 0, 0.05, [0, 0.5, 0.6, 0.4], [0.01, 0.8, 0.85, 0.45], 0, 0.85, 0, 0.75),
  },
  // resonante Säge, die beim Filter-Schließen knurrt
  {
    name: 'Knurr',
    v: v(0, 0.28, 0.65, 0.5, [0.02, 0.35, 0.25, 0.15], [0, 0.5, 0.75, 0.12], 0.15, 0.25, 0, 0.7),
  },
  // hartes, gedrücktes Rechteck: schneller Schlag, dann voller Pegel
  {
    name: 'Beton',
    v: v(1, 0.34, 0.2, 0.4, [0, 0.12, 0.2, 0.08], [0, 0.25, 0.85, 0.08], 0.05, 0.5, 0, 0.7),
  },
];

const LEAD: readonly Sound[] = [
  // E-Piano-artig: weicher Anschlag, klingt aus
  {
    name: 'Keys',
    v: v(2, 0.55, 0.05, 0.35, [0, 0.35, 0.2, 0.3], [0.01, 0.55, 0.3, 0.35], 0.25, 0, 0.25, 0.6),
  },
  // langsame Fläche
  {
    name: 'Pad',
    v: v(0, 0.42, 0.1, 0.2, [0.45, 0.5, 0.7, 0.5], [0.4, 0.5, 0.9, 0.55], 0.5, 0, 0.3, 0.5),
  },
  // kurzer Akkord-Stab
  {
    name: 'Stab',
    v: v(0, 0.5, 0.2, 0.5, [0, 0.22, 0.05, 0.15], [0, 0.28, 0.1, 0.18], 0.35, 0, 0.35, 0.55),
  },
  // heller Sinus mit langem Ausklang
  {
    name: 'Bell',
    v: v(3, 0.8, 0, 0.1, [0, 0.3, 0.2, 0.4], [0, 0.45, 0.05, 0.45], 0.3, 0, 0.45, 0.55),
  },
  // quäkendes Rechteck mit viel Resonanz
  {
    name: 'Squelch',
    v: v(1, 0.35, 0.6, 0.65, [0, 0.25, 0.1, 0.15], [0, 0.4, 0.4, 0.15], 0.05, 0, 0.3, 0.5),
  },
  // sanfte Melodiestimme
  {
    name: 'Flute',
    v: v(2, 0.6, 0.05, 0.1, [0.08, 0.4, 0.7, 0.3], [0.08, 0.5, 0.8, 0.3], 0.15, 0, 0.4, 0.55),
  },
  // kaltes Rechteck ohne Delay
  {
    name: 'Neon',
    v: v(1, 0.72, 0.15, 0.1, [0, 0.2, 0.6, 0.1], [0, 0.3, 0.7, 0.12], 0.05, 0, 0, 0.5),
  },
  // stehender Ton mit Unteroktave, Breite durch den Chorus
  {
    name: 'Orgel',
    v: v(2, 0.7, 0, 0, [0, 0.3, 1, 0.15], [0.02, 0.3, 1, 0.15], 0.2, 0.35, 0.1, 0.55),
  },
  // hohe Resonanz mit langsamem Filter-Attack: der Ton gleitet nach oben
  {
    name: 'Sirene',
    v: v(0, 0.35, 0.75, 0.55, [0.6, 0.6, 0.7, 0.4], [0.05, 0.5, 0.85, 0.35], 0.1, 0, 0.35, 0.5),
  },
  // zarter, heller Anschlag, der im Delay weiterklingt
  {
    name: 'Glas',
    v: v(2, 0.85, 0.1, 0.15, [0, 0.3, 0.2, 0.4], [0.005, 0.4, 0.2, 0.4], 0.12, 0, 0.55, 0.5),
  },
  // kurzer, verzerrter Stab
  {
    name: 'Zerre',
    v: v(0, 0.5, 0.3, 0.4, [0, 0.18, 0.1, 0.1], [0, 0.25, 0.15, 0.1], 0.3, 0, 0.2, 0.6),
  },
];

/** Drive und Chorus je Sound, nach Charakter: Bässe vor allem Drive, Flächen und Leads Chorus */
const FX: Readonly<Record<Part, Readonly<Record<string, Readonly<PartFx>>>>> = {
  BA: {
    Sub: { drive: 0.15 },
    Acid: { drive: 0.5 },
    Pluck: { drive: 0.25, chorus: 0.15 },
    '808': { drive: 0.35 },
    Reese: { drive: 0.3, chorus: 0.45 },
    Deep: { drive: 0.2, chorus: 0.1 },
    Rubber: { drive: 0.3 },
    Mellow: { drive: 0.1, chorus: 0.25 },
    Kreissäge: { drive: 0.55, chorus: 0.15 },
    Roboter: { drive: 0.3 },
    Wummer: { drive: 0.2 },
    Knurr: { drive: 0.65 },
    Beton: { drive: 0.45 },
  },
  LD: {
    Saw: { drive: 0.15, chorus: 0.45 },
    Pulse: { drive: 0.2, chorus: 0.3 },
    Soft: { chorus: 0.5 },
    Keys: { drive: 0.1, chorus: 0.4 },
    Pad: { chorus: 0.8 },
    Stab: { drive: 0.25, chorus: 0.4 },
    Bell: { chorus: 0.35 },
    Squelch: { drive: 0.4 },
    Flute: { chorus: 0.25 },
    Neon: { drive: 0.15, chorus: 0.2 },
    Orgel: { drive: 0.1, chorus: 0.65 },
    Sirene: { drive: 0.25, chorus: 0.3 },
    Glas: { chorus: 0.35 },
    Zerre: { drive: 0.7, chorus: 0.2 },
  },
};

const withFx = (part: Part, list: readonly Sound[]): readonly SynthSound[] =>
  list.map((s) => ({ ...s, fx: must(FX[part][s.name], `Effekt ${s.name}`) }));

export const SYNTH_SOUNDS: Readonly<Record<Part, readonly SynthSound[]>> = {
  BA: withFx('BA', [...SYN_PRESETS.BA, ...BASS]),
  LD: withFx('LD', [...SYN_PRESETS.LD, ...LEAD]),
};
