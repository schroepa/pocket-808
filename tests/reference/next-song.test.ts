import fc from 'fast-check';
import { describe, it } from 'vitest';
import type { SequenceArgs, SequenceResult } from './legacy/scenarios.ts';
import { runLegacy, runNext } from './run.ts';

// Dieselben Fälle wie core-song.test.ts, aber die vollständige Engine gegen den Legacy-Scheduler
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
  {
    song: [],
    mode: 'pattern',
    cur: 'A',
    tempo: 100,
    swing: 0.2,
    steps: 16 * 3,
    switchAt: 21,
    switchTo: 'B',
  },
  ...fc.sample(argsArb, { numRuns: 6, seed: 808 }),
];

describe('Neue Engine: Scheduler = Legacy-Scheduler', () => {
  it.concurrent.for(cases)('Fall %#', async (args, { expect }) => {
    const [legacy, next] = await Promise.all([
      runLegacy<SequenceResult>('songSequence', args),
      runNext<SequenceResult>('songSequence', args),
    ]);
    expect(next.switchedAt).toBe(legacy.switchedAt);
    expect(next.entries).toEqual(legacy.entries);
  });
});
