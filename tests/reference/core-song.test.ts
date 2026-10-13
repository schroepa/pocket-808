import fc from 'fast-check';
import { describe, it } from 'vitest';
import { nextBar, songStart } from '../../src/core/song.ts';
import { stepDuration, swingDelay } from '../../src/core/timing.ts';
import type { Slot, SongEntry } from '../../src/core/types.ts';
import type { SequenceArgs } from './legacy/scenarios.ts';
import { runLegacy } from './run.ts';

interface Entry {
  step: number;
  time: number;
  slot: string;
  song: boolean;
  si: number;
}

function coreSequence(a: SequenceArgs): Entry[] {
  const d = stepDuration(a.tempo);
  const s = { mode: a.mode, song: a.song as SongEntry[], cur: a.cur as Slot };
  let cursor = songStart();
  let slot: Slot = s.cur;
  let fromSong = false;
  let next = 0.08;
  const out: Entry[] = [];
  for (let i = 0; i < a.steps; i++) {
    const step = i % 16;
    if (step === 0) ({ cursor, slot, fromSong } = nextBar(cursor, s));
    out.push({
      step,
      time: next + swingDelay(step, a.swing, d),
      slot,
      song: fromSong,
      si: cursor.index,
    });
    next += d;
  }
  return out;
}

const argsArb: fc.Arbitrary<SequenceArgs> = fc.record({
  song: fc.array(
    fc.record({ p: fc.constantFrom('A', 'B', 'C', 'H'), n: fc.integer({ min: 1, max: 4 }) }),
    { maxLength: 5 },
  ),
  mode: fc.constantFrom<SequenceArgs['mode']>('song', 'pattern'),
  cur: fc.constantFrom('A', 'D'),
  tempo: fc.integer({ min: 60, max: 200 }),
  swing: fc.double({ min: 0, max: 1, noNaN: true }),
  steps: fc.constant(16 * 12),
});

const cases: SequenceArgs[] = [
  {
    song: [
      { p: 'A', n: 3 },
      { p: 'B', n: 1 },
    ],
    mode: 'song',
    cur: 'A',
    tempo: 90,
    swing: 0.35,
    steps: 16 * 12,
  },
  { song: [], mode: 'song', cur: 'C', tempo: 120, swing: 0, steps: 16 * 3 },
  ...fc.sample(argsArb, { numRuns: 8, seed: 808 }),
];

describe('core Song-Kette und Timing = Legacy-Scheduler', () => {
  it.concurrent.for(cases)('Fall %#', async (args, { expect }) => {
    const legacy = await runLegacy<Entry[]>('songSequence', args);
    expect(coreSequence(args)).toEqual(legacy);
  });
});
