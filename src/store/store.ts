import { deepFreeze } from '../core/freeze.ts';
import {
  clearNotes,
  clearPattern,
  clearTrack,
  copyPattern,
  pastePattern,
  placeNote,
  selectSlot,
  setSubSteps,
  SUB_PATTERNS,
  toggleDrumStep,
  toggleSampleStep,
  toggleSubStep,
} from '../core/pattern.ts';
import { distributeSlices } from '../core/chop.ts';
import { cycleChord, toggleNoteFlag } from '../core/notes.ts';
import { recordHit, type RecHit } from '../core/record.ts';
import { applyPreset } from '../core/presets.ts';
import {
  appendToSong,
  bumpRepeat,
  changeMode,
  clearSong,
  moveEntry,
  removeEntry,
} from '../core/song.ts';
import { recallScene, saveScene } from '../core/scenes.ts';
import { setStepOpt, type StepOptPatch } from '../core/stepopts.ts';
import { vary } from '../core/vary.ts';
import type { Pattern, Preset, Slot, State, SubKey, VoiceId } from '../core/types.ts';
import { restoreSnapshot, snapshot } from '../core/undo.ts';
import { batch, computed, signal, type Equals, type ReadonlySignal } from './signals.ts';

export type SubPatternKind = keyof typeof SUB_PATTERNS;

export interface Store {
  readonly state: ReadonlySignal<State>;
  readonly canUndo: ReadonlySignal<boolean>;
  readonly canPaste: ReadonlySignal<boolean>;
  /** steigt bei jedem Moduswechsel; die Engine startet den Song-Cursor dann neu (Legacy setMode) */
  readonly songEpoch: ReadonlySignal<number>;
  select<T>(fn: (s: State) => T, equals?: Equals<T>): ReadonlySignal<T>;
  update(fn: (s: State) => State): void;
  toggleStep(voice: VoiceId, step: number): void;
  toggleSampleStep(pad: number, step: number): void;
  toggleSubStep(key: SubKey, step: number, k: number): void;
  applySubPattern(key: SubKey, step: number, kind: SubPatternKind): void;
  placeNote(degree: number, step: number): void;
  /** Akzent (a) oder Slide (s) der Note unter `step` umschalten */
  toggleNoteFlag(flag: 'a' | 's', step: number): void;
  /** Akkord der Note unter `step` weiterschalten */
  cycleChord(step: number): void;
  /**
   * Live-Aufnahme: einen eingespielten Schlag ins Pattern setzen. Alle Schläge eines Takes (`take`)
   * teilen sich einen Zurück-Schritt, der jedes berührte Pattern wiederherstellt; ohne Änderung kein
   * Schritt, und ist der Schritt schon zurückgenommen, beginnt ein neuer.
   */
  recordHit(hit: RecHit, take: number): void;
  /** Slices des Pads der Reihe nach auf seine gesetzten Steps legen (mit Zurück) */
  distributeSlices(pad: number): void;
  clearNotes(): void;
  clearTrack(): void;
  clearPattern(): void;
  loadPreset(preset: Preset): void;
  selectSlot(slot: Slot): void;
  copy(): void;
  paste(): void;
  undo(): void;
  /** Step-Optionen ändern (ohne Zurück, z. B. beim Drehen) */
  setStepOpt(key: SubKey, step: number, patch: StepOptPatch): void;
  /** Step-Optionen auf den Standard zurücksetzen (mit Zurück) */
  resetStepOpt(key: SubKey, step: number): void;
  /** Parameter-Locks eines Steps lösen (mit Zurück), übrige Optionen bleiben */
  resetStepLocks(key: SubKey, step: number): void;
  /** Variation des aktuellen Patterns würfeln (mit Zurück) */
  vary(rng: () => number): void;
  /** Mixer als Szene i sichern (ohne Zurück) bzw. abrufen (mit Zurück, ganzer Mixer) */
  saveScene(i: number): void;
  recallScene(i: number): void;
  /** ganzen Zustand (Projekt öffnen); Zurück stellt ihn wieder her und ruft revert */
  replaceState(next: State, revert?: () => void): void;
  appendToSong(): void;
  bumpRepeat(index: number, delta: number): void;
  moveEntry(index: number, delta: number): void;
  removeEntry(index: number): void;
  clearSong(): void;
  setMode(mode: State['mode']): void;
}

/**
 * Zustand der App als ein Wurzel-Signal. Änderungen laufen nur über core-Funktionen; weil core
 * unveränderte Teile teilt, benachrichtigen feine Auswahl-Signale (select) nur bei echter Änderung.
 * Jeder neue Zustand wird eingefroren (Entscheidung 2026-10-14: auch im Build), außer mit `freeze: false`.
 */
/** so viele Schritte Zurück hält der Store höchstens (älteste fallen heraus) */
export const UNDO_DEPTH = 20;
/** höchstens so viele Schritte mit Sample-Sätzen (Projekt öffnen) bleiben im Stapel */
export const UNDO_SAMPLE_STEPS = 3;
interface UndoStep {
  restore: (s: State) => State;
  after?: () => void;
}

/** `undoDepth`: Tiefe des Zurück-Stapels (Standard UNDO_DEPTH; 1 entspricht der alten App) */
export function createStore(
  initial: State,
  opts: { freeze?: boolean; undoDepth?: number } = {},
): Store {
  const freeze = opts.freeze ?? true;
  const prepare = (s: State): State => (freeze ? deepFreeze(s) : s);
  const state = signal(prepare(initial));
  /** ein Schritt Zurück: wie der Zustand wiederhergestellt wird, danach optional after */
  const undoStack = signal<readonly UndoStep[]>([]);
  /** neuen Schritt obenauf legen; über UNDO_DEPTH fällt der älteste heraus */
  const pushUndo = (step: UndoStep): void => {
    const depth = Math.max(1, opts.undoDepth ?? UNDO_DEPTH);
    const next = [...undoStack.peek(), step].slice(-depth);
    // Schritte mit Samples (Projekt öffnen) halten ganze Sample-Sätze: nur die jüngsten bleiben
    let withSamples = 0;
    for (let i = next.length - 1; i >= 0; i--) {
      if (!next[i]?.after) continue;
      if (++withSamples > UNDO_SAMPLE_STEPS) {
        undoStack.value = next.slice(i + 1);
        return;
      }
    }
    undoStack.value = next;
  };
  /** offener Take der Live-Aufnahme: sein Zurück-Schritt und die vor dem Take gesicherten Patterns */
  let openTake: { id: number; step: UndoStep; touched: Map<Slot, Pattern> } | null = null;
  const clip = signal<Pattern | null>(null);
  const songEpoch = signal(0);

  const update = (fn: (s: State) => State): void => {
    state.value = prepare(fn(state.peek()));
  };
  /** Legacy snap(): Schnappschuss, dann Änderung – als eine Welle. */
  const withUndo = (fn: (s: State) => State): void => {
    batch(() => {
      const snap = snapshot(state.peek());
      update(fn);
      const after = snapshot(state.peek());
      pushUndo({
        restore: (s) => restoreSnapshot(s, snap, opts.undoDepth === 1 ? undefined : after),
      });
    });
  };

  return {
    state,
    canUndo: computed(() => undoStack.value.length > 0),
    canPaste: computed(() => clip.value !== null),
    songEpoch,
    select: (fn, equals) => computed(() => fn(state.value), equals),
    update,
    toggleStep: (voice, step) => {
      update((s) => toggleDrumStep(s, voice, step));
    },
    toggleSampleStep: (pad, step) => {
      update((s) => toggleSampleStep(s, pad, step));
    },
    toggleSubStep: (key, step, k) => {
      update((s) => toggleSubStep(s, key, step, k));
    },
    applySubPattern: (key, step, kind) => {
      withUndo((s) => setSubSteps(s, key, step, SUB_PATTERNS[kind]()));
    },
    placeNote: (degree, step) => {
      update((s) => placeNote(s, degree, step));
    },
    toggleNoteFlag: (flag, step) => {
      update((s) => toggleNoteFlag(s, flag, step));
    },
    recordHit: (hit, take) => {
      const prev = state.peek();
      const next = recordHit(prev, hit);
      if (next === prev) return;
      const open = openTake?.id === take && undoStack.peek().at(-1) === openTake.step;
      let t = open ? openTake : null;
      if (!t) {
        const touched = new Map<Slot, Pattern>();
        const preset = prev.preset;
        const step: UndoStep = {
          restore: (s) => ({
            ...s,
            patterns: { ...s.patterns, ...Object.fromEntries(touched) },
            preset,
          }),
        };
        t = { id: take, step, touched };
        openTake = t;
        pushUndo(step);
      }
      if (!t.touched.has(hit.slot)) t.touched.set(hit.slot, prev.patterns[hit.slot]);
      update(() => next);
    },
    distributeSlices: (pad) => {
      withUndo((s) => distributeSlices(s, pad));
    },
    cycleChord: (step) => {
      update((s) => cycleChord(s, step));
    },
    clearNotes: () => {
      withUndo(clearNotes);
    },
    clearTrack: () => {
      withUndo(clearTrack);
    },
    clearPattern: () => {
      withUndo(clearPattern);
    },
    loadPreset: (preset) => {
      withUndo((s) => applyPreset(s, preset));
    },
    selectSlot: (slot) => {
      update((s) => selectSlot(s, slot));
    },
    copy: () => {
      clip.value = copyPattern(state.peek());
    },
    paste: () => {
      const c = clip.peek();
      if (c) withUndo((s) => pastePattern(s, c));
    },
    undo: () => {
      const u = undoStack.peek().at(-1);
      if (!u) return;
      batch(() => {
        undoStack.value = undoStack.peek().slice(0, -1);
        update(u.restore);
      });
      u.after?.();
    },
    setStepOpt: (key, step, patch) => {
      update((s) => setStepOpt(s, key, step, patch));
    },
    resetStepOpt: (key, step) => {
      withUndo((s) => setStepOpt(s, key, step, {}));
    },
    resetStepLocks: (key, step) => {
      withUndo((s) => setStepOpt(s, key, step, { t: undefined, d: undefined, s: undefined }));
    },
    vary: (rng) => {
      withUndo((s) => vary(s, rng));
    },
    saveScene: (i) => {
      update((s) => saveScene(s, i));
    },
    recallScene: (i) => {
      const prev = state.peek();
      const next = recallScene(prev, i);
      if (next === prev) return;
      batch(() => {
        // Zurück betrifft nur den Mixer; spätere Änderungen an Steps usw. bleiben
        pushUndo({ restore: (s) => ({ ...s, mix: prev.mix }) });
        update(() => next);
      });
    },
    replaceState: (next, revert) => {
      const prev = state.peek();
      batch(() => {
        pushUndo({ restore: () => prev, ...(revert ? { after: revert } : {}) });
        update(() => next);
      });
    },
    appendToSong: () => {
      update(appendToSong);
    },
    bumpRepeat: (index, delta) => {
      update((s) => bumpRepeat(s, index, delta));
    },
    moveEntry: (index, delta) => {
      update((s) => moveEntry(s, index, delta));
    },
    removeEntry: (index) => {
      update((s) => removeEntry(s, index));
    },
    clearSong: () => {
      update(clearSong);
    },
    setMode: (mode) => {
      batch(() => {
        update((s) => changeMode(s, mode).state);
        songEpoch.value = songEpoch.peek() + 1;
      });
    },
  };
}
