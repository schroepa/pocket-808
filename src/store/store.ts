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
import { applyPreset } from '../core/presets.ts';
import {
  appendToSong,
  bumpRepeat,
  changeMode,
  clearSong,
  moveEntry,
  removeEntry,
} from '../core/song.ts';
import type { Pattern, Preset, Slot, State, SubKey, VoiceId } from '../core/types.ts';
import { restoreSnapshot, snapshot, type Snapshot } from '../core/undo.ts';
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
  clearNotes(): void;
  clearTrack(): void;
  clearPattern(): void;
  loadPreset(preset: Preset): void;
  selectSlot(slot: Slot): void;
  copy(): void;
  paste(): void;
  undo(): void;
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
 * Im Entwicklungsmodus wird jeder neue Zustand eingefroren.
 */
export function createStore(initial: State, opts: { freeze?: boolean } = {}): Store {
  const freeze = opts.freeze ?? import.meta.env.DEV;
  const prepare = (s: State): State => (freeze ? deepFreeze(s) : s);
  const state = signal(prepare(initial));
  const undoSnap = signal<Snapshot | null>(null);
  const clip = signal<Pattern | null>(null);
  const songEpoch = signal(0);

  const update = (fn: (s: State) => State): void => {
    state.value = prepare(fn(state.peek()));
  };
  /** Legacy snap(): Schnappschuss, dann Änderung – als eine Welle. */
  const withUndo = (fn: (s: State) => State): void => {
    batch(() => {
      undoSnap.value = snapshot(state.peek());
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
        update((s) => restoreSnapshot(s, u));
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
