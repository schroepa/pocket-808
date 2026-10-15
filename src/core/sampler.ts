import { SMP_RATE } from './constants.ts';
import type { Pad, State } from './types.ts';
import { must } from './util.ts';

/*
 * Sampler-Bedienung als reine Funktionen (Legacy buildSmp, selPad, setSample, clearSample, drawWave):
 * Pad wählen, Werte, Bereichsgriffe mit Mindestabstand, Rückwärts, Laden/Leeren, Wellenform-Spalten.
 */

const GAP = 0.02;

const withPad = (s: State, i: number, fn: (p: Pad) => Pad): State => ({
  ...s,
  smp: { ...s.smp, pads: s.smp.pads.map((p, k) => (k === i ? fn(p) : p)) },
});

export const selectPad = (s: State, i: number): State => ({ ...s, smp: { ...s.smp, sel: i } });

export const setPadValue = (
  s: State,
  i: number,
  key: 'att' | 'dec' | 'tune' | 'lvl',
  v: number,
): State => withPad(s, i, (p) => ({ ...p, [key]: v }));

/** Der nähere Griff wird gegriffen; bei Gleichstand der Start (Legacy). */
export const grabHandle = (p: Pad, f: number): 'start' | 'end' =>
  Math.abs(f - p.start) <= Math.abs(f - p.end) ? 'start' : 'end';

export const movePadHandle = (s: State, i: number, h: 'start' | 'end', f: number): State =>
  withPad(s, i, (p) =>
    h === 'start'
      ? { ...p, start: Math.min(f, p.end - GAP) }
      : { ...p, end: Math.max(f, p.start + GAP) },
  );

export const toggleReverse = (s: State, i: number): State =>
  withPad(s, i, (p) => ({ ...p, rev: !p.rev }));

/** Neues Sample geladen oder aufgenommen: ganzer Bereich, neuer Name */
export const loadedPad = (s: State, i: number, name: string): State =>
  withPad(s, i, (p) => ({ ...p, name, start: 0, end: 1 }));

export const clearedPad = (s: State, i: number): State =>
  withPad(s, i, (p) => ({ ...p, name: '', start: 0, end: 1, rev: false }));

/** Minimum und Maximum je Pixelspalte (Legacy drawWave); leere Spalten ohne Ausschlag */
export function waveColumns(pcm: Float32Array, width: number): { min: number; max: number }[] {
  const per = pcm.length / width;
  return Array.from({ length: width }, (_, x) => {
    const a = Math.floor(x * per);
    const b = Math.min(pcm.length, Math.max(a + 1, Math.floor((x + 1) * per)));
    const slice = pcm.subarray(a, b);
    if (slice.length === 0) return { min: 0, max: 0 };
    let min = 1;
    let max = -1;
    for (const v of slice) {
      min = Math.min(min, v);
      max = Math.max(max, v);
    }
    return { min, max };
  });
}

/** Zusammenfassung im Gerätekopf (Legacy renderSum, Sampler-Teil) */
export function padSummary(s: State, pcm: Float32Array | null): string {
  const p = must(s.smp.pads[s.smp.sel], 'Pad');
  const len = pcm ? ` · ${(pcm.length / SMP_RATE).toFixed(1)} s` : '';
  return `Pad ${s.smp.sel + 1} · ${p.name || 'leer'}${len}`;
}
