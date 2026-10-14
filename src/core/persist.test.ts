import { describe, expect, it } from 'vitest';
import { baseState, parsePattern } from './defaults.ts';
import { clamp, loadState, parseStored, serialize } from './persist.ts';
import { deepFreeze } from './test-utils.ts';

const base = deepFreeze(baseState());
const load = (src: unknown) => loadState(src, base);
const ones = (): (0 | 1)[] => new Array<0 | 1>(16).fill(1);

describe('parseStored', () => {
  it('liefert null für fehlende oder kaputte Daten', () => {
    expect(parseStored(null)).toBeNull();
    expect(parseStored('')).toBeNull();
    expect(parseStored('{kaputt')).toBeNull();
    expect(parseStored('{"tempo":100}')).toEqual({ tempo: 100 });
  });
});

describe('loadState', () => {
  it('ignoriert Nicht-Objekte und verändert die Basis nicht', () => {
    for (const src of [null, undefined, 42, 'x', true]) expect(load(src)).toEqual(base);
    expect(load({})).not.toBe(base);
  });

  it('übernimmt und begrenzt Grundwerte', () => {
    const s = load({
      tempo: 133.6,
      swing: 2,
      master: -1,
      sel: 3,
      key: 4,
      scale: 5,
      part: 'LD',
      noteLen: 4,
      mode: 'song',
      cur: 'C',
    });
    expect([
      s.tempo,
      s.swing,
      s.master,
      s.sel,
      s.key,
      s.scale,
      s.part,
      s.noteLen,
      s.mode,
      s.cur,
    ]).toEqual([134, 1, 0, 3, 4, 5, 'LD', 4, 'song', 'C']);
    expect(load({ tempo: 10 }).tempo).toBe(60);
    expect(load({ tempo: 900 }).tempo).toBe(200);
  });

  it('verwirft ungültige Grundwerte', () => {
    const s = load({
      tempo: '120',
      sel: 10,
      key: 12,
      scale: 6,
      part: 'XX',
      noteLen: 3,
      mode: 'x',
      cur: 'Z',
    });
    expect(s).toEqual(base);
    expect(load({ sel: 1.5, key: -1 })).toEqual(base);
  });

  it('liest Drum-Spuren aus Strings und 16er-Arrays', () => {
    const s = load({
      patterns: {
        A: {
          BD: 'x...x',
          SD: [1, 0, 'a', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
          CH: [1, 1],
        },
      },
    });
    expect(s.patterns.A.BD).toEqual(parsePattern('x...x'));
    expect(s.patterns.A.SD[2]).toBe(1);
    expect(s.patterns.A.SD[15]).toBe(1);
    expect(s.patterns.A.CH.every((x) => x === 0)).toBe(true);
  });

  it('altes Format mit einzelnem pat landet in A', () => {
    expect(load({ pat: { BD: 'x' } }).patterns.A.BD[0]).toBe(1);
    expect(load({ pat: 'x' }).patterns.A).toEqual(base.patterns.A);
  });

  it('nimmt Noten, Sampler-Steps und Sub-Steps aus dem vorigen Pattern, wenn sie fehlen', () => {
    const b2 = structuredClone(base);
    b2.patterns.B.notes.LD[2] = { d: 1, l: 1 };
    b2.patterns.B.smp[0]![0] = 1;
    b2.patterns.B.sub = { BD: { 1: ones() } };
    deepFreeze(b2);
    const s = loadState({ patterns: { B: { BD: 'x' } } }, b2);
    expect(s.patterns.B.notes.LD[2]).toEqual({ d: 1, l: 1 });
    expect(s.patterns.B.smp[0]![0]).toBe(1);
    expect(s.patterns.B.sub.BD?.[1]).toEqual(ones());
    expect(loadState({ patterns: { B: 'irgendwas' } }, b2).patterns.B.notes.LD[2]).toEqual({
      d: 1,
      l: 1,
    });
  });

  it('prüft Noten einzeln', () => {
    const row = [
      { d: 3, l: 3.6 },
      { d: 12, l: 1 },
      { d: -1, l: 1 },
      { d: 1.5, l: 1 },
      { d: 2, l: 'x' },
      { d: 2, l: '3' },
      { d: 2, l: 40 },
      5,
      null,
      ...new Array<null>(7).fill(null),
    ];
    const s = load({ patterns: { A: { notes: { BA: row, LD: [1, 2] } } } });
    expect(s.patterns.A.notes.BA.slice(0, 9)).toEqual([
      { d: 3, l: 4 },
      null,
      null,
      null,
      { d: 2, l: 1 },
      { d: 2, l: 3 },
      { d: 2, l: 16 },
      null,
      null,
    ]);
    expect(s.patterns.A.notes.LD).toEqual(new Array(16).fill(null));
  });

  it('liest Sampler-Steps nur bei 8 Reihen, kaputte Reihen werden leer', () => {
    const s = load({
      patterns: { A: { smp: [ones(), 'x', [1], ones(), ones(), ones(), ones(), ones()] } },
    });
    expect(s.patterns.A.smp[0]![5]).toBe(1);
    expect(s.patterns.A.smp[1]!.every((x) => x === 0)).toBe(true);
    expect(load({ patterns: { A: { smp: [ones()] } } }).patterns.A.smp).toEqual(
      base.patterns.A.smp,
    );
  });

  it('liest Sub-Steps nur für gültige Schlüssel, Steps und nicht-leere Reihen', () => {
    const z = new Array(16).fill(0);
    const s = load({
      patterns: {
        A: {
          sub: {
            BD: { 0: ones(), '01': ones(), 16: ones(), x: ones(), 3: z, 4: [1] },
            P7: { 2: ones() },
            P8: { 0: ones() },
            XX: { 0: ones() },
            SD: 'kaputt',
          },
        },
      },
    });
    expect(Object.keys(s.patterns.A.sub).sort()).toEqual(['BD', 'P7']);
    expect(Object.keys(s.patterns.A.sub.BD ?? {}).sort()).toEqual(['0', '1']);
  });

  it('filtert und begrenzt den Song', () => {
    const song = [
      { p: 'A', n: 40 },
      { p: 'Q', n: 1 },
      null,
      { p: 'B' },
      { p: 'C', n: 0.4 },
      ...new Array<{ p: string; n: number }>(40).fill({ p: 'D', n: 2 }),
    ];
    const s = load({ song });
    expect(s.song.slice(0, 3)).toEqual([
      { p: 'A', n: 16 },
      { p: 'C', n: 1 },
      { p: 'D', n: 2 },
    ]);
    expect(s.song).toHaveLength(32);
  });

  it('übernimmt Drum-Parameter, Rack-Zustand, Mixer und FX begrenzt', () => {
    const s = load({
      params: { BD: { level: 2, tune: -1, decay: 'a' }, XX: { level: 1 }, SD: 3 },
      open: { synth: true, mix: 'ja' },
      mix: { BD: { v: 0.3, p: 2, r: 'x', m: true, s: 1 }, LD: 5 },
      fx: { size: 0.9, dj: 1.5, unbekannt: 1 },
    });
    expect(s.params.BD).toEqual({ level: 1, tune: 0, decay: 0.55 });
    expect(s.open).toEqual({ synth: true, smp: false, mix: false, fx: false });
    expect(s.mix.BD).toEqual({ v: 0.3, p: 1, r: 0, m: true, s: false });
    expect(s.fx).toEqual({ size: 0.9, damp: 0.5, ret: 0.5, dj: 1, djq: 0.2 });
  });

  it('übernimmt Sampler-Pads begrenzt und setzt zu kurze Ausschnitte zurück', () => {
    const s = load({
      smp: {
        sel: 3,
        pads: [
          { start: 0.5, end: 0.51, name: 'ein sehr langer Name' },
          { tune: 2, rev: true },
          'x',
        ],
      },
    });
    expect(s.smp.sel).toBe(3);
    expect(s.smp.pads[0]).toMatchObject({ start: 0, end: 1, name: 'ein sehr lan' });
    expect(s.smp.pads[1]).toMatchObject({ tune: 1, rev: true });
    expect(load({ smp: { sel: 8 } }).smp.sel).toBe(0);
  });

  it('rechnet den alten Synth-Regler sus in Hüllkurven um, außer fa ist schon da', () => {
    const s = load({
      synth: {
        BA: { sus: 0.3, cut: 0.5, wave: 1, oct: 5 },
        LD: { sus: 1, fa: 0.2, wave: 9, preset: 3 },
      },
    });
    expect(s.synth.BA.as).toBeCloseTo(0.384);
    expect(s.synth.BA.fd).toBeCloseTo(Math.sqrt(0.16 / 1.8));
    expect(s.synth.BA).toMatchObject({ cut: 0.5, wave: 1, oct: 2, fa: 0, ar: 0.22 });
    expect(s.synth.LD).toMatchObject({ fa: 0.2, as: base.synth.LD.as, wave: 0, preset: null });
    expect(load({ synth: { BA: { preset: 'Sub' } } }).synth.BA.preset).toBe('Sub');
    expect(load({ synth: { BA: 'x' } })).toEqual(base);
  });

  it('verschiebt den alten Synth-Stumm-Schalter in den Mixer', () => {
    const s = load({ synth: { BA: { mute: true } } });
    expect(s.synth.BA.mute).toBe(false);
    expect(s.mix.BA.m).toBe(true);
  });

  it('übernimmt das Preset-Feld nur, wenn es gesetzt ist', () => {
    expect(load({ preset: 'House' }).preset).toBe('House');
    expect(load({ preset: 3 }).preset).toBeNull();
    expect(loadState({}, { ...base, preset: 'Trap' }).preset).toBe('Trap');
  });
});

describe('serialize und clamp', () => {
  it('serialize liefert alle Felder in Legacy-Reihenfolge und teilt Unterobjekte', () => {
    const s = serialize(base);
    expect(s).toEqual(base);
    expect(Object.keys(s)).toEqual(Object.keys(base));
    expect(s.patterns).toBe(base.patterns);
  });
  it('clamp', () => {
    expect([clamp(-1, 0, 1), clamp(2, 0, 1), clamp(0.5, 0, 1)]).toEqual([0, 1, 0.5]);
  });
});
