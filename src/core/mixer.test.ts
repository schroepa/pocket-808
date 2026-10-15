import { describe, expect, it } from 'vitest';
import { baseState } from './defaults.ts';
import { setChannelValue, setFxValue, toggleSolo } from './mixer.ts';

describe('Mixer', () => {
  it('setChannelValue ändert nur den einen Kanal', () => {
    const s = baseState();
    const t = setChannelValue(s, 'SD', 'p', 0.2);
    expect(t.mix.SD.p).toBe(0.2);
    expect(t.mix.BD).toBe(s.mix.BD);
    expect(setChannelValue(s, 'LD', 'v', 0.1).mix.LD.v).toBe(0.1);
    expect(setChannelValue(s, 'SM', 'r', 0.7).mix.SM.r).toBe(0.7);
  });
  it('toggleSolo schaltet um', () => {
    const s = toggleSolo(baseState(), 'CH');
    expect(s.mix.CH.s).toBe(true);
    expect(toggleSolo(s, 'CH').mix.CH.s).toBe(false);
  });
  it('setFxValue', () => {
    const s = setFxValue(baseState(), 'dj', 0.1);
    expect(s.fx.dj).toBe(0.1);
    expect(setFxValue(s, 'size', 0.9).fx).toMatchObject({ dj: 0.1, size: 0.9 });
  });
});
