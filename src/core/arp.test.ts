import { describe, expect, it } from 'vitest';
import { applySynthPreset } from './synth.ts';
import {
  ARP_LABELS,
  ARP_MODES,
  arpPool,
  arpSequence,
  lfoCents,
  lfoHz,
  setArp,
  setLfo,
} from './arp.ts';
import { baseState } from './defaults.ts';
import { loadState, serialize } from './persist.ts';
import { mulberry32 } from './random.ts';

describe('Arpeggiator', () => {
  it('Modi und Beschriftungen', () => {
    expect(ARP_MODES).toEqual(['up', 'down', 'ud', 'rnd']);
    expect(ARP_MODES.map((m) => ARP_LABELS[m])).toEqual(['Auf', 'Ab', 'Auf-Ab', 'Zufall']);
  });

  it('Tonvorrat aufsteigend, bei 2 Oktaven dieselben Töne +12', () => {
    expect(arpPool([64, 60, 67], 1)).toEqual([60, 64, 67]);
    expect(arpPool([60, 64], 2)).toEqual([60, 64, 72, 76]);
  });

  it('Folgen Auf, Ab, Auf-Ab über die Länge, beginnend vorn', () => {
    const tri = [60, 63, 67];
    expect(arpSequence(tri, { m: 'up', r: 1, o: 1 }, 5, Math.random)).toEqual([60, 63, 67, 60, 63]);
    expect(arpSequence(tri, { m: 'down', r: 1, o: 1 }, 4, Math.random)).toEqual([67, 63, 60, 67]);
    expect(arpSequence(tri, { m: 'ud', r: 1, o: 1 }, 6, Math.random)).toEqual([
      60, 63, 67, 63, 60, 63,
    ]);
    expect(arpSequence([60, 64], { m: 'ud', r: 1, o: 1 }, 4, Math.random)).toEqual([
      60, 64, 60, 64,
    ]);
    expect(arpSequence([60], { m: 'up', r: 2, o: 2 }, 4, Math.random)).toEqual([60, 72, 60, 72]);
  });

  it('Zufall: nur Töne aus dem Vorrat, reproduzierbar je Strom', () => {
    const a = arpSequence([60, 64, 67], { m: 'rnd', r: 1, o: 2 }, 32, mulberry32(7));
    const b = arpSequence([60, 64, 67], { m: 'rnd', r: 1, o: 2 }, 32, mulberry32(7));
    expect(a).toEqual(b);
    expect(new Set(a)).toEqual(new Set([60, 64, 67, 72, 76, 79]));
  });

  it('setArp setzt und löscht das Feld, Preset-Markierung bleibt', () => {
    const s0 = baseState();
    const s = setArp(s0, 'BA', { m: 'up', r: 2, o: 1 });
    expect(s.synth.BA.arp).toEqual({ m: 'up', r: 2, o: 1 });
    expect(s.synth.BA.preset).toBe(s0.synth.BA.preset);
    expect('arp' in setArp(s, 'BA', undefined).synth.BA).toBe(false);
    expect(s.synth.LD).toBe(s0.synth.LD);
  });
});

describe('LFO', () => {
  it('Rate 0,1 Hz bis rund 19 Hz, Cent je Ziel', () => {
    expect(lfoHz(0)).toBeCloseTo(0.1);
    expect(lfoHz(1)).toBeCloseTo(0.1 * 2 ** 7.6);
    expect(lfoCents({ r: 0.5, d: 0.5, t: 'cut' })).toBe(1200);
    expect(lfoCents({ r: 0.5, d: 0.5, t: 'pit' })).toBe(50);
  });

  it('setLfo ergänzt Standardwerte und begrenzt', () => {
    const s = setLfo(baseState(), 'LD', { d: 0.4 });
    expect(s.synth.LD.lfo).toEqual({ r: 0.5, d: 0.4, t: 'cut' });
    const t = setLfo(s, 'LD', { t: 'pit', r: 3 });
    expect(t.synth.LD.lfo).toEqual({ r: 1, d: 0.4, t: 'pit' });
  });

  it('Preset laden lässt Arp und LFO stehen', () => {
    const s = setLfo(setArp(baseState(), 'BA', { m: 'ud', r: 1, o: 2 }), 'BA', { d: 0.3 });
    const p = applySynthPreset(s, 'BA', { name: 'X', v: { ...s.synth.BA, cut: 0.1 } });
    expect(p.synth.BA.arp).toEqual({ m: 'ud', r: 1, o: 2 });
    expect(p.synth.BA.lfo?.d).toBe(0.3);
  });
});

describe('Speicherformat', () => {
  it('Rundreise; ohne Arp/LFO keine Felder; kaputte Werte fallen weg', () => {
    const plain = serialize(baseState());
    expect(JSON.stringify(plain)).not.toMatch(/"arp"|"lfo"/);
    const s = setLfo(setArp(baseState(), 'BA', { m: 'rnd', r: 2, o: 2 }), 'LD', {
      d: 0.7,
      t: 'pit',
    });
    const back = loadState(JSON.parse(JSON.stringify(serialize(s))), baseState());
    expect(back.synth.BA.arp).toEqual({ m: 'rnd', r: 2, o: 2 });
    expect(back.synth.LD.lfo).toEqual({ r: 0.5, d: 0.7, t: 'pit' });
    const raw = {
      synth: {
        BA: { arp: { m: 'side', r: 1, o: 1 }, lfo: { r: 2, d: -1, t: 'pit' } },
        LD: { arp: { m: 'up', r: 3, o: 1 }, lfo: { r: 0.2, d: 0.5, t: 'amp' } },
      },
    };
    const bad = loadState(raw, baseState());
    expect('arp' in bad.synth.BA).toBe(false);
    expect(bad.synth.BA.lfo).toEqual({ r: 1, d: 0, t: 'pit' });
    expect('arp' in bad.synth.LD).toBe(false);
    expect('lfo' in bad.synth.LD).toBe(false);
  });
});
