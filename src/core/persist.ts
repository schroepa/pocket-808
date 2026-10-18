import { CHANNELS, PARTS, ROWS, SCALES, SLOTS, SYN_KEYS, VOICE_IDS, WAVES } from './constants.ts';
import { blankPattern, emptyRow, parsePattern } from './defaults.ts';
import { SCENE_COUNT } from './scenes.ts';
import { isStepCond, normalizeOpt } from './stepopts.ts';
import type {
  ChordKind,
  Fx,
  Note,
  NoteRow,
  OptMap,
  Pattern,
  SceneMix,
  Slot,
  State,
  StepRow,
  SubKey,
} from './types.ts';
import { must } from './util.ts';

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null;
const isArr = (v: unknown): v is unknown[] => Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number';
const isInt = (v: unknown): v is number => Number.isInteger(v);
const isSlot = (v: unknown): v is Slot =>
  typeof v === 'string' && (SLOTS as readonly string[]).includes(v);
const bits = (a: unknown[]): StepRow => a.map((x) => (x ? 1 : 0));
const PAD_SUB_KEY = /^P[0-7]$/;
const CHORD_KINDS: readonly ChordKind[] = ['tri', 'sev', 'pow', 'oct'];

export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** Rohwert aus localStorage → Objekt oder null (wie Legacy loadStored). */
export function parseStored(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function readNotes(a: unknown): NoteRow | null {
  if (!isArr(a) || a.length !== 16) return null;
  return a.map((n) => {
    if (!isObj(n) || !isInt(n.d) || n.d < 0 || n.d >= ROWS) return null;
    const note: Note = { d: n.d, l: clamp(Math.round(Number(n.l)) || 1, 1, 16) };
    // Attribute (Etappe 6a) nur, wenn gültig: alte Noten bleiben { d, l }
    if (n.a === true) note.a = true;
    if (n.s === true) note.s = true;
    if (CHORD_KINDS.includes(n.ch as ChordKind)) note.ch = n.ch as ChordKind;
    return note;
  });
}

function readPattern(o: unknown, prev: Pattern): Pattern {
  const p = blankPattern();
  const src = isObj(o) ? o : undefined;
  if (src) {
    for (const id of VOICE_IDS) {
      const a = src[id];
      if (typeof a === 'string') p[id] = parsePattern(a);
      else if (isArr(a) && a.length === 16) p[id] = bits(a);
    }
  }
  const notes = src?.notes;
  if (isObj(notes)) {
    for (const id of PARTS) {
      const row = readNotes(notes[id]);
      if (row) p.notes[id] = row;
    }
  } else p.notes = prev.notes;
  const smp = src?.smp;
  if (isArr(smp) && smp.length === 8) {
    p.smp = smp.map((r) => (isArr(r) && r.length === 16 ? bits(r) : emptyRow()));
  } else p.smp = prev.smp;
  const sub = src?.sub;
  if (isObj(sub)) {
    for (const key of Object.keys(sub)) {
      if (!((VOICE_IDS as readonly string[]).includes(key) || PAD_SUB_KEY.test(key))) continue;
      const m = sub[key];
      if (!isObj(m)) continue;
      for (const st of Object.keys(m)) {
        const n = Number(st);
        const a = m[st];
        if (isInt(n) && n >= 0 && n < 16 && isArr(a) && a.length === 16 && a.some(Boolean)) {
          (p.sub[key as SubKey] ??= {})[n] = bits(a);
        }
      }
    }
  } else p.sub = prev.sub;
  const opt = src?.opt;
  if (isObj(opt)) {
    const map = readOpt(opt);
    if (map) p.opt = map;
  } else if (prev.opt) p.opt = prev.opt;
  return p;
}

/** Step-Optionen prüfen: bekannte Schlüssel, Step 0–15, Werte begrenzt, nur Abweichungen */
function readOpt(o: Obj): OptMap | null {
  const map: OptMap = {};
  for (const key of Object.keys(o)) {
    if (!((VOICE_IDS as readonly string[]).includes(key) || PAD_SUB_KEY.test(key))) continue;
    const m = o[key];
    if (!isObj(m)) continue;
    for (const st of Object.keys(m)) {
      const n = Number(st);
      const e = m[st];
      if (!isInt(n) || n < 0 || n >= 16 || !isObj(e)) continue;
      const norm = normalizeOpt({
        ...(isNum(e.v) ? { v: e.v } : {}),
        ...(isNum(e.p) ? { p: e.p } : {}),
        ...(isStepCond(e.c) ? { c: e.c } : {}),
        ...(isNum(e.t) ? { t: e.t } : {}),
        ...(isNum(e.d) ? { d: e.d } : {}),
        ...(isNum(e.s) && PAD_SUB_KEY.test(key) ? { s: e.s } : {}),
      });
      if (norm) (map[key as SubKey] ??= {})[n] = norm;
    }
  }
  return Object.keys(map).length ? map : null;
}

/**
 * Übernimmt einen (evtl. alten oder fremden) Speicherstand in `base` – verhaltensgleich zu
 * Legacy merge(): Unbekanntes wird ignoriert, Werte begrenzt, alte Formate migriert.
 */
export function loadState(src: unknown, base: State): State {
  const s = structuredClone(base);
  if (!isObj(src)) return s;
  if (isNum(src.tempo)) s.tempo = clamp(Math.round(src.tempo), 60, 200);
  if (isNum(src.swing)) s.swing = clamp(src.swing, 0, 1);
  if (isNum(src.master)) s.master = clamp(src.master, 0, 1);
  if (isInt(src.sel) && src.sel >= 0 && src.sel < VOICE_IDS.length) s.sel = src.sel;
  if (isObj(src.patterns)) {
    const pats = src.patterns;
    for (const k of SLOTS) if (pats[k]) s.patterns[k] = readPattern(pats[k], s.patterns[k]);
  } else if (isObj(src.pat)) {
    s.patterns.A = readPattern(src.pat, s.patterns.A);
  }
  if (isSlot(src.cur)) s.cur = src.cur;
  if (isArr(src.song)) {
    s.song = src.song
      .filter((e): e is Obj & { p: Slot; n: number } => isObj(e) && isSlot(e.p) && isNum(e.n))
      .slice(0, 32)
      .map((e) => ({ p: e.p, n: clamp(Math.round(e.n), 1, 16) }));
  }
  if (src.mode === 'song' || src.mode === 'pattern') s.mode = src.mode;
  if (isObj(src.params)) {
    for (const id of VOICE_IDS) {
      const p = src.params[id];
      if (!isObj(p)) continue;
      for (const k of ['level', 'tune', 'decay'] as const) {
        const v = p[k];
        if (isNum(v)) s.params[id][k] = clamp(v, 0, 1);
      }
    }
  }
  if (isObj(src.open)) {
    for (const k of ['synth', 'smp', 'mix', 'fx'] as const) {
      const v = src.open[k];
      if (typeof v === 'boolean') s.open[k] = v;
    }
    if (typeof src.open.punch === 'boolean') s.open.punch = src.open.punch;
  }
  if (isObj(src.smp)) {
    const q0 = src.smp;
    if (isInt(q0.sel) && q0.sel >= 0 && q0.sel < 8) s.smp.sel = q0.sel;
    if (isArr(q0.pads)) {
      q0.pads.slice(0, 8).forEach((q, i) => {
        const t = must(s.smp.pads[i], `Pad ${i}`);
        if (!isObj(q)) return;
        for (const k of ['start', 'end', 'tune', 'att', 'dec', 'lvl'] as const) {
          const v = q[k];
          if (isNum(v)) t[k] = clamp(v, 0, 1);
        }
        if (t.end < t.start + 0.02) {
          t.start = 0;
          t.end = 1;
        }
        if (typeof q.rev === 'boolean') t.rev = q.rev;
        if (typeof q.name === 'string') t.name = q.name.slice(0, 12);
      });
    }
  }
  if (isInt(src.key) && src.key >= 0 && src.key < 12) s.key = src.key;
  if (isInt(src.scale) && src.scale >= 0 && src.scale < SCALES.length) s.scale = src.scale;
  if (src.part === 'BA' || src.part === 'LD') s.part = src.part;
  if (src.noteLen === 1 || src.noteLen === 2 || src.noteLen === 4) s.noteLen = src.noteLen;
  if (isObj(src.synth)) {
    for (const id of PARTS) {
      const p = src.synth[id];
      const t = s.synth[id];
      if (!isObj(p)) continue;
      // alter Regler sus → Hüllkurven
      if (isNum(p.sus) && !isNum(p.fa)) {
        const su = clamp(p.sus, 0, 1);
        Object.assign(t, {
          fa: 0,
          fd: Math.sqrt(Math.max(0, (0.04 + su * 0.4) / 1.8)),
          fs: 0,
          fr: 0.22,
          aa: 0,
          ad: 0.6,
          as: 0.12 + 0.88 * su,
          ar: 0.22,
        });
      }
      for (const k of SYN_KEYS) {
        const v = p[k];
        if (isNum(v)) t[k] = clamp(v, 0, 1);
      }
      if (isInt(p.wave) && p.wave >= 0 && p.wave < WAVES.length) t.wave = p.wave;
      if (isInt(p.oct)) t.oct = clamp(p.oct, -2, 2);
      if (typeof p.mute === 'boolean') t.mute = p.mute;
      if ('preset' in p) t.preset = typeof p.preset === 'string' ? p.preset : null;
    }
  }
  // alter Synth-Stumm-Schalter wandert in den Mixer
  for (const id of PARTS) {
    if (s.synth[id].mute) {
      s.mix[id].m = true;
      s.synth[id].mute = false;
    }
  }
  if (isObj(src.mix)) {
    for (const id of CHANNELS) {
      const q = src.mix[id];
      if (!isObj(q)) continue;
      const t = s.mix[id];
      for (const k of ['v', 'p', 'r'] as const) {
        const v = q[k];
        if (isNum(v)) t[k] = clamp(v, 0, 1);
      }
      if (typeof q.m === 'boolean') t.m = q.m;
      if (typeof q.s === 'boolean') t.s = q.s;
    }
  }
  if (isObj(src.fx)) {
    for (const k of Object.keys(s.fx) as (keyof Fx)[]) {
      const v = src.fx[k];
      if (isNum(v)) s.fx[k] = clamp(v, 0, 1);
    }
  }
  if ('preset' in src) s.preset = typeof src.preset === 'string' ? src.preset : null;
  if (isArr(src.scenes)) s.scenes = readScenes(src.scenes, s.mix);
  return s;
}

/** Szenen prüfen: 8 Einträge, je Kanal Pegel (0..1), Mute und Solo; fehlendes vom Mixer */
function readScenes(list: unknown[], mix: State['mix']): (SceneMix | null)[] {
  return Array.from({ length: SCENE_COUNT }, (_, i) => {
    const e = list[i];
    if (!isObj(e)) return null;
    return Object.fromEntries(
      CHANNELS.map((id) => {
        const c = isObj(e[id]) ? e[id] : {};
        return [
          id,
          {
            v: isNum(c.v) ? clamp(c.v, 0, 1) : mix[id].v,
            m: typeof c.m === 'boolean' ? c.m : false,
            s: typeof c.s === 'boolean' ? c.s : false,
          },
        ];
      }),
    ) as SceneMix;
  });
}

/**
 * Sicht in der Feldreihenfolge von Legacy serial(); teilt Unterobjekte.
 * JSON.stringify(serialize(s)) ist bytegleich zum Legacy-Speicherformat.
 */
export function serialize(state: State): State {
  const c = state;
  return {
    tempo: c.tempo,
    swing: c.swing,
    master: c.master,
    sel: c.sel,
    patterns: c.patterns,
    cur: c.cur,
    song: c.song,
    mode: c.mode,
    params: c.params,
    preset: c.preset,
    key: c.key,
    scale: c.scale,
    part: c.part,
    noteLen: c.noteLen,
    synth: c.synth,
    open: c.open,
    smp: c.smp,
    mix: c.mix,
    fx: c.fx,
    // Szenen nur, wenn vorhanden: alte Stände bleiben bytegleich
    ...(c.scenes ? { scenes: c.scenes } : {}),
  };
}
