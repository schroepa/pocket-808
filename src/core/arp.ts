import type { Rng } from './random.ts';
import { clamp } from './persist.ts';
import { must } from './util.ts';
import type { ArpMode, ArpSettings, LfoSettings, Part, State, SynthPatch } from './types.ts';

/* Arpeggiator und LFO je Part (Etappe 6b) als reine Funktionen. Beides gehört zum Patch, ändert
   aber die Preset-Markierung nicht: Ein Preset ist die Klangfarbe, Arp und LFO die Spielweise. */

export const ARP_MODES: readonly ArpMode[] = ['up', 'down', 'ud', 'rnd'];
export const ARP_LABELS: Readonly<Record<ArpMode, string>> = {
  up: 'Auf',
  down: 'Ab',
  ud: 'Auf-Ab',
  rnd: 'Zufall',
};

/** Tonvorrat: Töne aufsteigend, bei 2 Oktaven dieselben Töne +12 dazu */
export function arpPool(midis: readonly number[], o: 1 | 2): number[] {
  const up = [...midis].sort((a, b) => a - b);
  return o === 2 ? [...up, ...up.map((m) => m + 12)] : up;
}

/** `count` Töne des Arps über den Tönen einer Note; die Folge beginnt vorn */
export function arpSequence(
  midis: readonly number[],
  a: ArpSettings,
  count: number,
  rnd: Rng,
): number[] {
  const pool = arpPool(midis, a.o);
  let cycle: number[];
  if (a.m === 'down') cycle = [...pool].reverse();
  else if (a.m === 'ud' && pool.length > 2) cycle = [...pool, ...pool.slice(1, -1).reverse()];
  else cycle = pool;
  return Array.from({ length: count }, (_, i) =>
    must(
      a.m === 'rnd' ? pool[Math.floor(rnd() * pool.length)] : cycle[i % cycle.length],
      'Arp-Ton',
    ),
  );
}

/** LFO-Rate in Hz: 0,1 Hz bis rund 19 Hz */
export const lfoHz = (r: number): number => 0.1 * Math.pow(2, r * 7.6);

/** Hub in Cent: Cutoff bis ±2 Oktaven, Pitch bis ±1 Halbton */
export const lfoCents = (l: LfoSettings): number => l.d * (l.t === 'cut' ? 2400 : 100);

const withPatch = (s: State, part: Part, fn: (p: SynthPatch) => SynthPatch): State => ({
  ...s,
  synth: { ...s.synth, [part]: fn(s.synth[part]) },
});

/** Arp setzen; `undefined` schaltet ihn aus (Feld entfällt) */
export const setArp = (s: State, part: Part, a: ArpSettings | undefined): State =>
  withPatch(s, part, (p) => {
    const next = { ...p };
    if (a) next.arp = { ...a };
    else delete next.arp;
    return next;
  });

/** LFO ändern; fehlende Werte: Rate 0,5, Depth 0, Ziel Cutoff */
export const setLfo = (s: State, part: Part, patch: Partial<LfoSettings>): State =>
  withPatch(s, part, (p) => {
    const l = { r: 0.5, d: 0, t: 'cut' as const, ...p.lfo, ...patch };
    return { ...p, lfo: { r: clamp(l.r, 0, 1), d: clamp(l.d, 0, 1), t: l.t } };
  });
