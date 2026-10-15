const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
import type { OptMap, Pattern, State, StepCond, StepOpt, SubKey, VoiceId } from './types.ts';

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
  { value: 'fill', label: 'Fill' },
  { value: 'notFill', label: 'Nicht Fill' },
];

/** Standardwerte; Locks (t, d, s) haben keinen Standard: fehlt das Feld, folgt der Step der Spur */
const DEFAULT = { v: 1, p: 1, c: 'all' as StepCond };
export type StepOptions = typeof DEFAULT & Pick<StepOpt, 't' | 'd' | 's'>;
/** Änderung von Step-Optionen; undefined entfernt ein Feld (z. B. Lock lösen) */
export type StepOptPatch = { [K in keyof StepOpt]?: StepOpt[K] | undefined };

export const isStepCond = (c: unknown): c is StepCond => STEP_CONDS.some((x) => x.value === c);

/** Optionen eines Steps samt Standardwerten */
export const stepOptOf = (p: Pattern, key: SubKey, step: number): StepOptions => ({
  ...DEFAULT,
  ...p.opt?.[key]?.[step],
});

/** Nur Abweichungen vom Standard, Werte begrenzt; null, wenn nichts abweicht */
export function normalizeOpt(o: StepOpt): StepOpt | null {
  const out: StepOpt = {};
  if (o.v !== undefined && clamp(o.v, 0, 1) !== 1) out.v = clamp(o.v, 0, 1);
  if (o.p !== undefined && clamp(o.p, 0, 1) !== 1) out.p = clamp(o.p, 0, 1);
  if (o.c !== undefined && o.c !== 'all') out.c = o.c;
  for (const k of ['t', 'd', 's'] as const) {
    const x = o[k];
    if (x !== undefined) out[k] = clamp(x, 0, 1);
  }
  return Object.keys(out).length ? out : null;
}

const FIELDS = ['v', 'p', 'c', 't', 'd', 's'] as const;
const sameOpt = (a: StepOpt | undefined, b: StepOpt | null): boolean =>
  (a === undefined && b === null) || (!!a && !!b && FIELDS.every((k) => a[k] === b[k]));

/** Hat der Step einen Parameter-Lock? */
export const hasLock = (o: StepOpt): boolean =>
  o.t !== undefined || o.d !== undefined || o.s !== undefined;

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
export function setStepOpt(state: State, key: SubKey, step: number, patch: StepOptPatch): State {
  const pat = state.patterns[state.cur];
  const merged: StepOptPatch = Object.keys(patch).length
    ? { ...pat.opt?.[key]?.[step], ...patch }
    : {};
  const clean = Object.fromEntries(
    Object.entries(merged).filter(([, x]) => x !== undefined),
  ) as StepOpt;
  const next = withOpt(pat, key, step, normalizeOpt(clean));
  if (next === pat) return state;
  return { ...state, patterns: { ...state.patterns, [state.cur]: next } };
}

/** Spielt ein Step im n-ten Durchlauf (ab 1), bei gehaltener bzw. losgelassener Fill-Taste? */
export function condPasses(c: StepCond, n: number, fill = false): boolean {
  if (c === 'all') return true;
  if (c === 'fill') return fill;
  if (c === 'notFill') return !fill;
  if (c === 'first') return n === 1;
  if (c === 'notFirst') return n > 1;
  const [a, b] = c.split(':').map(Number) as [number, number];
  return ((n - 1) % b) + 1 === a;
}

/** Pegel-Faktor einer Velocity (v²: 50 % ≈ −12 dB) */
export const velocityGain = (v: number): number => v * v;

/** Klingt der Step (gesetzt oder mit Sub-Steps)? Für Drums (Stimme) und Pads (P0–P7). */
export function stepIsOn(p: Pattern, key: SubKey, step: number): boolean {
  if (p.sub[key]?.[step]) return true;
  const row = key.startsWith('P') ? p.smp[Number(key.slice(1))] : p[key as VoiceId];
  return row?.[step] === 1;
}
