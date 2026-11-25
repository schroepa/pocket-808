import { describe, expect, it } from 'vitest';
import { CHANNEL_NAMES, VOICE_IDS } from '../../core/constants.ts';
import { baseState } from '../../core/defaults.ts';
import { currentPattern, toggleDrumStep, toggleSampleStep } from '../../core/pattern.ts';
import { selectPad } from '../../core/sampler.ts';
import { must } from '../../core/util.ts';
import { signal } from '../../store/signals.ts';
import type { Layout } from '../layout.ts';
import { createNav } from '../nav.ts';
import { countMutations, makeContext, pointer } from '../test-utils.ts';
import { allTracks } from './all-tracks.ts';

const pcm = Float32Array.from([0.5, -0.5]);

function setup(layout: Layout = 'desktop') {
  const ctx = makeContext();
  const nav = createNav(ctx.scope, ctx.store, signal<Layout>(layout));
  // leeres Pattern, damit jeder gesetzte Step sichtbar ist
  ctx.store.clearPattern();
  const el = allTracks(ctx.c, nav);
  return { ...ctx, nav, el };
}

const find = (el: Element, name: string) =>
  el.querySelector<HTMLButtonElement>(`[aria-label="${name}"]`);
const button = (el: Element, name: string) => must(find(el, name) ?? undefined, name);
const labels = (el: Element) =>
  [...el.querySelectorAll('[aria-label^="Zeile "]')].map((b) => b.getAttribute('aria-label'));
const padRows = (el: Element) => labels(el).filter((n) => n?.startsWith('Zeile Pad '));
/** Namen aller Zellen mit dieser Klasse */
const marked = (el: Element, cls: string) =>
  [...el.querySelectorAll(`.at-cell.${cls}`)].map((b) => b.getAttribute('aria-label'));
const selected = (el: Element) =>
  [...el.querySelectorAll('[aria-label^="Zeile "][aria-pressed="true"]')].map((b) =>
    b.getAttribute('aria-label'),
  );

const down = (b: Element): void => {
  b.dispatchEvent(pointer('pointerdown'));
};
const up = (b: Element): void => {
  b.dispatchEvent(pointer('pointerup'));
};
/** click, wie ihn ein Zeiger auslöst (detail 1); .click() entspricht der Tastatur (detail 0) */
const release = (b: Element): void => {
  b.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
};
function arm(ctx: ReturnType<typeof setup>, step: number): void {
  ctx.audio.setRecording(true);
  ctx.audio.playing.value = true;
  ctx.audio.nearestStep.mockReturnValue({ step, slot: 'A' });
}

const FIXED = [...VOICE_IDS, 'BA' as const, 'LD' as const].map((id) => CHANNEL_NAMES[id]);

describe('allTracks', () => {
  it('Abschnitt „Alle Spuren“: Drums, Bass, Lead und das gewählte Pad zu je 16 Zellen', () => {
    const { el } = setup();
    expect(el.getAttribute('aria-label')).toBe('Alle Spuren');
    expect(labels(el)).toEqual([...FIXED, 'Pad 1'].map((n) => `Zeile ${n}`));
    const cells = [...el.querySelectorAll('.at-cell')].map((b) => b.getAttribute('aria-label'));
    expect(cells).toEqual(
      [...FIXED, 'Pad 1'].flatMap((n) =>
        Array.from({ length: 16 }, (_, s) => `${n} Step ${s + 1}`),
      ),
    );
    expect([...el.querySelectorAll('[aria-label^="Zeile "]')].map((b) => b.textContent)).toEqual([
      ...VOICE_IDS,
      'BA',
      'LD',
      'P1',
    ]);
    expect(selected(el)).toEqual(['Zeile Bass Drum']);
  });

  it('Zellen schalten und wählen: Drum', () => {
    const { el, nav, store, audio } = setup();
    const cell = button(el, 'Snare Drum Step 3');
    cell.click();
    expect(nav.track.value).toBe('SD');
    expect(store.state.value.patterns.A.SD[2]).toBe(1);
    expect(cell.getAttribute('aria-pressed')).toBe('true');
    expect(cell.classList.contains('on')).toBe(true);
    expect(selected(el)).toEqual(['Zeile Snare Drum']);
    expect(button(el, 'Zeile Snare Drum').closest('.at-row')?.classList.contains('sel')).toBe(true);
    expect(audio.audition).toHaveBeenCalledWith('SD');
    cell.click();
    expect(store.state.value.patterns.A.SD[2]).toBe(0);
    expect(cell.getAttribute('aria-pressed')).toBe('false');
    expect(audio.audition).toHaveBeenCalledTimes(1);
  });

  it('Zellen schalten und wählen: Pad', () => {
    const { c, el, nav, store, audio } = setup();
    c.samples.setPad(4, pcm);
    const cell = button(el, 'Pad 5 Step 8');
    cell.click();
    expect(nav.track.value).toBe('SM');
    expect(store.state.value.smp.sel).toBe(4);
    expect(currentPattern(store.state.value).smp[4]?.[7]).toBe(1);
    expect(cell.classList.contains('on')).toBe(true);
    expect(selected(el)).toEqual(['Zeile Pad 5']);
    expect(audio.auditionPad).toHaveBeenCalledWith(4);
    // das vorher gewählte, leere Pad 1 verliert seine Zeile; die angetippte Zelle bleibt dieselbe
    expect(padRows(el)).toEqual(['Zeile Pad 5']);
    expect(find(el, 'Pad 5 Step 8')).toBe(cell);
  });

  it('Bass-Zelle öffnet Noten', () => {
    const { el, nav, store, audio } = setup();
    nav.setMode('mixer');
    const before = currentPattern(store.state.value);
    button(el, 'Lead Step 11').click();
    expect(nav.track.value).toBe('LD');
    expect(store.state.value.part).toBe('LD');
    expect(nav.mode.value).toBe('spur');
    expect(nav.page.value).toBe('noten');
    expect(nav.roll.page.value).toBe(1);
    expect(nav.lower.value).toBe('notes');
    expect(selected(el)).toEqual(['Zeile Lead']);
    // nur zeigen: weder setzen noch vorhören
    expect(currentPattern(store.state.value)).toBe(before);
    expect(audio.auditionNote).not.toHaveBeenCalled();
    button(el, 'Bass Step 1').click();
    expect(nav.track.value).toBe('BA');
    expect(nav.roll.page.value).toBe(0);
  });

  it('Bass und Lead zeigen Notenanfang und Ausklang je Part', () => {
    const { el, store } = setup();
    store.update((s) => ({ ...s, part: 'LD', noteLen: 4 }));
    store.placeNote(2, 9);
    expect(marked(el, 'on')).toEqual(['Lead Step 10']);
    expect(marked(el, 'tail')).toEqual(['Lead Step 11', 'Lead Step 12', 'Lead Step 13']);
    expect(button(el, 'Lead Step 10').getAttribute('aria-pressed')).toBe('true');
    expect(button(el, 'Lead Step 11').getAttribute('aria-pressed')).toBe('false');
  });

  it('Zellen zeigen Sub-Steps, Velocity und Step-Optionen', () => {
    const { c, el, store } = setup();
    c.samples.setPad(1, pcm);
    store.toggleSubStep('CH', 2, 0);
    store.toggleSubStep('P1', 3, 0);
    expect(marked(el, 'sub')).toEqual(['Closed Hi-Hat Step 3', 'Pad 2 Step 4']);
    expect(marked(el, 'on')).toEqual(['Closed Hi-Hat Step 3', 'Pad 2 Step 4']);
    store.setStepOpt('CH', 2, { v: 0.5, c: '2:4' });
    store.setStepOpt('P1', 3, { p: 0.5 });
    expect(button(el, 'Closed Hi-Hat Step 3').style.getPropertyValue('--vel')).toBe('0.5');
    expect(marked(el, 'opt')).toEqual(['Closed Hi-Hat Step 3', 'Pad 2 Step 4']);
  });

  it('Sub aktiv: Tipp in der gewählten Zeile wählt den Step', () => {
    const { el, nav, store } = setup('tablet');
    expect(marked(el, 'subsel')).toEqual([]);
    nav.drumSub.value = { on: true, step: 0 };
    expect(marked(el, 'subsel')).toEqual(['Bass Drum Step 1']);
    button(el, 'Bass Drum Step 7').click();
    expect(store.state.value.patterns.A.BD[6]).toBe(0);
    expect(nav.drumSub.value).toEqual({ on: true, step: 6 });
    expect(marked(el, 'subsel')).toEqual(['Bass Drum Step 7']);
    // andere Zeile: Spur wechselt, die Auswahl zieht mit
    button(el, 'Hand Clap Step 3').click();
    expect(nav.track.value).toBe('CP');
    expect(store.state.value.patterns.A.CP[2]).toBe(0);
    expect(marked(el, 'subsel')).toEqual(['Hand Clap Step 3']);
  });

  it('Opt am Pad: wählt, schaltet ein und markiert nur die gewählte Zeile', () => {
    const { el, nav, store } = setup('tablet');
    nav.selectTrack('SM');
    nav.padOpt.value = { on: true, step: -1 };
    button(el, 'Pad 1 Step 5').click();
    button(el, 'Pad 1 Step 5').click();
    expect(currentPattern(store.state.value).smp[0]?.[4]).toBe(1);
    expect(nav.padOpt.value).toEqual({ on: true, step: 4 });
    expect(marked(el, 'subsel')).toEqual(['Pad 1 Step 5']);
    nav.selectTrack('BA');
    expect(marked(el, 'subsel')).toEqual([]);
  });

  it('leeres, nicht gewähltes Pad hat keine Zeile; Inhalt gibt ihm eine, in Pad-Reihenfolge', () => {
    const { c, el, store } = setup();
    expect(padRows(el)).toEqual(['Zeile Pad 1']);
    expect(find(el, 'Pad 2 Step 1')).toBeNull();
    c.samples.setPad(6, pcm);
    expect(padRows(el)).toEqual(['Zeile Pad 1', 'Zeile Pad 7']);
    store.toggleSampleStep(3, 0);
    store.toggleSubStep('P5', 1, 0);
    expect(padRows(el)).toEqual(['1', '4', '6', '7'].map((p) => `Zeile Pad ${p}`));
    store.update((s) => selectPad(s, 7));
    expect(padRows(el)).toEqual(['4', '6', '7', '8'].map((p) => `Zeile Pad ${p}`));
    c.samples.setPad(6, null);
    store.toggleSampleStep(3, 0);
    expect(padRows(el)).toEqual(['Zeile Pad 6', 'Zeile Pad 8']);
    // nichts doppelt und nichts Altes im DOM
    expect(el.querySelectorAll('.at-cell')).toHaveLength((12 + 2) * 16);
  });

  it('bestehende Pad-Zeilen werden beim Umbau nicht neu gebaut', () => {
    const { c, el } = setup();
    c.samples.setPad(4, pcm);
    const kept = button(el, 'Zeile Pad 5');
    const drum = button(el, 'Zeile Bass Drum');
    c.samples.setPad(2, pcm);
    c.samples.setPad(6, pcm);
    expect(button(el, 'Zeile Pad 5')).toBe(kept);
    expect(button(el, 'Zeile Bass Drum')).toBe(drum);
  });

  it('replaceState (anderes Projekt) und Zurück: Zeilen, Zellen und Auswahl folgen', () => {
    const { el, store } = setup();
    store.toggleSampleStep(0, 0);
    let other = toggleSampleStep(selectPad(baseState(), 2), 5, 4);
    other = toggleDrumStep({ ...other, sel: 3 }, 'HT', 9);
    const before = marked(el, 'on');
    store.replaceState(other);
    expect(padRows(el)).toEqual(['Zeile Pad 3', 'Zeile Pad 6']);
    expect(marked(el, 'on')).toContain('Pad 6 Step 5');
    expect(marked(el, 'on')).toContain('High Tom Step 10');
    expect(marked(el, 'on')).not.toContain('Pad 1 Step 1');
    expect(selected(el)).toEqual(['Zeile High Tom']);
    store.undo();
    expect(padRows(el)).toEqual(['Zeile Pad 1']);
    expect(marked(el, 'on')).toEqual(before);
    expect(selected(el)).toEqual(['Zeile Bass Drum']);
  });

  it('Zellen folgen dem offenen Pattern', () => {
    const { el, store } = setup();
    store.toggleStep('BD', 0);
    store.toggleSampleStep(3, 0);
    store.update((s) => ({ ...s, cur: 'B' }));
    expect(marked(el, 'on')).not.toContain('Bass Drum Step 1');
    expect(padRows(el)).toEqual(['Zeile Pad 1']);
  });

  it('Lauflicht markiert die Spalte in allen Zeilen, auch in neu hinzugekommenen', () => {
    const { c, el, audio } = setup();
    const column = (s: number) => [...FIXED, 'Pad 1'].map((n) => `${n} Step ${s}`);
    audio.playhead.value = { step: 4, songIndex: -1 };
    expect(marked(el, 'now')).toEqual(column(5));
    audio.playhead.value = { step: 5, songIndex: -1 };
    expect(marked(el, 'now')).toEqual(column(6));
    c.samples.setPad(3, pcm);
    expect(marked(el, 'now')).toEqual([...column(6), 'Pad 4 Step 6']);
    audio.playhead.value = { step: -1, songIndex: -1 };
    expect(marked(el, 'now')).toEqual([]);
  });

  it('Step-Klick ändert nur eine Zelle', async () => {
    const { el, nav } = setup();
    document.body.append(el);
    nav.selectTrack('SD');
    const drum = button(el, 'Snare Drum Step 6');
    expect(
      await countMutations(el, () => {
        drum.click();
      }),
    ).toBe(1);
    nav.selectTrack('SM');
    const pad = button(el, 'Pad 1 Step 6');
    expect(
      await countMutations(el, () => {
        pad.click();
      }),
    ).toBe(1);
    el.remove();
  });

  it('nach dem Abbau folgt nichts mehr, auch keine Pad-Zeile', () => {
    const { c, el, scope, audio, store } = setup();
    c.samples.setPad(2, pcm);
    scope.dispose();
    const html = el.innerHTML;
    audio.playhead.value = { step: 3, songIndex: -1 };
    store.toggleSampleStep(2, 0);
    c.samples.setPad(5, pcm);
    expect(el.innerHTML).toBe(html);
  });
});

describe('allTracks: Beschriftung', () => {
  it('Drum, Bass und Lead: wählt und spielt an', () => {
    const { el, nav, store, audio } = setup();
    const before = currentPattern(store.state.value);
    button(el, 'Zeile Cowbell').click();
    expect(nav.track.value).toBe('CB');
    expect(audio.audition).toHaveBeenCalledWith('CB');
    button(el, 'Zeile Bass').click();
    expect(nav.track.value).toBe('BA');
    expect(audio.auditionNote).toHaveBeenCalledWith('BA', 0, 2);
    expect(selected(el)).toEqual(['Zeile Bass']);
    expect(currentPattern(store.state.value)).toBe(before);
  });

  it('Drum: bei Rec nimmt pointerdown den Schlag genau einmal auf', () => {
    const ctx = setup();
    arm(ctx, 3);
    const sd = button(ctx.el, 'Zeile Snare Drum');
    down(sd);
    release(sd);
    expect(currentPattern(ctx.store.state.value).SD[3]).toBe(1);
    expect(ctx.audio.nearestStep).toHaveBeenCalledTimes(1);
  });

  it('Pad: Tipp wählt dieses Pad und die Spur SM und spielt es an', () => {
    const { c, el, nav, store, audio } = setup();
    c.samples.setPad(4, pcm);
    button(el, 'Zeile Pad 5').click();
    expect(store.state.value.smp.sel).toBe(4);
    expect(nav.track.value).toBe('SM');
    expect(selected(el)).toEqual(['Zeile Pad 5']);
    expect(audio.auditionPad).toHaveBeenCalledTimes(1);
    expect(audio.auditionPad).toHaveBeenCalledWith(4);
  });

  it('Pad: bei Rec nimmt pointerdown dieses Pad auf, nicht das vorher gewählte', () => {
    const ctx = setup();
    ctx.c.samples.setPad(0, pcm);
    ctx.c.samples.setPad(4, pcm);
    arm(ctx, 7);
    const lab = button(ctx.el, 'Zeile Pad 5');
    down(lab);
    expect(currentPattern(ctx.store.state.value).smp[4]?.[7]).toBe(1);
    expect(currentPattern(ctx.store.state.value).smp[0]?.[7]).toBe(0);
    up(lab);
    release(lab);
    expect(ctx.audio.nearestStep).toHaveBeenCalledTimes(1);
  });

  it('Pad: ohne Zeiger (Tastatur) nimmt click dieses Pad auf', () => {
    const ctx = setup();
    ctx.c.samples.setPad(0, pcm);
    ctx.c.samples.setPad(4, pcm);
    arm(ctx, 2);
    button(ctx.el, 'Zeile Pad 5').click();
    expect(currentPattern(ctx.store.state.value).smp[4]?.[2]).toBe(1);
    expect(currentPattern(ctx.store.state.value).smp[0]?.[2]).toBe(0);
  });

  it('leeres Pad nimmt nichts auf', () => {
    const ctx = setup();
    ctx.c.samples.setPad(0, pcm);
    ctx.store.toggleSampleStep(4, 0); // Zeile ohne Sample
    arm(ctx, 7);
    const lab = button(ctx.el, 'Zeile Pad 5');
    const before = currentPattern(ctx.store.state.value);
    down(lab);
    release(lab);
    lab.click();
    expect(currentPattern(ctx.store.state.value)).toBe(before);
    expect(ctx.audio.nearestStep).not.toHaveBeenCalled();
    expect(ctx.audio.auditionPad).not.toHaveBeenCalled();
  });

  it.each<[string, (lab: Element) => void]>([
    [
      'losgelassen und geklickt',
      (lab) => {
        up(lab);
        release(lab);
      },
    ],
    [
      'daneben losgelassen',
      () => {
        up(document.body);
      },
    ],
    [
      'abgebrochen',
      (lab) => {
        lab.dispatchEvent(pointer('pointercancel'));
      },
    ],
  ])(
    'solange der Zeiger drückt, rückt keine Zeile: leeres altes Pad geht erst danach (%s)',
    (_name, end) => {
      const { c, el } = setup();
      document.body.append(el);
      c.samples.setPad(4, pcm);
      const lab = button(el, 'Zeile Pad 5');
      down(lab);
      expect(padRows(el)).toEqual(['Zeile Pad 1', 'Zeile Pad 5']);
      end(lab);
      expect(padRows(el)).toEqual(['Zeile Pad 5']);
      el.remove();
    },
  );

  it('Loslassen auf der Beschriftung allein räumt noch nicht auf (der click folgt)', () => {
    const { c, el } = setup();
    document.body.append(el);
    c.samples.setPad(4, pcm);
    const lab = button(el, 'Zeile Pad 5');
    down(lab);
    up(lab);
    expect(padRows(el)).toEqual(['Zeile Pad 1', 'Zeile Pad 5']);
    release(lab);
    expect(padRows(el)).toEqual(['Zeile Pad 5']);
    el.remove();
  });
});
