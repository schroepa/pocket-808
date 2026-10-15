import { describe, expect, it } from 'vitest';
import { encodeWav } from './wav.ts';

const text = (b: Uint8Array, at: number) => String.fromCharCode(...b.subarray(at, at + 4));

describe('WAV-Kodierer', () => {
  it('schreibt einen 16-Bit-Stereo-RIFF-Kopf', () => {
    const b = encodeWav([new Float32Array(3), new Float32Array(3)], 44100);
    const v = new DataView(b.buffer);
    expect(b.length).toBe(44 + 3 * 2 * 2);
    expect(text(b, 0)).toBe('RIFF');
    expect(v.getUint32(4, true)).toBe(36 + 12);
    expect(text(b, 8)).toBe('WAVE');
    expect(text(b, 12)).toBe('fmt ');
    expect(v.getUint32(16, true)).toBe(16);
    expect(v.getUint16(20, true)).toBe(1);
    expect(v.getUint16(22, true)).toBe(2);
    expect(v.getUint32(24, true)).toBe(44100);
    expect(v.getUint32(28, true)).toBe(44100 * 4);
    expect(v.getUint16(32, true)).toBe(4);
    expect(v.getUint16(34, true)).toBe(16);
    expect(text(b, 36)).toBe('data');
    expect(v.getUint32(40, true)).toBe(12);
  });

  it('verschränkt L/R und begrenzt auf ±1', () => {
    const b = encodeWav([Float32Array.from([0.5, 1.5]), Float32Array.from([-0.5, -2])], 8000);
    const v = new DataView(b.buffer);
    expect([0, 1, 2, 3].map((i) => v.getInt16(44 + i * 2, true))).toEqual([
      16384, -16383, 32767, -32767,
    ]);
  });

  it('kann Mono', () => {
    const b = encodeWav([Float32Array.from([0.25])], 22050);
    const v = new DataView(b.buffer);
    expect(v.getUint16(22, true)).toBe(1);
    expect(v.getUint16(32, true)).toBe(2);
    expect(v.getInt16(44, true)).toBe(8192);
  });
});
