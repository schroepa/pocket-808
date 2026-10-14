import { describe, expect, it, vi } from 'vitest';
import type { SubKey } from '../../core/types.ts';
import { signal } from '../../store/signals.ts';
import { makeContext } from '../test-utils.ts';
import { stepEditor } from './step-editor.ts';
import { subEditor } from './sub-editor.ts';

function setup() {
  const ctx = makeContext();
  const key = signal<SubKey>('CH');
  const step = signal(-1);
  const audition = vi.fn();
  const el = subEditor(ctx.c, { key, step, label: signal('CH'), audition });
  const subs = () => [...el.querySelectorAll<HTMLButtonElement>('.sb')];
  const tool = (label: string) =>
    [...el.querySelectorAll<HTMLButtonElement>('.chip')].find((b) => b.textContent === label);
  return { ...ctx, key, step, audition, el, subs, tool };
}

describe('subEditor', () => {
  it('ohne Step: Hinweis, Knöpfe gesperrt, Vorlagen wirkungslos', () => {
    const { el, subs, tool, store } = setup();
    expect(el.querySelector('.cap-label')?.textContent).toBe('Tippe oben einen Step an');
    expect(subs().every((b) => b.disabled)).toBe(true);
    const before = store.state.value;
    subs()[0]?.click();
    tool('Roll')?.click();
    expect(store.state.value).toBe(before);
  });

  it('Sub-Step umschalten, Vorhören nur beim Einschalten im Stand', () => {
    const { el, subs, step, store, audition, audio } = setup();
    step.value = 3;
    expect(el.querySelector('.cap-label')?.textContent).toBe('CH · Step 4 · 16 Sub-Steps');
    subs()[5]?.click();
    expect(store.state.value.patterns.A.sub.CH?.[3]?.[5]).toBe(1);
    expect(subs()[5]?.getAttribute('aria-pressed')).toBe('true');
    expect(audition).toHaveBeenCalledTimes(1);
    subs()[5]?.click();
    expect(audition).toHaveBeenCalledTimes(1);
    audio.playing.value = true;
    subs()[6]?.click();
    expect(audition).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['Roll', 16],
    ['÷2', 8],
    ['÷4', 4],
  ])('Vorlage %s setzt %i Sub-Steps', (label, n) => {
    const { step, store, tool } = setup();
    step.value = 0;
    tool(label)?.click();
    expect(store.state.value.patterns.A.sub.CH?.[0]?.filter(Boolean).length).toBe(n);
  });

  it('Leeren entfernt die Sub-Steps', () => {
    const { step, store, tool } = setup();
    step.value = 0;
    store.applySubPattern('CH', 0, 'roll');
    tool('Leeren')?.click();
    expect(store.state.value.patterns.A.sub.CH?.[0]).toBeUndefined();
  });

  it('Viertel-Sub-Steps sind markiert', () => {
    const { subs } = setup();
    expect(subs().map((b) => b.classList.contains('q'))).toEqual(
      Array.from({ length: 16 }, (_, k) => k % 4 === 0),
    );
  });
});

describe('Sub-Editor im Step-Editor', () => {
  it('nur im Sub-Modus sichtbar; bearbeitet die gewählte Spur am gewählten Step', () => {
    const { c, store, audio } = makeContext();
    const el = stepEditor(c);
    const ed = el.querySelector<HTMLElement>('.sub-ed');
    expect(ed?.hidden).toBe(true);
    el.querySelector<HTMLButtonElement>('[aria-label="Sub-Steps bearbeiten"]')?.click();
    expect(ed?.hidden).toBe(false);
    el.querySelectorAll<HTMLButtonElement>('.steps .step')[2]?.click();
    ed?.querySelectorAll<HTMLButtonElement>('.sb')[1]?.click();
    expect(store.state.value.patterns.A.sub.BD?.[2]?.[1]).toBe(1);
    expect(audio.audition).toHaveBeenCalledWith('BD');
    expect(el.querySelectorAll('.steps .step')[2]?.classList.contains('sub')).toBe(true);
  });
});
