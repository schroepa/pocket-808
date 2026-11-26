import { describe, expect, it } from 'vitest';
import { PRESETS } from '../../core/constants.ts';
import { initialState } from '../../core/initial.ts';
import {
  applyTemplate,
  KITS,
  SYNTH_SOUNDS,
  TEMPLATES,
  templatesOf,
} from '../../core/templates/index.ts';
import type { State } from '../../core/types.ts';
import { must } from '../../core/util.ts';
import { signal } from '../../store/signals.ts';
import type { Layout } from '../layout.ts';
import { makeContext } from '../test-utils.ts';
import { library } from './library.ts';

function setup(state: State = initialState(), at: Layout = 'mobile') {
  const ctx = makeContext({ state });
  const layout = signal<Layout>(at);
  const el = library(ctx.c, layout);
  const group = (label: string) =>
    must(el.querySelector<HTMLElement>(`[role=group][aria-label="${label}"]`) ?? undefined, label);
  const chips = (label: string) => [...group(label).querySelectorAll<HTMLButtonElement>('.chip')];
  const pick = (label: string, text: string) =>
    must(
      chips(label).find((b) => b.textContent === text),
      text,
    );
  const pressed = (label: string) =>
    chips(label)
      .filter((b) => b.getAttribute('aria-pressed') === 'true')
      .map((b) => b.textContent);
  const radio = (label: string, text: string) =>
    must(
      [...el.querySelectorAll<HTMLButtonElement>(`[aria-label="${label}"] [role=radio]`)].find(
        (b) => b.textContent === text,
      ),
      text,
    );
  const load = (text: string) => radio('Was die Vorlage ersetzt', text);
  const hint = () => el.querySelector('.tpl-hint')?.textContent ?? '';
  const sections = () => [...el.querySelectorAll<HTMLElement>('section[data-page]')];
  const visible = () =>
    sections()
      .filter((s) => !s.hidden)
      .map((s) => s.getAttribute('aria-label'));
  const tabs = () => [...el.querySelectorAll<HTMLButtonElement>('[role=tab]')];
  return { ...ctx, el, layout, chips, pick, pressed, radio, load, hint, visible, tabs, sections };
}

const NAMES = ['Synth-Sound', 'Vorlagen', 'Basis-Muster', 'Kits'];

describe('library: Aufbau', () => {
  it('mobile: Reiter „Plattenkiste“, Start bei Vorlagen, ein Abschnitt zur Zeit', () => {
    const { el, visible, tabs, sections } = setup();
    const list = el.querySelector<HTMLElement>('[role=tablist]');
    expect(list?.getAttribute('aria-label')).toBe('Plattenkiste');
    expect(list?.hidden).toBe(false);
    expect(tabs().map((t) => t.textContent)).toEqual(NAMES);
    expect(sections().map((s) => s.getAttribute('aria-label'))).toEqual(NAMES);
    expect(visible()).toEqual(['Vorlagen']);
    // die Reiter nennen den Abschnitt: keine doppelte Überschrift
    expect([...el.querySelectorAll<HTMLElement>('.library-title')].map((t) => t.hidden)).toEqual([
      true,
      true,
      true,
      true,
    ]);
    for (const name of NAMES) {
      must(
        tabs().find((t) => t.textContent === name),
        name,
      ).click();
      expect(visible()).toEqual([name]);
    }
  });

  it('tablet und desktop: alle nebeneinander mit Überschrift; zurück bleibt der Reiter', () => {
    const { el, visible, tabs, layout } = setup();
    must(tabs()[3], 'Kits').click();
    for (const at of ['tablet', 'desktop'] as const) {
      layout.value = at;
      expect(visible()).toEqual(NAMES);
      expect(el.querySelector<HTMLElement>('[role=tablist]')?.hidden).toBe(true);
      const titles = [...el.querySelectorAll<HTMLElement>('.library-title')];
      expect(titles.map((t) => [t.textContent, t.hidden])).toEqual(NAMES.map((n) => [n, false]));
    }
    layout.value = 'mobile';
    expect(visible()).toEqual(['Kits']);
  });
});

describe('library: Vorlagen', () => {
  it('nur Genres; ohne geladene Vorlage der erste Stil mit Liste, Hinweis und Lade-Auswahl', () => {
    const { chips, pressed, hint, load } = setup();
    expect(chips('Stil').map((b) => b.textContent)).toEqual([
      'Lo-Fi',
      'Hip-Hop',
      'Trap',
      'House',
      'Techno',
      'Berlin',
    ]);
    expect(pressed('Stil')).toEqual(['Lo-Fi']);
    expect(chips('Vorlagen des Stils').map((b) => b.textContent)).toEqual(
      templatesOf('lofi').map((t) => t.name),
    );
    const first = must(templatesOf('lofi')[0], 'Vorlage');
    expect(chips('Vorlagen des Stils')[0]?.getAttribute('aria-label')).toBe(
      `${first.name}: ${first.hint}`,
    );
    expect(hint()).toBe(
      '5 Vorlagen. Laden ersetzt Pattern A–C, Sounds, Mixer und Song; Zurück macht es rückgängig.',
    );
    expect(load('Alles').getAttribute('aria-checked')).toBe('true');
  });

  it('Stilwechsel tauscht die Liste und räumt die alte auf', () => {
    const { chips, pick } = setup();
    const old = must(chips('Vorlagen des Stils')[0], 'Chip');
    old.click();
    expect(old.getAttribute('aria-pressed')).toBe('true');
    pick('Stil', 'House').click();
    expect(chips('Vorlagen des Stils').map((b) => b.textContent)).toEqual(
      templatesOf('house').map((t) => t.name),
    );
    // der abgehängte Chip folgt der Markierung nicht mehr
    pick('Vorlagen des Stils', 'Classic House').click();
    expect(old.getAttribute('aria-pressed')).toBe('true');
  });

  it('lädt eine Vorlage komplett, markiert sie, meldet sie; Zurück stellt alles wieder her', () => {
    const { store, pick, pressed, hint, c } = setup();
    const before = store.state.value;
    pick('Stil', 'Trap').click();
    pick('Vorlagen des Stils', 'Atlanta Trap').click();
    const s = store.state.value;
    expect([s.tempo, s.preset, s.cur]).toEqual([140, 'Atlanta Trap', 'A']);
    expect(s.synth.BA.preset).toBe('808');
    expect(s.warm).toBe(true);
    expect(pressed('Vorlagen des Stils')).toEqual(['Atlanta Trap']);
    expect(hint()).toBe('Atlanta Trap: Hat-Rolls, 808 mit Slide, Glöckchen-Melodie (140 BPM)');
    expect(c.readout.text.value).toBe('ATLANTA TRAP · 140 BPM');
    store.undo();
    expect(store.state.value).toBe(before);
  });

  it('Alles: Auswahl steht danach auf A', () => {
    const { store, pick } = setup();
    store.selectSlot('F');
    pick('Vorlagen des Stils', must(templatesOf('lofi')[0], 'Vorlage').name).click();
    expect(store.state.value.cur).toBe('A');
  });

  it('Drums lädt nur die Drum-Spuren und meldet das', () => {
    const { store, pick, load, c, pressed } = setup();
    const before = store.state.value;
    pick('Stil', 'House').click();
    load('Drums').click();
    pick('Vorlagen des Stils', 'Classic House').click();
    const s = store.state.value;
    expect(s.tempo).toBe(124);
    expect(s.patterns.A.BD).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]);
    expect(s.patterns.A.notes).toBe(before.patterns.A.notes);
    expect(s.synth).toBe(before.synth);
    expect(c.readout.text.value).toBe('CLASSIC HOUSE · DRUMS GELADEN');
    expect(pressed('Vorlagen des Stils')).toEqual(['Classic House']);
  });

  it('Drums auf Pattern F geladen: Auswahl springt auf A, Zurück stellt F und den alten Stand her', () => {
    const { store, pick, load, hint, pressed } = setup();
    store.selectSlot('F');
    const before = store.state.value;
    const tpl = must(templatesOf('lofi')[0], 'Vorlage');
    expect(tpl.pat.F).toBeUndefined();
    load('Drums').click();
    pick('Vorlagen des Stils', tpl.name).click();
    expect(store.state.value.cur).toBe('A');
    // die geladene Vorlage bleibt im Zustand: Hinweiszeile und Markierung nach dem Neuladen
    expect(store.state.value.preset).toBe(tpl.name);
    expect(hint()).toBe(`${tpl.name}: ${tpl.hint} (${String(tpl.tempo)} BPM)`);
    expect(pressed('Vorlagen des Stils')).toEqual([tpl.name]);
    store.undo();
    expect(store.state.value).toEqual(before);
    expect(store.canUndo.value).toBe(false);
  });

  it('Drums auf Pattern B geladen: B bleibt offen', () => {
    const { store, pick, load } = setup();
    const tpl = must(
      templatesOf('lofi').find((t) => t.pat.B),
      'Vorlage mit B',
    );
    store.selectSlot('B');
    load('Drums').click();
    pick('Vorlagen des Stils', tpl.name).click();
    expect(store.state.value.preset).toBe(tpl.name);
    expect(store.state.value.cur).toBe('B');
  });

  it('Sound geladen', () => {
    const { store, pick, load, c, pressed } = setup();
    store.selectSlot('F');
    const before = store.state.value;
    pick('Stil', 'House').click();
    load('Sound').click();
    pick('Vorlagen des Stils', 'Deep House').click();
    const s = store.state.value;
    expect(c.readout.text.value).toBe('NUR SOUND GELADEN');
    expect(pressed('Vorlagen des Stils')).toEqual(['Deep House']);
    expect(s.patterns).toBe(before.patterns);
    expect([s.tempo, s.cur]).toEqual([before.tempo, 'F']);
    expect(s.synth.BA.preset).toBe('Deep');
  });

  it('öffnet beim Stil der zuletzt geladenen Vorlage und markiert sie', () => {
    const tpl = must(templatesOf('techno')[1], 'Vorlage');
    const { pressed } = setup(applyTemplate(initialState(), tpl, 'all'));
    expect(pressed('Stil')).toEqual(['Techno']);
    expect(pressed('Vorlagen des Stils')).toEqual([tpl.name]);
  });

  it('die Markierung überlebt den Stilwechsel', () => {
    const { pick, pressed } = setup();
    pick('Stil', 'Trap').click();
    pick('Vorlagen des Stils', 'Atlanta Trap').click();
    pick('Stil', 'House').click();
    expect(pressed('Vorlagen des Stils')).toEqual([]);
    pick('Stil', 'Trap').click();
    expect(pressed('Vorlagen des Stils')).toEqual(['Atlanta Trap']);
  });

  it('jede Vorlage aus den Daten ist über ihren Stil erreichbar', () => {
    const { chips, pick } = setup();
    const seen = chips('Stil').flatMap((g) => {
      pick('Stil', must(g.textContent, 'Stil')).click();
      return chips('Vorlagen des Stils').map((b) => b.textContent);
    });
    expect(seen).toEqual(TEMPLATES.map((t) => t.name));
  });
});

describe('library: Basis-Muster', () => {
  it('lädt die Drum-Muster mit Markierung und Zurück', () => {
    const { store, chips, el } = setup();
    expect(el.textContent).toContain(
      'Einfache Drum-Muster: ersetzen nur die Drum-Spuren des aktuellen Patterns.',
    );
    expect(chips('Basis-Muster').map((b) => b.textContent)).toEqual(PRESETS.map((p) => p.name));
    const before = store.state.value;
    const first = must(chips('Basis-Muster')[0], 'Muster');
    first.click();
    expect(store.state.value.preset).toBe(PRESETS[0]?.name);
    expect(first.getAttribute('aria-pressed')).toBe('true');
    store.undo();
    expect(store.state.value).toEqual(before);
    expect(first.getAttribute('aria-pressed')).toBe('false');
  });
});

describe('library: Kits', () => {
  it('lädt die Drum-Parameter mit Zurück, meldet und markiert das aktive Kit', () => {
    const { store, pick, chips, pressed, c } = setup();
    expect(chips('Drum-Kit').map((b) => b.textContent)).toEqual(KITS.map((k) => k.name));
    expect(pick('Drum-Kit', 'Classic').getAttribute('aria-label')).toBe(
      `Kit Classic: ${must(KITS[0], 'Kit').hint}`,
    );
    expect(pressed('Drum-Kit')).toEqual(['Classic']);
    pick('Drum-Kit', 'Lo-Fi').click();
    expect(store.state.value.params.SD).toEqual({ level: 0.7, tune: 0.35, decay: 0.35 });
    expect(pressed('Drum-Kit')).toEqual(['Lo-Fi']);
    expect(c.readout.text.value).toBe('KIT LO-FI');
    store.undo();
    expect(pressed('Drum-Kit')).toEqual(['Classic']);
    // ein gedrehter Regler: kein Kit mehr aktiv
    store.update((s) => ({ ...s, params: { ...s.params, BD: { ...s.params.BD, tune: 0.11 } } }));
    expect(pressed('Drum-Kit')).toEqual([]);
  });
});

describe('library: Synth-Sound', () => {
  it('Synth-Sound auf Lead', () => {
    const { store, audio, c, radio, pick, pressed } = setup();
    const before = store.state.value;
    const preset = must(SYNTH_SOUNDS.LD[0], 'Preset');
    radio('Stimme', 'Lead').click();
    expect(store.state.value.part).toBe('LD');
    pick('Presets', preset.name).click();
    expect(store.state.value.synth.LD.preset).toBe(preset.name);
    expect(audio.auditionNote).toHaveBeenCalledWith('LD', 0, 2);
    expect(c.readout.text.value).toBe(`LEAD · ${preset.name.toUpperCase()}`);
    expect(store.state.value.synth.BA).toBe(before.synth.BA);
    expect(pressed('Presets')).toEqual([preset.name]);
  });

  it('der Umschalter folgt state.part; Bass meldet sich als BASS', () => {
    const { store, c, radio, chips } = setup();
    store.update((s) => ({ ...s, part: 'LD' }));
    expect(radio('Stimme', 'Lead').getAttribute('aria-checked')).toBe('true');
    radio('Stimme', 'Bass').click();
    expect(chips('Presets').map((b) => b.textContent)).toEqual(SYNTH_SOUNDS.BA.map((p) => p.name));
    const preset = must(SYNTH_SOUNDS.BA[1], 'Preset');
    must(chips('Presets')[1], 'Chip').click();
    expect(c.readout.text.value).toBe(`BASS · ${preset.name.toUpperCase()}`);
  });

  it('Laden hat Zurück; dasselbe Preset noch einmal legt keinen Schritt an', () => {
    const { store, pick, audio } = setup();
    const before = store.state.value;
    const preset = must(SYNTH_SOUNDS.BA[1], 'Preset');
    pick('Presets', preset.name).click();
    pick('Presets', preset.name).click();
    expect(audio.auditionNote).toHaveBeenCalledTimes(2);
    store.undo();
    expect(store.state.value.synth.BA).toBe(before.synth.BA);
    expect(store.canUndo.value).toBe(false);
  });
});
