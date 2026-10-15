import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { PAD_COUNT, SLOTS } from './constants.ts';
import { initialState } from './initial.ts';
import { decodeProject, encodeProject, projectFileName, type ProjectData } from './project.ts';
import { encodePcm } from './samples.ts';
import type { Bit, State } from './types.ts';

const noPads = (): (Float32Array | null)[] => Array.from({ length: PAD_COUNT }, () => null);
const data = (state: State, pads = noPads(), drums: ProjectData['drums'] = {}): ProjectData => ({
  state,
  pads,
  drums,
});
const SAVED = new Date('2026-10-15T12:00:00.000Z');
const parse = (text: string) => JSON.parse(text) as Record<string, unknown>;
const ok = (r: ReturnType<typeof decodeProject>): ProjectData => {
  if ('error' in r) throw new Error('unerwartet ungültig');
  return r;
};
const close = (a: Float32Array | null | undefined, b: Float32Array | null | undefined) => {
  expect(a === null || a === undefined).toBe(b === null || b === undefined);
  if (a && b) {
    expect(a.length).toBe(b.length);
    a.forEach((x, i) => {
      expect(Math.abs(x - (b[i] ?? 0))).toBeLessThanOrEqual(1 / 32767);
    });
  }
};

describe('Projektdatei', () => {
  it('schreibt Kopf, Zustand und alle acht Pads (leer als "")', () => {
    const pads = noPads();
    pads[2] = Float32Array.from([0, 0.5, -0.5]);
    const raw = parse(encodeProject(data(initialState(), pads), SAVED));
    expect(raw.format).toBe('pocket808');
    expect(raw.version).toBe(1);
    expect(typeof raw.app).toBe('string');
    expect(raw.saved).toBe('2026-10-15T12:00:00.000Z');
    const samples = raw.samples as { pads: Record<string, string>; drums: Record<string, unknown> };
    expect(Object.keys(samples.pads)).toEqual(['0', '1', '2', '3', '4', '5', '6', '7']);
    expect(samples.pads['0']).toBe('');
    expect(samples.pads['2']).toBe(encodePcm(Float32Array.from([0, 0.5, -0.5])));
    expect(samples.drums).toEqual({});
  });

  it('Rundreise: Zustand, Pads und Drum-Samples kommen gleich zurück', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 60, max: 200 }),
        fc.array(fc.constantFrom<Bit>(0, 1), { minLength: 16, maxLength: 16 }),
        fc.array(fc.record({ p: fc.constantFrom(...SLOTS), n: fc.integer({ min: 1, max: 16 }) }), {
          maxLength: 32,
        }),
        fc.array(
          fc.option(
            fc.float32Array({ minLength: 1, maxLength: 40, min: -1, max: 1, noNaN: true }),
            {
              nil: null,
            },
          ),
          { minLength: PAD_COUNT, maxLength: PAD_COUNT },
        ),
        (tempo, bd, song, pads) => {
          const s0 = initialState();
          const state: State = {
            ...s0,
            tempo,
            song,
            patterns: { ...s0.patterns, A: { ...s0.patterns.A, BD: bd } },
            smp: {
              ...s0.smp,
              pads: s0.smp.pads.map((p, i) => ({ ...p, name: pads[i] ? `P${String(i)}` : '' })),
            },
          };
          const drums = { SD: { pcm: Float32Array.from([0.25, -0.25]), name: 'Snap' } };
          const back = ok(decodeProject(encodeProject(data(state, pads, drums), SAVED)));
          expect(back.state).toEqual(state);
          pads.forEach((p, i) => {
            close(back.pads[i], p);
          });
          expect(back.drums.SD?.name).toBe('Snap');
          close(back.drums.SD?.pcm, drums.SD.pcm);
          expect(Object.keys(back.drums)).toEqual(['SD']);
        },
      ),
      { numRuns: 60 },
    );
  });

  it('leere Pads bleiben leer, ihr Name wird geleert', () => {
    const s0 = initialState();
    const state = {
      ...s0,
      smp: { ...s0.smp, pads: s0.smp.pads.map((p) => ({ ...p, name: 'X' })) },
    };
    const back = ok(decodeProject(encodeProject(data(state), SAVED)));
    expect(back.pads).toEqual(noPads());
    expect(back.state.smp.pads.every((p) => p.name === '')).toBe(true);
  });

  it('fehlende Pad-Einträge gelten als leer (keine Werks-Samples)', () => {
    const raw = parse(encodeProject(data(initialState()), SAVED));
    raw.samples = {};
    expect(ok(decodeProject(JSON.stringify(raw))).pads).toEqual(noPads());
  });

  it.each([
    ['kein JSON', '{nicht json'],
    ['kein Objekt', '42'],
    ['falsches Format', JSON.stringify({ format: 'other', version: 1, state: {} })],
    ['Version 0', JSON.stringify({ format: 'pocket808', version: 0, state: {} })],
    ['Version als Text', JSON.stringify({ format: 'pocket808', version: '1', state: {} })],
    ['ohne Zustand', JSON.stringify({ format: 'pocket808', version: 1 })],
    ['Zustand kein Objekt', JSON.stringify({ format: 'pocket808', version: 1, state: 'x' })],
  ])('ungültig: %s', (_, text) => {
    expect(decodeProject(text)).toEqual({ error: 'invalid' });
  });

  it('neuere Version und fremde Felder werden trotzdem geladen', () => {
    const raw = parse(encodeProject(data(initialState()), SAVED));
    raw.version = 7;
    raw.zukunft = { egal: true };
    expect(ok(decodeProject(JSON.stringify(raw))).state.tempo).toBe(initialState().tempo);
  });

  it('kaputtes Base64 an einem Pad leert nur dieses Pad', () => {
    const pads = noPads();
    pads[0] = Float32Array.from([0.5]);
    pads[1] = Float32Array.from([0.5]);
    const raw = parse(encodeProject(data(initialState(), pads), SAVED));
    (raw.samples as { pads: Record<string, string> }).pads['1'] = '***';
    const back = ok(decodeProject(JSON.stringify(raw)));
    expect(back.pads[0]).not.toBeNull();
    expect(back.pads[1]).toBeNull();
  });

  it('ignoriert ungültige Drum-Einträge', () => {
    const raw = parse(encodeProject(data(initialState()), SAVED));
    raw.samples = { drums: { XX: { d: encodePcm(Float32Array.from([0.1])), n: 'x' }, BD: 5 } };
    expect(ok(decodeProject(JSON.stringify(raw))).drums).toEqual({});
  });

  it('migriert alte Speicherstände im Zustand (Synth-Regler sus)', () => {
    const text = JSON.stringify({
      format: 'pocket808',
      version: 1,
      state: { tempo: 300, synth: { BA: { sus: 1 } } },
    });
    const back = ok(decodeProject(text));
    expect(back.state.tempo).toBe(200);
    expect(back.state.synth.BA.as).toBeCloseTo(1);
  });

  it('Dateiname mit Datum', () => {
    expect(projectFileName(SAVED)).toBe('pocket808-2026-10-15.pocket808.json');
  });
});
