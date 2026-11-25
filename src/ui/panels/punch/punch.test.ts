import { describe, expect, it } from 'vitest';
import { baseState } from '../../../core/defaults.ts';
import { loadState } from '../../../core/persist.ts';
import { show } from '../../controls/visible.ts';
import { makeContext, pointer } from '../../test-utils.ts';
import { PUNCH_PADS, punchGrid } from './punch.ts';

describe('Punch', () => {
  it('8 Haltetasten; mehrere zugleich halten, einzeln loslassen; Abbau löst alle', () => {
    const { c, audio, scope } = makeContext();
    const el = punchGrid(c);
    const pads = [...el.querySelectorAll<HTMLButtonElement>('.punch-pad')];
    expect(pads.map((b) => b.textContent)).toEqual(PUNCH_PADS.map((p) => p.label));
    expect(pads.map((b) => b.getAttribute('aria-label'))).toContain('Tape halten');
    const tape = pads.find((b) => b.textContent === 'Tape');
    const echo = pads.find((b) => b.textContent === 'Echo');
    tape?.dispatchEvent(pointer('pointerdown'));
    echo?.dispatchEvent(pointer('pointerdown', { pointerId: 2 }));
    expect(audio.punchOn).toHaveBeenCalledWith('tape');
    expect(audio.punchOn).toHaveBeenCalledWith('echo');
    expect(pads.filter((b) => b.getAttribute('aria-pressed') === 'true')).toEqual([tape, echo]);
    tape?.dispatchEvent(pointer('pointerup'));
    expect(audio.punchOff).toHaveBeenCalledWith('tape');
    expect(audio.punchOff).not.toHaveBeenCalledWith('echo');
    scope.dispose();
    expect(audio.punchOff).toHaveBeenCalledWith('echo');
  });

  it('Aufklapp-Zustand optional gespeichert: alte Stände ohne punch bleiben unverändert', () => {
    const s = baseState();
    expect('punch' in s.open).toBe(false);
    expect(loadState({ open: { punch: true } }, s).open.punch).toBe(true);
    expect('punch' in loadState({ open: { punch: 'x' } }, s).open).toBe(false);
  });
});

describe('punchGrid', () => {
  it('acht Haltetasten ohne Gerät; Ausblenden löst', () => {
    const { c, audio } = makeContext();
    const el = punchGrid(c);
    expect(el.getAttribute('aria-label')).toBe('Punch-Effekte');
    expect(el.querySelectorAll('.punch-pad')).toHaveLength(8);
    el.querySelector('.punch-pad')?.dispatchEvent(pointer('pointerdown'));
    expect(audio.punchOn).toHaveBeenCalledWith('loop8');
    show(el, false);
    expect(audio.punchOff).toHaveBeenCalledWith('loop8');
  });
});
