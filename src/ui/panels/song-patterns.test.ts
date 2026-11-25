import { describe, expect, it, vi } from 'vitest';
import { PRESETS } from '../../core/constants.ts';
import { initialState } from '../../core/initial.ts';
import { applyTemplate, KITS, templatesOf } from '../../core/templates/index.ts';
import { makeContext } from '../test-utils.ts';
import { patternsPanel } from './patterns.ts';
import { songPanel } from './song.ts';

function songSetup() {
  const ctx = makeContext();
  ctx.store.update((s) => ({ ...s, song: [] }));
  const el = songPanel(ctx.c);
  const btn = (label: string) => {
    const b = el.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`);
    if (!b) throw new Error(label);
    return b;
  };
  const blocks = () => [...el.querySelectorAll<HTMLButtonElement>('.blk')];
  return { ...ctx, el, btn, blocks };
}

describe('songPanel', () => {
  it('leer: Hinweis; anhängen wählt die neue Position', () => {
    const { el, btn, blocks, store } = songSetup();
    expect(el.querySelector('.chain-empty')?.textContent).toBe(
      'Noch leer. Wähle ein Pattern und tippe auf „anhängen“.',
    );
    const add = btn('Aktuelles Pattern an den Song anhängen');
    expect(add.textContent).toBe('+ A anhängen');
    store.selectSlot('C');
    expect(add.textContent).toBe('+ C anhängen');
    add.click();
    expect(store.state.value.song).toEqual([{ p: 'C', n: 1 }]);
    expect(blocks()[0]?.classList.contains('sel')).toBe(true);
    expect(blocks()[0]?.getAttribute('aria-label')).toBe('Position 1: Pattern C, 1 mal');
    expect(el.querySelector('.chain-empty')).toBeNull();
  });

  it('Wiederholungen, Verschieben, Entfernen mit Grenzen und Auswahl', () => {
    const { btn, blocks, store } = songSetup();
    const add = btn('Aktuelles Pattern an den Song anhängen');
    add.click();
    store.selectSlot('B');
    add.click();
    const minus = btn('Wiederholungen verringern');
    const plus = btn('Wiederholungen erhöhen');
    const left = btn('Nach vorne schieben');
    const right = btn('Nach hinten schieben');
    const del = btn('Position entfernen');
    expect(minus.disabled).toBe(true);
    expect(right.disabled).toBe(true);
    plus.click();
    expect(store.state.value.song[1]).toEqual({ p: 'B', n: 2 });
    expect(blocks()[1]?.textContent).toBe('B×2');
    for (let i = 0; i < 20; i++) plus.click();
    expect(store.state.value.song[1]?.n).toBe(16);
    expect(plus.disabled).toBe(true);
    left.click();
    expect(store.state.value.song.map((e) => e.p)).toEqual(['B', 'A']);
    expect(blocks()[0]?.classList.contains('sel')).toBe(true);
    expect(left.disabled).toBe(true);
    right.click();
    expect(store.state.value.song.map((e) => e.p)).toEqual(['A', 'B']);
    del.click();
    expect(store.state.value.song.map((e) => e.p)).toEqual(['A']);
    expect(blocks()[0]?.classList.contains('sel')).toBe(true);
    del.click();
    expect(store.state.value.song).toEqual([]);
    expect(del.disabled).toBe(true);
    minus.click();
    expect(store.state.value.song).toEqual([]);
  });

  it('Block antippen wählt und zeigt das Pattern, außer bei laufendem Song', () => {
    const { btn, blocks, store, audio } = songSetup();
    store.selectSlot('D');
    btn('Aktuelles Pattern an den Song anhängen').click();
    store.selectSlot('A');
    blocks()[0]?.click();
    expect(store.state.value.cur).toBe('D');
    store.selectSlot('A');
    store.setMode('song');
    audio.playing.value = true;
    blocks()[0]?.click();
    expect(store.state.value.cur).toBe('A');
  });

  it('gespielte Position leuchtet; Leeren hebt die Auswahl auf', () => {
    const { el, btn, blocks, store, audio } = songSetup();
    const add = btn('Aktuelles Pattern an den Song anhängen');
    add.click();
    add.click();
    audio.playhead.value = { step: 0, songIndex: 1 };
    expect(blocks().map((b) => b.classList.contains('play'))).toEqual([false, true]);
    [...el.querySelectorAll<HTMLButtonElement>('.chip')]
      .find((b) => b.textContent === 'Leeren')
      ?.click();
    expect(store.state.value.song).toEqual([]);
    expect(btn('Position entfernen').disabled).toBe(true);
  });

  it('bei 32 Positionen gesperrt', () => {
    const { btn, store } = songSetup();
    store.update((s) => ({
      ...s,
      song: Array.from({ length: 32 }, () => ({ p: 'A' as const, n: 1 })),
    }));
    expect(btn('Aktuelles Pattern an den Song anhängen').disabled).toBe(true);
  });
});

describe('patternsPanel', () => {
  it('Vorlagen laden mit Zurück und Markierung', () => {
    const { c, store } = makeContext();
    const el = patternsPanel(c);
    const chips = [...el.querySelectorAll<HTMLButtonElement>('.presets .chip')];
    expect(chips.map((b) => b.textContent)).toEqual(PRESETS.map((p) => p.name));
    chips[0]?.click();
    expect(store.state.value.preset).toBe(PRESETS[0]?.name);
    expect(chips[0]?.getAttribute('aria-pressed')).toBe('true');
    const undo = [...el.querySelectorAll<HTMLButtonElement>('.chip')].find(
      (b) => b.textContent === 'Zurück',
    );
    expect(undo?.disabled).toBe(false);
    undo?.click();
    expect(store.state.value.preset).not.toBe(PRESETS[0]?.name);
    expect(undo?.disabled).toBe(true);
  });

  it('Kopieren, Einfügen (gesperrt ohne Zwischenablage), Pattern leeren', () => {
    const { c, store } = makeContext();
    const el = patternsPanel(c);
    const chip = (t: string) => {
      const b = [...el.querySelectorAll<HTMLButtonElement>('.chip')].find(
        (x) => x.textContent === t,
      );
      if (!b) throw new Error(t);
      return b;
    };
    store.toggleStep('BD', 5);
    expect(chip('Einfügen').disabled).toBe(true);
    chip('Kopieren').click();
    expect(c.readout.text.value).toBe('PATTERN A KOPIERT');
    expect(chip('Einfügen').disabled).toBe(false);
    store.selectSlot('E');
    chip('Einfügen').click();
    expect(store.state.value.patterns.E.BD[5]).toBe(1);
    expect(c.readout.text.value).toBe('EINGEFÜGT IN E');
    chip('Pattern leeren').click();
    expect(store.state.value.patterns.E.BD[5]).toBe(0);
  });
});

describe('Würfeln', () => {
  it('würfelt eine Variation mit Meldung; Zurück stellt her', () => {
    const { c, store } = makeContext({ state: initialState() });
    const el = patternsPanel(c);
    const before = store.state.value.patterns.A;
    const rnd = vi.spyOn(Math, 'random').mockReturnValue(0.1);
    [...el.querySelectorAll('button')]
      .find((b) => b.getAttribute('aria-label') === 'Variation würfeln')
      ?.click();
    rnd.mockRestore();
    expect(store.state.value.patterns.A).not.toBe(before);
    expect(c.readout.text.value).toBe('Variation gewürfelt');
    store.undo();
    expect(store.state.value.patterns.A).toBe(before);
  });
});

describe('Vorlagen-Browser', () => {
  const setup = (state = initialState()) => {
    const ctx = makeContext({ state });
    const el = patternsPanel(ctx.c);
    const chips = (cls: string) => [...el.querySelectorAll<HTMLButtonElement>(`.${cls} .chip`)];
    const pick = (cls: string, text: string) => {
      const b = chips(cls).find((x) => x.textContent === text);
      if (!b) throw new Error(text);
      return b;
    };
    const hint = () => el.querySelector('.tpl-hint')?.textContent ?? '';
    const scopeRow = () => el.querySelector<HTMLElement>('.tpl-scope');
    return { ...ctx, el, chips, pick, hint, scopeRow };
  };

  it('startet bei „Basis“; ein Stil zeigt seine Vorlagen, Hinweis und die Lade-Auswahl', () => {
    const { chips, pick, hint, scopeRow } = setup();
    expect(chips('genres').map((b) => b.textContent)).toEqual([
      'Basis',
      'Lo-Fi',
      'Hip-Hop',
      'Trap',
      'House',
      'Techno',
    ]);
    expect(pick('genres', 'Basis').getAttribute('aria-pressed')).toBe('true');
    expect(hint()).toMatch(/^Einfache Drum-Muster/);
    expect(scopeRow()?.hidden).toBe(true);
    pick('genres', 'Lo-Fi').click();
    expect(chips('presets').map((b) => b.textContent)).toEqual(
      templatesOf('lofi').map((t) => t.name),
    );
    expect(hint()).toMatch(/^5 Vorlagen\./);
    expect(scopeRow()?.hidden).toBe(false);
    pick('genres', 'Basis').click();
    expect(chips('presets').map((b) => b.textContent)).toEqual(PRESETS.map((p) => p.name));
    expect(scopeRow()?.hidden).toBe(true);
  });

  it('lädt eine Vorlage komplett, markiert sie und Zurück stellt alles wieder her', () => {
    const { store, pick, hint, c, el } = setup();
    const before = store.state.value;
    pick('genres', 'Trap').click();
    pick('presets', 'Atlanta Trap').click();
    const s = store.state.value;
    expect([s.tempo, s.preset, s.cur]).toEqual([140, 'Atlanta Trap', 'A']);
    expect(s.synth.BA.preset).toBe('808');
    expect(s.warm).toBe(true);
    expect(pick('presets', 'Atlanta Trap').getAttribute('aria-pressed')).toBe('true');
    expect(hint()).toBe('Atlanta Trap: Hat-Rolls, 808 mit Slide, Glöckchen-Melodie (140 BPM)');
    expect(c.readout.text.value).toBe('ATLANTA TRAP · 140 BPM');
    [...el.querySelectorAll<HTMLButtonElement>('.tools .chip')]
      .find((b) => b.textContent === 'Zurück')
      ?.click();
    expect(store.state.value).toBe(before);
  });

  it('„Drums“ und „Sound“ laden nur ihren Teil', () => {
    const { store, pick, el } = setup();
    const before = store.state.value;
    pick('genres', 'House').click();
    const radio = (text: string) =>
      [...el.querySelectorAll<HTMLButtonElement>('.tpl-scope [role=radio]')].find(
        (b) => b.textContent === text,
      );
    radio('Drums')?.click();
    pick('presets', 'Classic House').click();
    let s = store.state.value;
    expect(s.tempo).toBe(124);
    expect(s.patterns.A.BD).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]);
    expect(s.patterns.A.notes).toBe(before.patterns.A.notes);
    expect(s.synth).toBe(before.synth);
    store.undo();
    radio('Sound')?.click();
    pick('presets', 'Deep House').click();
    s = store.state.value;
    expect(s.patterns).toBe(before.patterns);
    expect(s.tempo).toBe(before.tempo);
    expect(s.synth.BA.preset).toBe('Deep');
  });

  it('öffnet beim Stil der zuletzt geladenen Vorlage', () => {
    const tpl = templatesOf('techno')[1];
    if (!tpl) throw new Error('Vorlage fehlt');
    const { pick, chips } = setup(applyTemplate(initialState(), tpl, 'all'));
    expect(pick('genres', 'Techno').getAttribute('aria-pressed')).toBe('true');
    expect(
      chips('presets')
        .find((b) => b.textContent === tpl.name)
        ?.getAttribute('aria-pressed'),
    ).toBe('true');
  });

  it('Kit: lädt die Drum-Parameter mit Zurück und markiert das aktive Kit', () => {
    const { store, pick, chips, c } = setup();
    expect(chips('kits').map((b) => b.textContent)).toEqual(KITS.map((k) => k.name));
    expect(pick('kits', 'Classic').getAttribute('aria-pressed')).toBe('true');
    pick('kits', 'Lo-Fi').click();
    expect(store.state.value.params.SD).toEqual({ level: 0.7, tune: 0.35, decay: 0.35 });
    expect(pick('kits', 'Lo-Fi').getAttribute('aria-pressed')).toBe('true');
    expect(pick('kits', 'Classic').getAttribute('aria-pressed')).toBe('false');
    expect(c.readout.text.value).toBe('KIT LO-FI');
    store.undo();
    expect(pick('kits', 'Classic').getAttribute('aria-pressed')).toBe('true');
    // ein gedrehter Regler: kein Kit mehr aktiv
    store.update((s) => ({ ...s, params: { ...s.params, BD: { ...s.params.BD, tune: 0.11 } } }));
    expect(chips('kits').some((b) => b.getAttribute('aria-pressed') === 'true')).toBe(false);
  });
});
