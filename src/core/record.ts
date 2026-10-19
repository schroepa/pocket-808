import { placeNote, subStepsOf, toggleDrumStep, toggleSampleStep } from './pattern.ts';
import { setStepOpt } from './stepopts.ts';
import { noteAt } from './synth.ts';
import type { Part, Slot, State, SubKey, VoiceId } from './types.ts';

/* Live-Aufnahme (Etappe 8b): ein eingespielter Schlag wird als Step im Pattern gesetzt. Overdub:
   es wird nur hinzugefügt, nie gelöscht oder verändert, was schon da ist. */

export type RecHit =
  | { kind: 'drum'; voice: VoiceId; step: number; slot: Slot }
  | { kind: 'pad'; pad: number; step: number; slot: Slot; semis: number }
  | {
      kind: 'note';
      part: Part;
      degree: number;
      step: number;
      slot: Slot;
      length: State['noteLen'];
    };

/** Die Funktionen des aktuellen Patterns auf einen anderen Slot anwenden, ohne die Ansicht zu ändern */
const inSlot = (s: State, slot: Slot, fn: (t: State) => State): State => {
  const out = fn({ ...s, cur: slot });
  return out === s || out.patterns === s.patterns
    ? s
    : { ...out, cur: s.cur, part: s.part, noteLen: s.noteLen };
};

export function recordHit(s: State, hit: RecHit): State {
  switch (hit.kind) {
    case 'drum': {
      const p = s.patterns[hit.slot];
      if (p[hit.voice][hit.step] === 1 || subStepsOf(p, hit.voice, hit.step)) return s;
      return inSlot(s, hit.slot, (t) => toggleDrumStep(t, hit.voice, hit.step));
    }
    case 'pad': {
      const key = `P${String(hit.pad)}` as SubKey;
      const p = s.patterns[hit.slot];
      if (p.smp[hit.pad]?.[hit.step] === 1 || subStepsOf(p, key, hit.step)) return s;
      return inSlot(s, hit.slot, (t) => {
        const set = toggleSampleStep(t, hit.pad, hit.step);
        return hit.semis === 0 ? set : setStepOpt(set, key, hit.step, { n: hit.semis });
      });
    }
    case 'note': {
      const row = s.patterns[hit.slot].notes[hit.part];
      // Overdub: wo schon eine Note beginnt oder dieselbe Stufe klingt, bleibt alles wie es ist
      if (row[hit.step] || noteAt(row, hit.step)?.d === hit.degree) return s;
      return inSlot(s, hit.slot, (t) =>
        placeNote({ ...t, part: hit.part, noteLen: hit.length }, hit.degree, hit.step),
      );
    }
  }
}
