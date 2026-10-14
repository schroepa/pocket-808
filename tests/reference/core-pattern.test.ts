import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { PRESETS, VOICE_IDS } from '../../src/core/constants.ts';
import { initialState } from '../../src/core/initial.ts';
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
} from '../../src/core/pattern.ts';
import { serialize } from '../../src/core/persist.ts';
import { applyPreset } from '../../src/core/presets.ts';
import type { Part, Pattern, Slot, State, SubKey } from '../../src/core/types.ts';
import { restoreSnapshot, snapshot, type Snapshot } from '../../src/core/undo.ts';
import { createStore, type Store } from '../../src/store/store.ts';
import { loadLegacy, type LegacyPage } from './legacy/harness.ts';

type Op =
  | { k: 'toggle'; v: number; s: number }
  | { k: 'smp'; pad: number; s: number }
  | { k: 'note'; part: Part; len: 1 | 2 | 4; d: number; s: number }
  | { k: 'sub'; key: SubKey; s: number; i: number }
  | { k: 'subPreset'; key: SubKey; s: number; kind: keyof typeof SUB_PATTERNS }
  | { k: 'clearTrack'; v: number }
  | { k: 'clearAll' }
  | { k: 'clearNotes'; part: Part }
  | { k: 'preset'; i: number }
  | { k: 'slot'; slot: Slot }
  | { k: 'copy' }
  | { k: 'paste' }
  | { k: 'undo' };

const step = fc.integer({ min: 0, max: 15 });
const subKey = fc.constantFrom<SubKey>('BD', 'CH', 'P0', 'P3');
const opArb: fc.Arbitrary<Op> = fc.oneof(
  {
    weight: 4,
    arbitrary: fc.record({
      k: fc.constant('toggle' as const),
      v: fc.integer({ min: 0, max: 9 }),
      s: step,
    }),
  },
  {
    weight: 2,
    arbitrary: fc.record({
      k: fc.constant('smp' as const),
      pad: fc.integer({ min: 0, max: 7 }),
      s: step,
    }),
  },
  {
    weight: 3,
    arbitrary: fc.record({
      k: fc.constant('note' as const),
      part: fc.constantFrom<Part>('BA', 'LD'),
      len: fc.constantFrom<1 | 2 | 4>(1, 2, 4),
      d: fc.integer({ min: 0, max: 11 }),
      s: step,
    }),
  },
  {
    weight: 2,
    arbitrary: fc.record({ k: fc.constant('sub' as const), key: subKey, s: step, i: step }),
  },
  {
    weight: 1,
    arbitrary: fc.record({
      k: fc.constant('subPreset' as const),
      key: subKey,
      s: step,
      kind: fc.constantFrom('roll', 'half', 'quarter', 'clear' as const),
    }),
  },
  {
    weight: 1,
    arbitrary: fc.record({
      k: fc.constant('clearTrack' as const),
      v: fc.integer({ min: 0, max: 9 }),
    }),
  },
  { weight: 1, arbitrary: fc.constant({ k: 'clearAll' as const }) },
  {
    weight: 1,
    arbitrary: fc.record({
      k: fc.constant('clearNotes' as const),
      part: fc.constantFrom<Part>('BA', 'LD'),
    }),
  },
  {
    weight: 1,
    arbitrary: fc.record({ k: fc.constant('preset' as const), i: fc.integer({ min: 0, max: 3 }) }),
  },
  {
    weight: 1,
    arbitrary: fc.record({
      k: fc.constant('slot' as const),
      slot: fc.constantFrom<Slot>('A', 'B', 'C'),
    }),
  },
  { weight: 1, arbitrary: fc.constant({ k: 'copy' as const }) },
  { weight: 1, arbitrary: fc.constant({ k: 'paste' as const }) },
  { weight: 1, arbitrary: fc.constant({ k: 'undo' as const }) },
);

interface Model {
  state: State;
  undo: Snapshot | null;
  clip: Pattern | null;
}

function applyCore(m: Model, op: Op): Model {
  const s = m.state;
  switch (op.k) {
    case 'toggle':
      return { ...m, state: toggleDrumStep(s, VOICE_IDS[op.v]!, op.s) };
    case 'smp':
      return {
        ...m,
        state: toggleSampleStep({ ...s, smp: { ...s.smp, sel: op.pad } }, op.pad, op.s),
      };
    case 'note':
      return { ...m, state: placeNote({ ...s, part: op.part, noteLen: op.len }, op.d, op.s) };
    case 'sub':
      return { ...m, state: toggleSubStep(s, op.key, op.s, op.i) };
    case 'subPreset':
      return {
        ...m,
        undo: snapshot(s),
        state: setSubSteps(s, op.key, op.s, SUB_PATTERNS[op.kind]()),
      };
    case 'clearTrack': {
      const t = { ...s, sel: op.v };
      return { ...m, undo: snapshot(t), state: clearTrack(t) };
    }
    case 'clearAll':
      return { ...m, undo: snapshot(s), state: clearPattern(s) };
    case 'clearNotes': {
      const t = { ...s, part: op.part };
      return { ...m, undo: snapshot(t), state: clearNotes(t) };
    }
    case 'preset':
      return { ...m, undo: snapshot(s), state: applyPreset(s, PRESETS[op.i]!) };
    case 'slot':
      return { ...m, state: selectSlot(s, op.slot) };
    case 'copy':
      return { ...m, clip: copyPattern(s) };
    case 'paste':
      return m.clip ? { ...m, undo: snapshot(s), state: pastePattern(s, m.clip) } : m;
    case 'undo':
      return m.undo ? { ...m, undo: null, state: restoreSnapshot(s, m.undo) } : m;
  }
}

function applyStore(store: Store, op: Op): void {
  switch (op.k) {
    case 'toggle':
      store.toggleStep(VOICE_IDS[op.v]!, op.s);
      break;
    case 'smp':
      store.update((s) => ({ ...s, smp: { ...s.smp, sel: op.pad } }));
      store.toggleSampleStep(op.pad, op.s);
      break;
    case 'note':
      store.update((s) => ({ ...s, part: op.part, noteLen: op.len }));
      store.placeNote(op.d, op.s);
      break;
    case 'sub':
      store.toggleSubStep(op.key, op.s, op.i);
      break;
    case 'subPreset':
      store.applySubPattern(op.key, op.s, op.kind);
      break;
    case 'clearTrack':
      store.update((s) => ({ ...s, sel: op.v }));
      store.clearTrack();
      break;
    case 'clearAll':
      store.clearPattern();
      break;
    case 'clearNotes':
      store.update((s) => ({ ...s, part: op.part }));
      store.clearNotes();
      break;
    case 'preset':
      store.loadPreset(PRESETS[op.i]!);
      break;
    case 'slot':
      store.selectSlot(op.slot);
      break;
    case 'copy':
      store.copy();
      break;
    case 'paste':
      store.paste();
      break;
    case 'undo':
      store.undo();
      break;
  }
}

function applyLegacy(p: LegacyPage, op: Op): void {
  const t = p.t;
  switch (op.k) {
    case 'toggle':
      t.toggle(op.v, op.s);
      break;
    case 'smp': {
      t.state.smp.sel = op.pad;
      const btn = p.window.document.querySelectorAll<HTMLButtonElement>('#smpSteps .ss')[op.s];
      if (!btn) throw new Error('Sampler-Step-Button fehlt');
      btn.click();
      break;
    }
    case 'note':
      t.state.part = op.part;
      t.state.noteLen = op.len;
      t.placeNote(op.d, op.s);
      break;
    case 'sub':
      t.toggleSub(op.key, op.s, op.i);
      break;
    case 'subPreset':
      t.snap();
      t.setSub(op.key, op.s, SUB_PATTERNS[op.kind]());
      break;
    case 'clearTrack':
      t.state.sel = op.v;
      t.clearTrack();
      break;
    case 'clearAll':
      t.clearAll();
      break;
    case 'clearNotes': {
      t.state.part = op.part;
      const btn = [
        ...p.window.document.querySelectorAll<HTMLButtonElement>('#synTools button'),
      ].find((b) => b.textContent === 'Stimme leeren');
      if (!btn) throw new Error('Knopf „Stimme leeren“ fehlt');
      btn.click();
      break;
    }
    case 'preset':
      t.snap();
      t.loadPreset(t.PRESETS[op.i]);
      break;
    case 'slot':
      t.viewPattern(op.slot);
      break;
    case 'copy':
      t.copyPattern();
      break;
    case 'paste':
      t.pastePattern();
      break;
    case 'undo':
      t.undoLast();
      break;
  }
}

describe('core Pattern-Bearbeitung = Legacy (Modelltest)', () => {
  it('beliebige Bearbeitungsfolgen führen zum selben Zustand', () => {
    fc.assert(
      // Lange Folgen: Fehler zeigen sich oft erst in Abfolgen wie „Sub-Steps → … → Preset → Undo“.
      // fast-check erzeugt sonst im Mittel nur ~5 Schritte.
      fc.property(fc.array(opArb, { minLength: 10, maxLength: 40, size: 'max' }), (ops) => {
        const page = loadLegacy();
        try {
          let m: Model = { state: initialState(), undo: null, clip: null };
          for (const [i, op] of ops.entries()) {
            m = applyCore(m, op);
            applyLegacy(page, op);
            // JSON-Text statt Inhalt: auch die Schlüssel-Reihenfolge muss stimmen (bytegleich speichern)
            expect(
              JSON.stringify(serialize(m.state)),
              `nach Schritt ${i}: ${JSON.stringify(op)}`,
            ).toBe(JSON.stringify(page.t.serial()));
          }
          expect(page.errors).toEqual([]);
        } finally {
          page.close();
        }
      }),
      { numRuns: 100, seed: 808 },
    );
  });

  it('Store-Befehle führen zum selben Zustand wie Legacy', () => {
    fc.assert(
      fc.property(fc.array(opArb, { minLength: 10, maxLength: 40, size: 'max' }), (ops) => {
        const page = loadLegacy();
        try {
          const store = createStore(initialState(), { freeze: true });
          for (const [i, op] of ops.entries()) {
            applyStore(store, op);
            applyLegacy(page, op);
            expect(
              JSON.stringify(serialize(store.state.value)),
              `nach Schritt ${i}: ${JSON.stringify(op)}`,
            ).toBe(JSON.stringify(page.t.serial()));
          }
        } finally {
          page.close();
        }
      }),
      { numRuns: 100, seed: 808 },
    );
  });
});
