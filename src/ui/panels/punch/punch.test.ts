import { describe, expect, it } from 'vitest';
import { baseState } from '../../../core/defaults.ts';
import { loadState } from '../../../core/persist.ts';
import { makeContext, pointer } from '../../test-utils.ts';
import { PUNCH_PADS, punchDevice } from './punch.ts';

describe('Gerät Punch', () => {
  it('8 Haltetasten; halten und loslassen; Zusammenfassung zeigt Gehaltenes', () => {
    const { c, audio, scope } = makeContext();
    const d = punchDevice(c);
    expect(d.id).toBe('punch');
    expect(d.name).toBe('Punch');
    const el = d.body(scope);
    const pads = [...el.querySelectorAll<HTMLButtonElement>('.punch-pad')];
    expect(pads.map((b) => b.textContent)).toEqual(PUNCH_PADS.map((p) => p.label));
    expect(pads.map((b) => b.getAttribute('aria-label'))).toContain('Tape halten');
    expect(d.summary.value).toBe('8 Effekte · halten');
    const tape = pads.find((b) => b.textContent === 'Tape');
    const echo = pads.find((b) => b.textContent === 'Echo');
    tape?.dispatchEvent(pointer('pointerdown'));
    echo?.dispatchEvent(pointer('pointerdown', { pointerId: 2 }));
    expect(audio.punchOn).toHaveBeenCalledWith('tape');
    expect(audio.punchOn).toHaveBeenCalledWith('echo');
    expect(d.summary.value).toBe('Tape · Echo');
    tape?.dispatchEvent(pointer('pointerup'));
    expect(audio.punchOff).toHaveBeenCalledWith('tape');
    expect(d.summary.value).toBe('Echo');
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
