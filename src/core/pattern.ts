import { PARTS, VOICE_IDS } from './constants.ts';
import { blankPattern, emptyRow } from './defaults.ts';
import { effectiveLength } from './music.ts';
import type {
  Bit,
  NoteRow,
  Pattern,
  Slot,
  State,
  StepRow,
  SubKey,
  SubMap,
  VoiceId,
} from './types.ts';
import { must } from './util.ts';

export const currentPattern = (state: State): Pattern => state.patterns[state.cur];

export function replacePattern(state: State, slot: Slot, pattern: Pattern): State {
  const patterns = { ...state.patterns };
  patterns[slot] = pattern;
  return { ...state, patterns };
}

const updateCurrent = (state: State, fn: (p: Pattern) => Pattern): State =>
  replacePattern(state, state.cur, fn(currentPattern(state)));

const setBit = (row: StepRow, i: number, b: Bit): StepRow => row.map((x, k) => (k === i ? b : x));

function withRow(p: Pattern, voice: VoiceId, row: StepRow): Pattern {
  const next = { ...p };
  next[voice] = row;
  return next;
}

const withSampleRow = (p: Pattern, pad: number, row: StepRow): Pattern => ({
  ...p,
  smp: p.smp.map((r, i) => (i === pad ? row : r)),
});

export const subStepsOf = (p: Pattern, key: SubKey, step: number): StepRow | null =>
  p.sub[key]?.[step] ?? null;

/** Sub-Steps eines Steps ersetzen (row) oder entfernen (null); leere Einträge verschwinden. */
function withSub(p: Pattern, key: SubKey, step: number, row: StepRow | null): Pattern {
  const steps = Object.fromEntries(
    Object.entries(p.sub[key] ?? {}).filter(([k]) => Number(k) !== step),
  ) as Partial<Record<number, StepRow>>;
  if (row) steps[step] = row;
  // vorhandenen Schlüssel an seiner Stelle ersetzen (Reihenfolge wie Legacy), nur leere entfernen
  const sub: SubMap = Object.keys(steps).length
    ? { ...p.sub, [key]: steps }
    : Object.fromEntries(Object.entries(p.sub).filter(([k]) => k !== key));
  return { ...p, sub };
}

/** Drum-Step umschalten. Vorhandene Sub-Steps werden stattdessen gelöscht (Step aus). */
export function toggleDrumStep(state: State, voice: VoiceId, step: number): State {
  if (subStepsOf(currentPattern(state), voice, step)) {
    return updateCurrent(state, (q) =>
      withRow(withSub(q, voice, step, null), voice, setBit(q[voice], step, 0)),
    );
  }
  const next = updateCurrent(state, (q) =>
    withRow(q, voice, setBit(q[voice], step, q[voice][step] ? 0 : 1)),
  );
  return state.preset ? { ...next, preset: null } : next;
}

/** Sampler-Step umschalten (Preset bleibt, wie in Legacy). */
export function toggleSampleStep(state: State, pad: number, step: number): State {
  const key = `P${pad}` as SubKey;
  return updateCurrent(state, (q) => {
    const row = must(q.smp[pad], `Sampler-Reihe ${pad}`);
    if (subStepsOf(q, key, step)) {
      return withSampleRow(withSub(q, key, step, null), pad, setBit(row, step, 0));
    }
    return withSampleRow(q, pad, setBit(row, step, row[step] ? 0 : 1));
  });
}

/** Sub-Steps eines Steps setzen; eine leere Reihe entfernt den Eintrag. */
export function setSubSteps(state: State, key: SubKey, step: number, row: StepRow): State {
  return updateCurrent(state, (q) => withSub(q, key, step, row.some(Boolean) ? [...row] : null));
}

export function toggleSubStep(state: State, key: SubKey, step: number, k: number): State {
  const cur = subStepsOf(currentPattern(state), key, step) ?? emptyRow();
  return setSubSteps(state, key, step, setBit(cur, k, cur[k] ? 0 : 1));
}

const rowOf = (fn: (k: number) => boolean): StepRow =>
  Array.from({ length: 16 }, (_, k) => (fn(k) ? 1 : 0));

/** Vorlagen des Sub-Step-Editors: Roll, ÷2, ÷4, Leeren */
export const SUB_PATTERNS = {
  roll: () => rowOf(() => true),
  half: () => rowOf((k) => k % 2 === 0),
  quarter: () => rowOf((k) => k % 4 === 0),
  clear: () => rowOf(() => false),
} as const satisfies Record<string, () => StepRow>;

/** Note setzen; Tippen in eine klingende Note derselben Stufe löscht sie. */
export function placeNote(state: State, degree: number, step: number): State {
  const part = state.part;
  const row = currentPattern(state).notes[part];
  let hit = -1;
  for (let a = 0; a <= step; a++) {
    const n = row[a];
    if (n?.d === degree && a + effectiveLength(row, a) > step) hit = a;
  }
  const next: NoteRow = row.slice();
  if (hit >= 0) next[hit] = null;
  else next[step] = { d: degree, l: state.noteLen };
  return updateCurrent(state, (q) => {
    const notes = { ...q.notes };
    notes[part] = next;
    return { ...q, notes };
  });
}

/** Noten des aktuellen Parts leeren (Legacy „Stimme leeren“; Preset bleibt). */
export function clearNotes(state: State): State {
  const part = state.part;
  return updateCurrent(state, (q) => {
    const notes = { ...q.notes };
    notes[part] = new Array<null>(16).fill(null);
    return { ...q, notes };
  });
}

export const clearPattern = (state: State): State => ({
  ...replacePattern(state, state.cur, blankPattern()),
  preset: null,
});

/** Spur der gewählten Drum-Stimme (state.sel) samt Sub-Steps leeren. */
export function clearTrack(state: State): State {
  const voice = must(VOICE_IDS[state.sel], `Stimme ${state.sel}`);
  const next = updateCurrent(state, (q) => {
    const sub = Object.fromEntries(Object.entries(q.sub).filter(([k]) => k !== voice)) as SubMap;
    return { ...withRow(q, voice, emptyRow()), sub };
  });
  return { ...next, preset: null };
}

export const selectSlot = (state: State, slot: Slot): State => ({
  ...state,
  cur: slot,
  preset: null,
});

export const copyPattern = (state: State): Pattern => structuredClone(currentPattern(state));

export const pastePattern = (state: State, clip: Pattern): State => ({
  ...replacePattern(state, state.cur, structuredClone(clip)),
  preset: null,
});

export function patternHasContent(p: Pattern): boolean {
  return (
    VOICE_IDS.some((id) => p[id].some(Boolean)) ||
    PARTS.some((id) => p.notes[id].some(Boolean)) ||
    p.smp.some((r) => r.some(Boolean)) ||
    Object.keys(p.sub).length > 0
  );
}
