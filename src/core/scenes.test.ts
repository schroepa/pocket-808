import { describe, expect, it } from 'vitest';
import { CHANNELS } from './constants.ts';
import { baseState } from './defaults.ts';
import { loadState, serialize } from './persist.ts';
import { recallScene, saveScene } from './scenes.ts';

describe('Szenen', () => {
  it('sichern legt Pegel, Mute und Solo aller Kanäle ab; ohne Szenen kein Feld', () => {
    const s0 = baseState();
    expect('scenes' in s0).toBe(false);
    const muted = { ...s0, mix: { ...s0.mix, SD: { ...s0.mix.SD, m: true, v: 0.3 } } };
    const s1 = saveScene(muted, 2);
    expect(s1.scenes).toHaveLength(8);
    expect(s1.scenes?.[0]).toBeNull();
    expect(s1.scenes?.[2]?.SD).toEqual({ v: 0.3, m: true, s: false });
    expect(Object.keys(s1.scenes?.[2] ?? {})).toEqual([...CHANNELS]);
  });

  it('abrufen setzt nur Pegel, Mute und Solo; Pan und Send bleiben', () => {
    const s0 = baseState();
    const withScene = saveScene({ ...s0, mix: { ...s0.mix, BD: { ...s0.mix.BD, s: true } } }, 0);
    const changed = {
      ...withScene,
      mix: { ...withScene.mix, BD: { ...withScene.mix.BD, s: false, p: 0.1, r: 0.9 } },
    };
    const back = recallScene(changed, 0);
    expect(back.mix.BD).toEqual({ ...changed.mix.BD, s: true });
    expect(recallScene(changed, 5)).toBe(changed);
  });

  it('Speicherformat: Rundreise und kaputte Daten', () => {
    const s = saveScene(baseState(), 1);
    expect(loadState(JSON.parse(JSON.stringify(serialize(s))), baseState()).scenes).toEqual(
      s.scenes,
    );
    const bad = loadState({ scenes: [{ BD: { v: 3, m: 'x' } }, 5, null] }, baseState());
    expect(bad.scenes).toHaveLength(8);
    expect(bad.scenes?.[0]?.BD).toEqual({ v: 1, m: false, s: false });
    expect(bad.scenes?.[1]).toBeNull();
    expect('scenes' in loadState({ scenes: 'x' }, baseState())).toBe(false);
  });
});
