import { describe, expect, it } from 'vitest';
import { baseState } from './defaults.ts';
import { applySampleStore, decodePcm, encodePcm, parseSampleStore } from './samples.ts';
import { deepFreeze } from './test-utils.ts';

const b64 = (xs: number[]) => Buffer.from(Int16Array.from(xs).buffer).toString('base64');
const round = (xs: Iterable<number>) => Array.from(xs).map((x) => Math.round(x * 1e4) / 1e4);

describe('PCM-Kodierung', () => {
  it('kodiert 16 Bit, begrenzt auf ±1 und dekodiert zurück', () => {
    const enc = encodePcm(Float32Array.from([0, 0.5, -0.5, 1, 2, -2]));
    expect(enc).toBe(b64([0, 16383, -16383, 32767, 32767, -32767]));
    expect(round(decodePcm(b64([0, 16383, -16384, 32767])))).toEqual([0, 0.5, -0.5, 1]);
  });
  it('wirft bei ungültigem Base64', () => {
    expect(() => decodePcm('***')).toThrow();
  });
  it('kodiert lange Puffer in Blöcken', () => {
    const long = new Float32Array(20000).fill(0.25);
    expect(decodePcm(encodePcm(long))).toHaveLength(20000);
  });
});

describe('parseSampleStore', () => {
  it('liefert ein leeres Objekt bei fehlenden oder kaputten Daten', () => {
    expect(parseSampleStore(null)).toEqual({});
    expect(parseSampleStore('kaputt')).toEqual({});
    expect(parseSampleStore('null')).toEqual({});
    expect(parseSampleStore('{"0":{"d":""}}')).toEqual({ 0: { d: '' } });
  });
});

describe('applySampleStore', () => {
  const state = deepFreeze(
    (() => {
      const s = baseState();
      s.smp.pads.forEach((p, i) => {
        p.name = `Pad${i}`;
      });
      return s;
    })(),
  );
  const factory = [new Float32Array(3), new Float32Array(3), null, null, null, null, null, null];

  it('lädt Pads, leert Pads und löscht Namen von Pads ohne Sample', () => {
    const r = applySampleStore(
      state,
      {
        0: { d: '' },
        5: { d: b64([1, 2]) },
        9: { d: b64([1]) },
        1.5: { d: b64([1]) },
        2: 'x',
        3: { d: 7 },
        4: { d: '***' },
      },
      factory,
    );
    expect(r.pads.map((p) => p?.length ?? null)).toEqual([
      null,
      3,
      null,
      null,
      null,
      2,
      null,
      null,
    ]);
    expect(r.state.smp.pads.map((p) => p.name)).toEqual(['', 'Pad1', '', '', '', 'Pad5', '', '']);
    expect(factory[0]).not.toBeNull();
  });

  it('lässt den Zustand unverändert, wenn sich keine Namen ändern', () => {
    const full = Array.from({ length: 8 }, () => new Float32Array(1));
    expect(applySampleStore(state, {}, full).state).toBe(state);
  });

  it('lädt eigene Drum-Samples mit Namen, Standardname „Sample“', () => {
    const r = applySampleStore(
      state,
      {
        'D:BD': { d: b64([5]), n: 'Kick' },
        'D:SD': { d: b64([5]) },
        'D:XX': { d: b64([5]) },
        'D:CH': { d: '' },
        'D:OH': { d: '***' },
      },
      factory,
    );
    expect(Object.keys(r.drums).sort()).toEqual(['BD', 'SD']);
    expect(r.drums.BD?.name).toBe('Kick');
    expect(r.drums.SD?.name).toBe('Sample');
  });
});
