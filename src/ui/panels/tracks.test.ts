import { describe, expect, it } from 'vitest';
import { countMutations, makeContext } from '../test-utils.ts';
import { tracks } from './tracks.ts';

describe('tracks', () => {
  it('Label wählt die Spur und hört vor', () => {
    const { c, store, audio } = makeContext();
    const el = tracks(c);
    el.querySelector<HTMLButtonElement>('[aria-label="Snare Drum wählen und anhören"]')?.click();
    expect(store.state.value.sel).toBe(1);
    expect(audio.audition).toHaveBeenCalledWith('SD');
    expect(el.querySelectorAll('.row')[1]?.classList.contains('sel')).toBe(true);
    expect(el.querySelectorAll('.row')[0]?.classList.contains('sel')).toBe(false);
  });

  it('Zelle wählt die Spur und schaltet den Step', () => {
    const { c, store, audio } = makeContext();
    const el = tracks(c);
    el.querySelector<HTMLButtonElement>('[aria-label="Closed Hi-Hat Step 3"]')?.click();
    expect(store.state.value.sel).toBe(7);
    expect(store.state.value.patterns.A.CH[2]).toBe(1);
    expect(audio.audition).toHaveBeenCalledWith('CH');
  });

  it('Zelle der schon gewählten Spur ändert die Auswahl nicht', () => {
    const { c, store } = makeContext();
    const el = tracks(c);
    const before = store.state.value;
    el.querySelector<HTMLButtonElement>('[aria-label="Bass Drum Step 1"]')?.click();
    expect(store.state.value.sel).toBe(0);
    expect(store.state.value.patterns).not.toBe(before.patterns);
  });

  it('Lauflicht markiert die Spalte in allen zehn Spuren', async () => {
    const { c, audio } = makeContext();
    const el = tracks(c);
    document.body.append(el);
    audio.playhead.value = { step: 0, songIndex: -1 };
    const n = await countMutations(el, () => {
      audio.playhead.value = { step: 1, songIndex: -1 };
    });
    expect(n).toBe(20);
    expect(el.querySelectorAll('.cell.now')).toHaveLength(10);
  });

  it('eigene Samples markieren das Label', () => {
    const { c } = makeContext();
    const el = tracks(c);
    c.samples.setDrum('BD', { pcm: new Float32Array(1), name: 'X' });
    expect(el.querySelector('.lab')?.classList.contains('cust')).toBe(true);
  });
});
