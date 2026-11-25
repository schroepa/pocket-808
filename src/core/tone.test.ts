import { describe, expect, it } from 'vitest';
import { initialState } from './initial.ts';
import { loadState, serialize } from './persist.ts';
import { sameTone, setTape, setWarm, toneOf } from './tone.ts';

describe('Klangcharakter', () => {
  it('ist ohne Felder aus', () => {
    const s = initialState();
    expect(toneOf(s)).toEqual({ warm: false, tape: 0 });
    expect('warm' in serialize(s)).toBe(false);
    expect('tape' in serialize(s)).toBe(false);
  });

  it('setzt und löscht Warm', () => {
    const on = setWarm(initialState(), true);
    expect(on.warm).toBe(true);
    expect(toneOf(on).warm).toBe(true);
    expect('warm' in setWarm(on, false)).toBe(false);
  });

  it('begrenzt Tape und entfernt das Feld bei 0', () => {
    expect(setTape(initialState(), 0.4).tape).toBe(0.4);
    expect(setTape(initialState(), 3).tape).toBe(1);
    expect('tape' in setTape(setTape(initialState(), 0.4), 0)).toBe(false);
    expect('tape' in setTape(initialState(), -1)).toBe(false);
  });

  it('vergleicht zwei Einstellungen', () => {
    expect(sameTone({ warm: true, tape: 0.2 }, { warm: true, tape: 0.2 })).toBe(true);
    expect(sameTone({ warm: true, tape: 0.2 }, { warm: false, tape: 0.2 })).toBe(false);
    expect(sameTone({ warm: true, tape: 0.2 }, { warm: true, tape: 0.3 })).toBe(false);
  });

  it('übersteht Speichern und Laden', () => {
    const s = setTape(setWarm(initialState(), true), 0.6);
    const back = loadState(JSON.parse(JSON.stringify(serialize(s))), initialState());
    expect(back.warm).toBe(true);
    expect(back.tape).toBe(0.6);
  });

  it('liest nur gültige Werte und löscht sonst die Felder der Basis', () => {
    const base = setTape(setWarm(initialState(), true), 0.6);
    expect(loadState({}, base).warm).toBe(true);
    const off = loadState({ warm: false, tape: 0 }, base);
    expect('warm' in off).toBe(false);
    expect('tape' in off).toBe(false);
    expect('tape' in loadState({ tape: 'x' }, base)).toBe(false);
    expect(loadState({ tape: 7 }, initialState()).tape).toBe(1);
  });
});
