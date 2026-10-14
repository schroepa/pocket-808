import { describe, expect, it } from 'vitest';
import { baseState } from './defaults.ts';
import { SMP_MAX, SMP_RATE } from './constants.ts';
import {
  applySampleStore,
  decodePcm,
  encodePcm,
  parseSampleStore,
  toPcm,
  trimLeadingSilence,
} from './samples.ts';
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

describe('toPcm', () => {
  it('mischt Kanäle zu mono, rechnet auf 22,05 kHz um und normalisiert auf 0,9', () => {
    const l = new Float32Array(44100).fill(0.5);
    const r = new Float32Array(44100).fill(-0.1);
    const out = toPcm([l, r], 44100);
    expect(out.length).toBe(SMP_RATE);
    expect(Math.max(...out.map(Math.abs))).toBeCloseTo(0.9, 5);
  });
  it('kürzt auf höchstens SMP_MAX Sekunden', () => {
    const out = toPcm([new Float32Array(48000 * 10).fill(0.2)], 48000);
    expect(out.length).toBe(Math.floor((48000 * SMP_MAX) / (48000 / SMP_RATE)));
  });
  it('lässt Stille unverstärkt', () => {
    const out = toPcm([new Float32Array(1000)], 22050);
    expect(out.every((x) => x === 0)).toBe(true);
  });
  it('liefert mindestens ein Sample', () => {
    expect(toPcm([new Float32Array(0)], 44100).length).toBe(1);
  });
  it('ohne Kanäle: ein stilles Sample', () => {
    expect(Array.from(toPcm([], 44100))).toEqual([0]);
  });
  it('kürzere Kanäle zählen als Stille', () => {
    const out = toPcm([Float32Array.from([0.5, 0.5]), Float32Array.from([0.5])], 22050);
    expect(out[1]).toBeCloseTo(0.45, 5);
  });
});

describe('trimLeadingSilence', () => {
  it('schneidet Stille ab und lässt 40 Samples Vorlauf', () => {
    const pcm = new Float32Array(200);
    pcm[100] = 0.5;
    const out = trimLeadingSilence(pcm);
    expect(out.length).toBe(140);
    expect(out[40]).toBeCloseTo(0.5);
  });
  it('nur Stille: bleiben die letzten 40 Samples', () => {
    expect(trimLeadingSilence(new Float32Array(100)).length).toBe(40);
  });
  it('lässt einen Anfang innerhalb der ersten 40 Samples unverändert', () => {
    const pcm = new Float32Array(10).fill(0.3);
    expect(trimLeadingSilence(pcm).length).toBe(10);
  });
});
