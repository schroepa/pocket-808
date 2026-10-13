import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { initialState } from '../../src/core/initial.ts';
import { loadState, parseStored, serialize } from '../../src/core/persist.ts';
import { applySampleStore } from '../../src/core/samples.ts';
import { SAVES } from './fixtures/saves.ts';
import { readGolden } from './golden.ts';
import { loadLegacy } from './legacy/harness.ts';

const plain = (v: unknown): unknown => JSON.parse(JSON.stringify(v));
/** Legacy: Fabrik-Samples liegen auf Pads 0–3. */
const FACTORY_PCM = [0, 1, 2, 3]
  .map((): Float32Array | null => new Float32Array(1))
  .concat([null, null, null, null]);
const viaCore = (raw: string | null) =>
  plain(
    serialize(applySampleStore(loadState(parseStored(raw), initialState()), {}, FACTORY_PCM).state),
  );

describe('core loadState = Legacy merge', () => {
  for (const [name, raw] of Object.entries(SAVES)) {
    it(`Referenz ${name}`, () => {
      const golden = readGolden<unknown>(`merge/${name}`, null);
      expect(viaCore(raw)).toEqual(golden);
    });
  }

  it('Fuzz: zufällige, teils kaputte Speicherstände ergeben denselben Zustand', () => {
    fc.assert(
      fc.property(saveArb(), (save) => {
        const raw = JSON.stringify(save);
        const page = loadLegacy({ storage: { 'pocket808.v1': raw } });
        try {
          expect(viaCore(raw)).toEqual(plain(page.t.serial()));
        } finally {
          page.close();
        }
      }),
      { numRuns: 100, seed: 808 },
    );
  });
});

function saveArb() {
  const junk = fc.oneof(
    fc.constant(null),
    fc.boolean(),
    fc.integer({ min: -5, max: 300 }),
    fc.double({ min: -2, max: 2, noNaN: true, noDefaultInfinity: true }),
    fc.string({ maxLength: 6 }),
    fc.constant([]),
    fc.constant({}),
  );
  const val = <T>(a: fc.Arbitrary<T>) =>
    fc.oneof({ weight: 3, arbitrary: a }, { weight: 1, arbitrary: junk });
  // Zahlen realistisch mischen: ganzzahlig, mit einer Nachkommastelle und als Extremwert.
  // fc.double allein erzeugt fast nur Extremwerte; Rundungsfehler im Bereich fielen dann nicht auf.
  const num = (min: number, max: number) =>
    fc.oneof(
      fc.integer({ min: Math.ceil(min), max: Math.floor(max) }),
      fc.integer({ min: Math.ceil(min * 10), max: Math.floor(max * 10) }).map((x) => x / 10),
      fc.double({ min, max, noNaN: true, noDefaultInfinity: true }),
    );
  const unit = num(-0.5, 1.5);
  const bits = fc.oneof(
    fc.array(fc.oneof(fc.constant(0), fc.constant(1), junk), { minLength: 15, maxLength: 17 }),
    fc.constant(new Array<number>(16).fill(0)),
    fc.constant(new Array<number>(16).fill(1)),
  );
  const steps = fc.oneof(fc.stringMatching(/^[x.]{0,20}$/), bits);
  const noteArb = fc.option(
    fc.record(
      { d: val(fc.integer({ min: -2, max: 14 })), l: val(num(0, 20)) },
      { requiredKeys: [] },
    ),
  );
  const notesRow = fc.array(val(noteArb), { minLength: 15, maxLength: 17 });
  const sub = fc.dictionary(
    fc.constantFrom('BD', 'SD', 'P0', 'P7', 'P8', 'XX', ''),
    val(fc.dictionary(fc.constantFrom('0', '5', '15', '16', '-1', '01', '', 'x'), val(bits))),
  );
  const pattern = fc.record(
    {
      BD: val(steps),
      CH: val(steps),
      notes: val(fc.record({ BA: val(notesRow), LD: val(notesRow) }, { requiredKeys: [] })),
      smp: val(fc.array(val(bits), { minLength: 7, maxLength: 9 })),
      sub: val(sub),
    },
    { requiredKeys: [] },
  );
  const synth = fc.record(
    {
      sus: val(unit),
      fa: val(unit),
      cut: val(unit),
      res: val(unit),
      lvl: val(unit),
      wave: val(fc.integer({ min: -1, max: 5 })),
      oct: val(fc.integer({ min: -4, max: 4 })),
      mute: val(fc.boolean()),
      preset: val(fc.option(fc.string({ maxLength: 6 }))),
    },
    { requiredKeys: [] },
  );
  const pad = fc.record(
    {
      start: val(unit),
      end: val(unit),
      tune: val(unit),
      rev: val(fc.boolean()),
      name: val(fc.string({ maxLength: 20 })),
    },
    { requiredKeys: [] },
  );
  const channel = fc.record(
    { v: val(unit), p: val(unit), r: val(unit), m: val(fc.boolean()), s: val(fc.boolean()) },
    { requiredKeys: [] },
  );
  return fc.record(
    {
      tempo: val(num(0, 400)),
      swing: val(unit),
      master: val(unit),
      sel: val(fc.integer({ min: -1, max: 11 })),
      patterns: val(fc.dictionary(fc.constantFrom('A', 'B', 'H', 'Z'), val(pattern))),
      pat: val(pattern),
      cur: val(fc.constantFrom('A', 'H', 'Z')),
      song: val(
        fc.array(
          val(
            fc.record(
              { p: val(fc.constantFrom('A', 'B', 'Q')), n: val(num(-3, 40)) },
              { requiredKeys: [] },
            ),
          ),
          { maxLength: 40 },
        ),
      ),
      mode: val(fc.constantFrom('song', 'pattern', 'x')),
      params: val(
        fc.dictionary(
          fc.constantFrom('BD', 'CY', 'XX'),
          val(
            fc.record(
              { level: val(unit), tune: val(unit), decay: val(unit) },
              { requiredKeys: [] },
            ),
          ),
        ),
      ),
      open: val(
        fc.record({ synth: val(fc.boolean()), fx: val(fc.boolean()) }, { requiredKeys: [] }),
      ),
      smp: val(
        fc.record(
          {
            sel: val(fc.integer({ min: -1, max: 9 })),
            pads: val(fc.array(val(pad), { maxLength: 10 })),
          },
          { requiredKeys: [] },
        ),
      ),
      key: val(fc.integer({ min: -1, max: 13 })),
      scale: val(fc.integer({ min: -1, max: 7 })),
      part: val(fc.constantFrom('BA', 'LD', 'XX')),
      noteLen: val(fc.constantFrom(1, 2, 3, 4)),
      synth: val(fc.record({ BA: val(synth), LD: val(synth) }, { requiredKeys: [] })),
      mix: val(fc.dictionary(fc.constantFrom('BD', 'SM', 'LD', 'XX'), val(channel))),
      fx: val(
        fc.record(
          { size: val(unit), dj: val(unit), djq: val(unit), foo: val(unit) },
          { requiredKeys: [] },
        ),
      ),
      preset: val(fc.option(fc.string({ maxLength: 8 }))),
    },
    { requiredKeys: [] },
  );
}
