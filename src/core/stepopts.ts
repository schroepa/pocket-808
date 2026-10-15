const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
import type { OptMap, Pattern, State, StepCond, StepOpt, SubKey } from './types.ts';

/** Bedingungen in der Reihenfolge der Auswahl */
export const STEP_CONDS: readonly { value: StepCond; label: string }[] = [
  { value: 'all', label: 'Immer' },
  { value: '1:2', label: '1:2' },
  { value: '2:2', label: '2:2' },
  { value: '1:3', label: '1:3' },
  { value: '2:3', label: '2:3' },
  { value: '3:3', label: '3:3' },
  { value: '1:4', label: '1:4' },
  { value: '2:4', label: '2:4' },
  { value: '3:4', label: '3:4' },
  { value: '4:4', label: '4:4' },
  { value: 'first', label: 'Erster' },
  { value: 'notFirst', label: 'Nicht erster' },
];

const DEFAULT: Required<StepOpt> = { v: 1, p: 1, c: 'all' };

export const isStepCond = (c: unknown): c is StepCond => STEP_CONDS.some((x) => x.value === c);

/** Optionen eines Steps samt Standardwerten */
export const stepOptOf = (p: Pattern, key: SubKey, step: number): Required<StepOpt> => ({
  ...DEFAULT,
  ...p.opt?.[key]?.[step],
});

/** Nur Abweichungen vom Standard, Werte begrenzt; null, wenn nichts abweicht */
export function normalizeOpt(o: StepOpt): StepOpt | null {
  const out: StepOpt = {};
  if (o.v !== undefined && clamp(o.v, 0, 1) !== 1) out.v = clamp(o.v, 0, 1);
  if (o.p !== undefined && clamp(o.p, 0, 1) !== 1) out.p = clamp(o.p, 0, 1);
  if (o.c !== undefined && o.c !== 'all') out.c = o.c;
  return Object.keys(out).length ? out : null;
}

const sameOpt = (a: StepOpt | undefined, b: StepOpt | null): boolean =>
  (a === undefined && b === null) || (!!a && !!b && a.v === b.v && a.p === b.p && a.c === b.c);

/** Pattern mit neuer OptMap; eine leere Map entfernt das Feld */
function withMap(p: Pattern, map: OptMap): Pattern {
  const next = { ...p };
  if (Object.keys(map).length) next.opt = map;
  else delete next.opt;
  return next;
}

/** Optionen eines Steps setzen (o) oder entfernen (null) */
export function withOpt(p: Pattern, key: SubKey, step: number, o: StepOpt | null): Pattern {
  const cur = p.opt?.[key]?.[step];
  if (sameOpt(cur, o)) return p;
  const steps = Object.fromEntries(
    Object.entries(p.opt?.[key] ?? {}).filter(([k]) => Number(k) !== step),
  ) as Partial<Record<number, StepOpt>>;
  if (o) steps[step] = o;
  const rest = Object.fromEntries(Object.entries(p.opt ?? {}).filter(([k]) => k !== key)) as OptMap;
  return withMap(p, Object.keys(steps).length ? { ...rest, [key]: steps } : rest);
}

/** alle Optionen eines Schlüssels (Stimme bzw. Pad) entfernen */
export function withoutKeyOpt(p: Pattern, key: SubKey): Pattern {
  if (!p.opt?.[key]) return p;
  return withMap(p, Object.fromEntries(Object.entries(p.opt).filter(([k]) => k !== key)));
}

/** nur die Optionen behalten, deren Schlüssel keep erfüllt */
export const keepOpt = (p: Pattern, keep: (key: string) => boolean): OptMap =>
  Object.fromEntries(Object.entries(p.opt ?? {}).filter(([k]) => keep(k)));

/**
 * Optionen eines Steps im aktuellen Pattern ändern: patch wird eingemischt; ein leerer patch setzt den
 * Step auf den Standard zurück.
 */
export function setStepOpt(state: State, key: SubKey, step: number, patch: StepOpt): State {
  const pat = state.patterns[state.cur];
  const merged = Object.keys(patch).length ? { ...pat.opt?.[key]?.[step], ...patch } : {};
  const next = withOpt(pat, key, step, normalizeOpt(merged));
  if (next === pat) return state;
  return { ...state, patterns: { ...state.patterns, [state.cur]: next } };
}

/** Spielt ein Step im n-ten Durchlauf (ab 1)? */
export function condPasses(c: StepCond, n: number): boolean {
  if (c === 'all') return true;
  if (c === 'first') return n === 1;
  if (c === 'notFirst') return n > 1;
  const [a, b] = c.split(':').map(Number) as [number, number];
  return ((n - 1) % b) + 1 === a;
}

/** Pegel-Faktor einer Velocity (v²: 50 % ≈ −12 dB) */
export const velocityGain = (v: number): number => v * v;
