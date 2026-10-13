import { describe, expect, it } from 'vitest';
import { magnitudeSpectrum } from './fft.ts';

describe('magnitudeSpectrum', () => {
  it('Impuls ergibt flaches Spektrum', () => {
    const x = new Float64Array(64);
    x[0] = 1;
    const mag = magnitudeSpectrum(x);
    expect(mag).toHaveLength(33);
    for (const m of mag) expect(m).toBeCloseTo(1, 10);
  });

  it('Sinus auf Bin 8 hat dort sein Maximum', () => {
    const n = 256;
    const x = Float64Array.from({ length: n }, (_, i) => Math.sin((2 * Math.PI * 8 * i) / n));
    const mag = magnitudeSpectrum(x);
    const max = mag.indexOf(Math.max(...mag));
    expect(max).toBe(8);
    expect(mag[8]).toBeCloseTo(n / 2, 6);
  });

  it('lehnt Längen ab, die keine Zweierpotenz sind', () => {
    expect(() => magnitudeSpectrum(new Float64Array(100))).toThrow(RangeError);
    expect(() => magnitudeSpectrum(new Float64Array(0))).toThrow(RangeError);
  });
});
