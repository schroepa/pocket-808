import fc from 'fast-check';
import { afterAll, describe, expect, it } from 'vitest';
import { CHANNELS } from '../../src/core/constants.ts';
import { attackTime, decayTime, releaseTime } from '../../src/core/envelope.ts';
import { audibleChannels, masterGain } from '../../src/core/mix.ts';
import { degreeName, degreeToMidi, effectiveLength } from '../../src/core/music.ts';
import type { ChannelId, MixChannel, NoteRow, Part } from '../../src/core/types.ts';
import { loadLegacy } from './legacy/harness.ts';

const page = loadLegacy();
const L = page.t;
const OPTS = { numRuns: 300, seed: 808 };

describe('core Musik- und Mixer-Logik = Legacy', () => {
  afterAll(() => {
    page.close();
  });

  it('degreeToMidi und degreeName', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<Part>('BA', 'LD'),
        fc.integer({ min: -30, max: 30 }),
        fc.integer({ min: 0, max: 11 }),
        fc.integer({ min: 0, max: 5 }),
        fc.integer({ min: -2, max: 2 }),
        (part, d, key, scale, oct) => {
          L.state.key = key;
          L.state.scale = scale;
          L.state.synth[part].oct = oct;
          expect(degreeToMidi(part, d, { key, scale }, oct)).toBe(L.degMidi(part, d));
          expect(degreeName(d, { key, scale })).toBe(L.degName(d));
        },
      ),
      OPTS,
    );
  });

  it('effectiveLength', () => {
    const note = fc.option(
      fc.record({ d: fc.integer({ min: 0, max: 11 }), l: fc.integer({ min: 1, max: 16 }) }),
      { freq: 2 },
    );
    fc.assert(
      fc.property(
        fc.array(note, { minLength: 16, maxLength: 16 }),
        fc.integer({ min: 0, max: 15 }),
        (row, s) => {
          expect(effectiveLength(row as NoteRow, s)).toBe(L.effLen(row, s));
        },
      ),
      OPTS,
    );
  });

  it('Hüllkurven-Zeiten und Master-Kurve', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 1, noNaN: true }), (x) => {
        expect([attackTime(x), decayTime(x), releaseTime(x), masterGain(x)]).toEqual([
          L.tA(x),
          L.tD(x),
          L.tR(x),
          L.mastGain(x),
        ]);
      }),
      OPTS,
    );
  });

  it('Hörbarkeit aus Mute/Solo', () => {
    const ch = fc.record({ m: fc.boolean(), s: fc.boolean() });
    fc.assert(
      fc.property(fc.array(ch, { minLength: 13, maxLength: 13 }), (flags) => {
        const mix = {} as Record<ChannelId, MixChannel>;
        CHANNELS.forEach((id, i) => {
          const f = flags[i]!;
          mix[id] = { v: 0.8, p: 0.5, r: 0, ...f };
          Object.assign(L.state.mix[id]!, f);
        });
        L.calcAud();
        expect(audibleChannels(mix)).toEqual({ ...L.aud });
      }),
      OPTS,
    );
  });
});
