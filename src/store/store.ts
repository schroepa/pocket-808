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
export function createStore(initial: State, opts: { freeze?: boolean } = {}): Store {
  const freeze = opts.freeze ?? true;
  const prepare = (s: State): State => (freeze ? deepFreeze(s) : s);
  const state = signal(prepare(initial));
  /** ein Schritt Zurück: wie der Zustand wiederhergestellt wird, danach optional after */
  const undoSnap = signal<{ restore: (s: State) => State; after?: () => void } | null>(null);
  const clip = signal<Pattern | null>(null);
  const songEpoch = signal(0);

  const update = (fn: (s: State) => State): void => {
    state.value = prepare(fn(state.peek()));
  };
  /** Legacy snap(): Schnappschuss, dann Änderung – als eine Welle. */
  const withUndo = (fn: (s: State) => State): void => {
    batch(() => {
      const snap = snapshot(state.peek());
      undoSnap.value = { restore: (s) => restoreSnapshot(s, snap) };
      update(fn);
    });
  };

  return {
    state,
    canUndo: computed(() => undoSnap.value !== null),
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
      const u = undoSnap.peek();
      if (!u) return;
      batch(() => {
        undoSnap.value = null;
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
        undoSnap.value = { restore: (s) => ({ ...s, mix: prev.mix }) };
        update(() => next);
      });
    },
    replaceState: (next, revert) => {
      const prev = state.peek();
      batch(() => {
        undoSnap.value = { restore: () => prev, ...(revert ? { after: revert } : {}) };
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
