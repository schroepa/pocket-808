import { describe, expect, it, vi } from 'vitest';
import { PAD_DEFAULT } from '../core/constants.ts';
import { createSampler } from './sampler.ts';
import { fakeContext } from './test-utils.ts';

describe('Sampler: Abschneiden', () => {
  const setup = () => {
    const ctx = fakeContext();
    const s = createSampler(ctx as never, [new Float32Array(2205)]);
    const dest = ctx.createGain();
    const stops = () =>
      ctx.createBufferSource.mock.results.map(
        (r) => (r.value as { stop: ReturnType<typeof vi.fn> }).stop.mock.calls,
      );
    return { s, dest, stops };
  };

  it('ein neuer Treffer schneidet nur Stimmen ab, die schon klingen', () => {
    const { s, dest, stops } = setup();
    s.play(0, 1, PAD_DEFAULT, dest as never); // geplant für t = 1
    s.play(0, 0.5, PAD_DEFAULT, dest as never); // Vorhören jetzt: der spätere Treffer bleibt
    expect(stops()[0]).toHaveLength(1);
    s.play(0, 1.01, PAD_DEFAULT, dest as never); // jetzt klingt der Treffer von t = 1
    expect(stops()[0]).toHaveLength(2);
    expect(stops()[0]?.[1]?.[0]).toBeCloseTo(1.01 + 0.008, 6);
  });

  it('beendete Stimmen werden nicht mehr angefasst', () => {
    const { s, dest, stops } = setup();
    s.play(0, 0, PAD_DEFAULT, dest as never);
    s.play(0, 10, PAD_DEFAULT, dest as never);
    expect(stops()[0]).toHaveLength(1);
  });
});
