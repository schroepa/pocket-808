import { describe, expect, it, vi } from 'vitest';
import { PRESETS, VOICE_IDS } from '../core/constants.ts';
import { baseState } from '../core/defaults.ts';
import { initialState } from '../core/initial.ts';
import { computed, effect } from './signals.ts';
import { createStore } from './store.ts';

const read = (value: unknown): unknown => value;

describe('createStore', () => {
  it('hält den Zustand in einem Signal und friert ihn im Entwicklungsmodus ein', () => {
    const store = createStore(baseState(), { freeze: true });
    expect(Object.isFrozen(store.state.value.patterns.A.BD)).toBe(true);
    store.toggleStep('BD', 0);
    expect(Object.isFrozen(store.state.value.patterns.A.BD)).toBe(true);
    expect(() => {
      (store.state.value.patterns.A.BD as number[])[0] = 0;
    }).toThrow(TypeError);
  });

  it('friert ohne Option nicht ein', () => {
    const store = createStore(baseState(), { freeze: false });
    expect(Object.isFrozen(store.state.value)).toBe(false);
  });

  it('friert standardmäßig immer ein (nicht nur im Entwicklungsmodus)', () => {
    vi.stubEnv('DEV', false);
    try {
      expect(Object.isFrozen(createStore(baseState()).state.value)).toBe(true);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('update mit unverändertem Zustand löst nichts aus', () => {
    const store = createStore(baseState());
    const fn = vi.fn();
    effect(() => {
      fn(store.state.value);
    });
    store.update((s) => s);
    store.clearTrack();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('select meldet nur bei geändertem Ausschnitt', () => {
    const store = createStore(baseState());
    const tempo = store.select((s) => s.tempo);
    const fn = vi.fn();
    effect(() => {
      fn(tempo.value);
    });
    store.toggleStep('SD', 3);
    expect(fn).toHaveBeenCalledTimes(1);
    store.update((s) => ({ ...s, tempo: 120 }));
    expect(fn.mock.calls).toEqual([[90], [120]]);
  });
});

describe('Undo und Zwischenablage', () => {
  it('Schnappschuss vor Leeren, Undo stellt wieder her und ist dann verbraucht', () => {
    const store = createStore(initialState());
    expect(store.canUndo.value).toBe(false);
    const before = store.state.value;
    store.clearPattern();
    expect(store.canUndo.value).toBe(true);
    store.undo();
    expect(store.state.value.patterns.A).toBe(before.patterns.A);
    expect(store.canUndo.value).toBe(false);
    store.undo();
    expect(store.state.value.patterns.A).toBe(before.patterns.A);
  });

  it('Preset legt Schnappschuss an, einfache Steps nicht', () => {
    const store = createStore(baseState());
    store.toggleStep('BD', 0);
    expect(store.canUndo.value).toBe(false);
    store.loadPreset(PRESETS[0]!);
    expect(store.state.value.preset).toBe('House');
    store.undo();
    expect(store.state.value.preset).toBeNull();
    expect(store.state.value.patterns.A.BD[0]).toBe(1);
  });

  it('Kopieren, Slot wechseln, Einfügen', () => {
    const store = createStore(baseState());
    store.toggleStep('CY', 9);
    expect(store.canPaste.value).toBe(false);
    store.paste();
    expect(store.canUndo.value).toBe(false);
    store.copy();
    expect(store.canPaste.value).toBe(true);
    store.selectSlot('D');
    store.paste();
    expect(store.state.value.patterns.D.CY[9]).toBe(1);
  });

  it('weitere Befehle mit Schnappschuss: Sub-Vorlage, Noten leeren, Spur leeren', () => {
    const store = createStore(baseState());
    store.applySubPattern('BD', 0, 'roll');
    expect(store.canUndo.value).toBe(true);
    store.placeNote(2, 0);
    store.clearNotes();
    store.undo();
    expect(store.state.value.patterns.A.notes.BA[0]).toEqual({ d: 2, l: 1 });
    store.clearTrack();
    store.undo();
    expect(store.state.value.patterns.A.sub.BD?.[0]).toBeDefined();
  });
});

describe('Song und Modus', () => {
  it('Song bearbeiten und Moduswechsel zählt die Song-Epoche hoch', () => {
    const store = createStore(baseState());
    store.appendToSong();
    store.selectSlot('B');
    store.appendToSong();
    store.bumpRepeat(0, 2);
    store.moveEntry(0, 1);
    expect(store.state.value.song).toEqual([
      { p: 'B', n: 1 },
      { p: 'A', n: 3 },
    ]);
    store.removeEntry(0);
    expect(store.state.value.song).toHaveLength(1);
    store.clearSong();
    expect(store.state.value.song).toEqual([]);
    expect(store.songEpoch.value).toBe(0);
    store.setMode('song');
    store.setMode('song');
    expect(store.state.value.mode).toBe('song');
    expect(store.songEpoch.value).toBe(2);
  });
  it('Sampler-, Sub- und Noten-Befehle', () => {
    const store = createStore(baseState());
    store.toggleSampleStep(2, 5);
    store.toggleSubStep('CH', 1, 4);
    store.placeNote(3, 7);
    const p = store.state.value.patterns.A;
    expect(p.smp[2]![5]).toBe(1);
    expect(p.sub.CH?.[1]?.[4]).toBe(1);
    expect(p.notes.BA[7]).toEqual({ d: 3, l: 1 });
  });
});

describe('feine Benachrichtigung (Spezifikation: nur die betroffene Zelle)', () => {
  it('ein Step-Klick rechnet nur eine Reihe nach und benachrichtigt genau eine Zelle', () => {
    const store = createStore(initialState());
    let cellRuns = 0;
    let effectRuns = 0;
    for (const v of VOICE_IDS) {
      const row = store.select((s) => s.patterns[s.cur][v]);
      for (let step = 0; step < 16; step++) {
        const cell = computed(() => {
          cellRuns++;
          return row.value[step];
        });
        effect(() => {
          effectRuns++;
          read(cell.value);
        });
      }
    }
    cellRuns = 0;
    effectRuns = 0;
    store.toggleStep('SD', 4);
    expect(cellRuns).toBe(16);
    expect(effectRuns).toBe(1);
  });
});

describe('ganzen Zustand ersetzen (Projekt öffnen)', () => {
  it('replaceState: Zurück stellt den vorherigen Zustand komplett her und ruft revert', () => {
    const before = initialState();
    const store = createStore(before);
    const revert = vi.fn();
    store.replaceState({ ...baseState(), tempo: 77 }, revert);
    expect(store.state.value.tempo).toBe(77);
    expect(store.canUndo.value).toBe(true);
    store.undo();
    expect(store.state.value).toEqual(before);
    expect(revert).toHaveBeenCalledTimes(1);
    expect(store.canUndo.value).toBe(false);
    store.undo();
    expect(revert).toHaveBeenCalledTimes(1);
  });

  it('ein späterer Undo-Schritt ersetzt die Ablage, revert entfällt', () => {
    const store = createStore(initialState());
    const revert = vi.fn();
    store.replaceState({ ...initialState(), tempo: 99 }, revert);
    store.clearPattern();
    store.undo();
    expect(revert).not.toHaveBeenCalled();
    expect(store.state.value.tempo).toBe(99);
  });
});
