import { describe, expect, it } from 'vitest';
import { DRUM_DEFAULTS, SCALES, SLOTS, SYN_PRESETS, VOICE_IDS } from '../constants.ts';
import { initialState } from '../initial.ts';
import { loadState, serialize } from '../persist.ts';
import { stepOptOf } from '../stepopts.ts';
import type { Slot, State } from '../types.ts';
import { must } from '../util.ts';
import {
  applyKit,
  applyTemplate,
  GENRES,
  kitByName,
  kitParams,
  KITS,
  parseTemplatePattern,
  soundPatch,
  SYNTH_SOUNDS,
  TEMPLATE_SCOPES,
  TemplateError,
  TEMPLATES,
  templatesOf,
  type Template,
} from './index.ts';

const first = must(TEMPLATES[0], 'erste Vorlage');
const byId = (id: string): Template =>
  must(
    TEMPLATES.find((t) => t.id === id),
    id,
  );

describe('Kurzschreibweise', () => {
  it('Drum-Zeichen: Velocity, Chance, Bedingung und Rolls', () => {
    const p = parseTemplatePattern({ d: { BD: 'xo-?%rtR124.....' } });
    expect(p.BD).toEqual([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0]);
    expect(stepOptOf(p, 'BD', 0)).toEqual({ v: 1, p: 1, c: 'all' });
    expect(stepOptOf(p, 'BD', 1).v).toBe(0.7);
    expect(stepOptOf(p, 'BD', 2).v).toBe(0.4);
    expect(stepOptOf(p, 'BD', 3)).toEqual({ v: 0.5, p: 0.5, c: 'all' });
    expect(stepOptOf(p, 'BD', 4).p).toBe(0.6);
    const hits = (step: number): number[] =>
      (p.sub.BD?.[step] ?? []).flatMap((b, k) => (b ? [k] : []));
    expect(hits(5)).toEqual([0, 8]);
    expect(hits(6)).toEqual([0, 5, 11]);
    expect(hits(7)).toEqual([0, 4, 8, 12]);
    expect([8, 9, 10].map((s) => stepOptOf(p, 'BD', s).c)).toEqual(['1:2', '2:2', '4:4']);
    // andere Stimmen bleiben leer, ohne Optionen gibt es kein opt-Feld
    expect(p.SD.some(Boolean)).toBe(false);
    expect('opt' in parseTemplatePattern({ d: { SD: '....x.......x...' } })).toBe(false);
  });

  it('Noten: Step, Stufe, Länge, Akzent, Slide und Akkord', () => {
    const p = parseTemplatePattern({
      d: {},
      n: { BA: '0:0:4a  8:3:2sT 12:11:4S', LD: '2:5:1P 3:1:1O' },
    });
    expect(p.notes.BA[0]).toEqual({ d: 0, l: 4, a: true });
    expect(p.notes.BA[8]).toEqual({ d: 3, l: 2, s: true, ch: 'tri' });
    expect(p.notes.BA[12]).toEqual({ d: 11, l: 4, ch: 'sev' });
    expect(p.notes.LD[2]).toEqual({ d: 5, l: 1, ch: 'pow' });
    expect(p.notes.LD[3]).toEqual({ d: 1, l: 1, ch: 'oct' });
    expect(p.notes.BA.filter(Boolean)).toHaveLength(3);
  });

  it('meldet Fehler der Vorlage', () => {
    const bad = (t: Parameters<typeof parseTemplatePattern>[0]) => () => parseTemplatePattern(t);
    expect(bad({ d: { BD: 'x...' } })).toThrow(TemplateError);
    expect(bad({ d: { BD: 'x..z............' } })).toThrow(/unbekanntes Zeichen z/);
    expect(bad({ d: {}, n: { BA: '0:0' } })).toThrow(/unlesbar/);
    expect(bad({ d: {}, n: { BA: '16:0:1' } })).toThrow(/außerhalb/);
    expect(bad({ d: {}, n: { BA: '0:12:1' } })).toThrow(/außerhalb/);
    expect(bad({ d: {}, n: { BA: '0:0:0' } })).toThrow(/außerhalb/);
    expect(bad({ d: {}, n: { BA: '14:0:3' } })).toThrow(/außerhalb/);
    expect(bad({ d: {}, n: { BA: '4:0:1 4:2:1' } })).toThrow(/zwei Noten/);
  });
});

describe('Kits und Sounds', () => {
  it('Kit-Werte liegen über den Werkseinstellungen, mehrere Lagen überschreiben sich', () => {
    expect(kitParams()).toEqual(DRUM_DEFAULTS);
    const p = kitParams({ BD: { tune: 0.2 } }, { BD: { decay: 0.9 }, SD: { level: 0.1 } });
    expect(p.BD).toEqual({ level: 0.9, tune: 0.2, decay: 0.9 });
    expect(p.SD.level).toBe(0.1);
    expect(p.CH).toEqual(DRUM_DEFAULTS.CH);
  });

  it('applyKit ersetzt nur die Drum-Parameter', () => {
    const s = initialState();
    const next = applyKit(s, kitByName('Trap'));
    expect(next.params.BD.decay).toBe(0.95);
    expect(next.patterns).toBe(s.patterns);
    expect(() => kitByName('gibt es nicht')).toThrow();
  });

  it('alle Kit-Werte liegen in 0..1 und die Namen sind eindeutig', () => {
    expect(new Set(KITS.map((k) => k.name)).size).toBe(KITS.length);
    for (const k of KITS)
      for (const v of Object.values(k.v))
        for (const x of Object.values(v)) {
          expect(x).toBeGreaterThanOrEqual(0);
          expect(x).toBeLessThanOrEqual(1);
        }
  });

  it('Sounds: Werks-Presets vorn und unverändert, Namen eindeutig, Werte in 0..1', () => {
    for (const part of ['BA', 'LD'] as const) {
      const list = SYNTH_SOUNDS[part];
      expect(list.slice(0, 3)).toEqual(SYN_PRESETS[part]);
      expect(list.length).toBeGreaterThanOrEqual(8);
      expect(new Set(list.map((p) => p.name)).size).toBe(list.length);
      for (const p of list) {
        const { wave, ...rest } = p.v;
        expect([0, 1, 2, 3]).toContain(wave);
        for (const x of Object.values(rest)) {
          expect(x).toBeGreaterThanOrEqual(0);
          expect(x).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('soundPatch: Preset, Abweichungen, Oktave, Arp und LFO', () => {
    const plain = soundPatch('BA', { p: '808' });
    expect(plain.preset).toBe('808');
    expect(plain.oct).toBe(0);
    expect('arp' in plain).toBe(false);
    const changed = soundPatch('LD', {
      p: 'Keys',
      oct: -1,
      v: { dly: 0.9 },
      arp: { m: 'up', r: 1, o: 2 },
      lfo: { r: 0.5, d: 0.2, t: 'pit' },
    });
    expect(changed.preset).toBeNull();
    expect(changed.dly).toBe(0.9);
    expect(changed.oct).toBe(-1);
    expect(changed.arp).toEqual({ m: 'up', r: 1, o: 2 });
    expect(changed.lfo).toEqual({ r: 0.5, d: 0.2, t: 'pit' });
    expect(() => soundPatch('BA', { p: 'Keys' })).toThrow();
  });
});

describe('Vorlage laden', () => {
  const custom = (): State => {
    const s = structuredClone(initialState());
    s.patterns.A.smp[0] = s.patterns.A.smp[0]?.map(() => 1) ?? [];
    s.patterns.A.sub = { P0: { 2: Array.from({ length: 16 }, () => 1) }, BD: { 0: [1] } };
    s.patterns.A.opt = { P0: { 2: { v: 0.5 } }, BD: { 0: { v: 0.2 } } };
    s.patterns.E.BD[3] = 1;
    s.mix.SM = { v: 0.33, p: 0.1, r: 0.9, m: true, s: false };
    s.mix.BD.m = true;
    s.cur = 'E';
    return s;
  };

  it('Alles: Tempo, Tonart, Patterns, Kit, Sounds, Mixer, FX, Klang, Song', () => {
    const t = byId('lofi-dusty-tape');
    const s = applyTemplate(custom(), t, 'all');
    expect([s.tempo, s.swing, s.key, s.scale]).toEqual([78, 0.55, 2, 2]);
    expect(s.preset).toBe('Dusty Tape');
    expect(s.cur).toBe('A');
    expect(s.song).toEqual([
      { p: 'A', n: 3 },
      { p: 'B', n: 1 },
      { p: 'C', n: 2 },
      { p: 'A', n: 3 },
      { p: 'B', n: 1 },
    ]);
    expect(s.patterns.A).toEqual(parseTemplatePattern(t.pat.A));
    // nicht belegte Plätze bleiben
    expect(s.patterns.E.BD[3]).toBe(1);
    expect(s.params.SD).toEqual({ level: 0.7, tune: 0.35, decay: 0.35 });
    expect(s.synth.BA.preset).toBe('Mellow');
    expect(s.synth.LD.preset).toBe('Keys');
    // Mixer: Standard plus Abweichungen, Stumm aufgehoben, Sampler-Kanal unberührt
    expect(s.mix.BD).toEqual({ v: 0.8, p: 0.5, r: 0, m: false, s: false });
    expect(s.mix.LD).toEqual({ v: 0.7, p: 0.5, r: 0.35, m: false, s: false });
    expect(s.mix.SM).toEqual({ v: 0.33, p: 0.1, r: 0.9, m: true, s: false });
    expect(s.fx).toEqual({ size: 0.5, damp: 0.6, ret: 0.55, dj: 0.5, djq: 0.2 });
    expect(s.warm).toBe(true);
    expect(s.tape).toBe(0.6);
  });

  it('Nur Drums: Noten, Sampler-Steps und Pad-Optionen bleiben, Sounds und Tonart auch', () => {
    const before = custom();
    const t = byId('trap-atlanta');
    const s = applyTemplate(before, t, 'drums');
    const parsed = parseTemplatePattern(t.pat.A);
    for (const id of VOICE_IDS) expect(s.patterns.A[id]).toEqual(parsed[id]);
    expect(s.patterns.A.notes).toBe(before.patterns.A.notes);
    expect(s.patterns.A.smp).toBe(before.patterns.A.smp);
    expect(s.patterns.A.sub.P0).toEqual(before.patterns.A.sub.P0);
    expect(s.patterns.A.sub.BD).toBeUndefined();
    expect(s.patterns.A.sub.CH).toEqual(parsed.sub.CH);
    expect(s.patterns.A.opt?.P0).toEqual({ 2: { v: 0.5 } });
    expect(s.patterns.A.opt?.BD).toBeUndefined();
    expect(s.tempo).toBe(140);
    expect(s.params.BD.decay).toBe(0.95);
    expect(s.synth).toBe(before.synth);
    expect(s.mix).toBe(before.mix);
    expect([s.key, s.scale, s.cur]).toEqual([before.key, before.scale, 'E']);
    expect(s.song).toBe(before.song);
    expect('warm' in s).toBe(false);
  });

  it('Nur Drums ohne jede Option entfernt das opt-Feld', () => {
    const s = structuredClone(initialState());
    s.patterns.A.opt = { BD: { 0: { v: 0.2 } } };
    const plain: Template = { ...first, pat: { A: { d: { BD: 'x...............' } } } };
    expect('opt' in applyTemplate(s, plain, 'drums').patterns.A).toBe(false);
  });

  it('Nur Sound: Patterns, Tempo und Song bleiben', () => {
    const before = custom();
    const s = applyTemplate(before, byId('techno-acid'), 'sound');
    expect(s.patterns).toBe(before.patterns);
    expect(s.tempo).toBe(before.tempo);
    expect(s.song).toBe(before.song);
    expect(s.preset).toBe(before.preset);
    expect(s.synth.BA.res).toBe(0.65);
    expect(s.params.BD.level).toBe(1);
    expect(s.warm).toBe(true);
    expect('tape' in s).toBe(false);
  });

  it('ersetzt Warm und Tape einer vorherigen Vorlage', () => {
    const lofi = applyTemplate(initialState(), byId('lofi-sleepy-halftime'), 'all');
    expect(lofi.tape).toBe(0.8);
    const next = applyTemplate(lofi, byId('techno-peak'), 'all');
    expect('tape' in next).toBe(false);
    expect(next.warm).toBe(true);
  });
});

describe('Katalog', () => {
  const TEMPO: Record<string, [number, number]> = {
    lofi: [60, 90],
    hiphop: [78, 100],
    trap: [130, 150],
    house: [118, 128],
    techno: [124, 140],
  };

  it('21 Vorlagen: Lo-Fi als Schwerpunkt, je Stil mindestens vier, eindeutige Namen', () => {
    expect(TEMPLATES).toHaveLength(21);
    expect(templatesOf('lofi')).toHaveLength(5);
    for (const g of GENRES) expect(templatesOf(g.id).length).toBeGreaterThanOrEqual(4);
    expect(new Set(TEMPLATES.map((t) => t.id)).size).toBe(21);
    expect(new Set(TEMPLATES.map((t) => t.name)).size).toBe(21);
    expect(TEMPLATE_SCOPES.map((s) => s.id)).toEqual(['all', 'drums', 'sound']);
  });

  describe.each(TEMPLATES.map((t) => [t.id, t] as const))('%s', (_id, t) => {
    it('Eckdaten passen zum Stil', () => {
      const [lo, hi] = must(TEMPO[t.genre], 'Tempo-Bereich');
      expect(t.tempo).toBeGreaterThanOrEqual(lo);
      expect(t.tempo).toBeLessThanOrEqual(hi);
      expect(t.swing).toBeGreaterThanOrEqual(0);
      expect(t.swing).toBeLessThanOrEqual(0.7);
      expect(t.key).toBeGreaterThanOrEqual(0);
      expect(t.key).toBeLessThan(12);
      expect(SCALES[t.scale]).toBeDefined();
      expect(t.hint.length).toBeGreaterThan(10);
      expect(t.name.length).toBeLessThanOrEqual(20);
      expect(t.tape).toBeGreaterThanOrEqual(0);
      expect(t.tape).toBeLessThanOrEqual(1);
    });

    it('hat mindestens drei Patterns in A–D, jedes mit Drums, und eine Song-Kette daraus', () => {
      const slots = Object.keys(t.pat) as Slot[];
      expect(slots.length).toBeGreaterThanOrEqual(3);
      for (const slot of slots) {
        expect(['A', 'B', 'C', 'D']).toContain(slot);
        const p = parseTemplatePattern(must(t.pat[slot], slot));
        expect(VOICE_IDS.some((id) => p[id].some(Boolean))).toBe(true);
      }
      // der Haupt-Groove trägt Kick, Bass und Lead
      const a = parseTemplatePattern(t.pat.A);
      expect(a.BD.some(Boolean)).toBe(true);
      expect(a.notes.BA.some(Boolean)).toBe(true);
      expect(t.song.length).toBeGreaterThan(0);
      expect(t.song.length).toBeLessThanOrEqual(32);
      for (const [slot, n] of t.song) {
        expect(slots).toContain(slot);
        expect(n).toBeGreaterThanOrEqual(1);
        expect(n).toBeLessThanOrEqual(16);
      }
    });

    it('Closed und Open Hat liegen nie auf demselben Step (die Closed würgt die Open ab)', () => {
      for (const slot of Object.keys(t.pat) as Slot[]) {
        const p = parseTemplatePattern(must(t.pat[slot], slot));
        expect(p.CH.some((b, i) => b && p.OH[i])).toBe(false);
      }
    });

    it('übersteht Speichern und Laden unverändert (alle Werte gültig)', () => {
      const s = applyTemplate(initialState(), t, 'all');
      const back = loadState(JSON.parse(JSON.stringify(serialize(s))), initialState());
      expect(serialize(back)).toEqual(serialize(s));
      for (const slot of SLOTS) expect(back.patterns[slot]).toEqual(s.patterns[slot]);
    });
  });
});
