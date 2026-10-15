import { describe, expect, it, vi } from 'vitest';
import { baseState } from '../../../core/defaults.ts';
import { encodeProject } from '../../../core/project.ts';
import type { State } from '../../../core/types.ts';
import { makeContext } from '../../test-utils.ts';
import { projectDialog } from './dialog.ts';

const flush = () => new Promise((r) => setTimeout(r, 0));
const btn = (root: HTMLElement, name: string) => {
  const b = [...root.querySelectorAll('button')].find(
    (x) => x.textContent === name || x.getAttribute('aria-label') === name,
  );
  if (!b) throw new Error(`Knopf ${name} fehlt`);
  return b;
};
const status = (root: HTMLElement) => root.querySelector('[role=status]')?.textContent ?? '';

function setup(state: State = baseState()) {
  const ctx = makeContext({ state });
  const p = projectDialog(ctx.c);
  document.body.append(p.el);
  return { ...ctx, p, root: p.el };
}

describe('Datei-Dialog: Projekt', () => {
  it('Datei-Knopf öffnet den Dialog', () => {
    const { root, scope } = setup();
    const d = root.querySelector('dialog');
    expect(d?.getAttribute('aria-label')).toBe('Projekt und Export');
    btn(root, 'Datei').click();
    expect(d?.open).toBe(true);
    scope.dispose();
  });

  it('Projekt sichern gibt eine gültige Projektdatei mit Namen aus', async () => {
    const { root, files, scope } = setup({ ...baseState(), tempo: 133 });
    btn(root, 'Projekt sichern').click();
    await flush();
    const [blob, name] = files.save.mock.calls[0] as unknown as [Blob, string];
    expect(name).toMatch(/^pocket808-\d{4}-\d\d-\d\d\.pocket808\.json$/);
    expect(blob.type).toBe('application/json');
    const raw = JSON.parse(await blob.text()) as { format: string; state: { tempo: number } };
    expect(raw.format).toBe('pocket808');
    expect(raw.state.tempo).toBe(133);
    expect(status(root)).toBe('Projekt gesichert');
    scope.dispose();
  });

  it('Abbruch im Teilen-Menü meldet nichts', async () => {
    const { root, files, scope } = setup();
    files.save.mockResolvedValueOnce('cancelled');
    btn(root, 'Projekt sichern').click();
    await flush();
    expect(status(root)).toBe('');
    scope.dispose();
  });

  it('fremde Datei: Meldung, nichts ändert sich', async () => {
    const { root, files, store, scope } = setup();
    const before = store.state.value;
    files.pickProject.mockResolvedValueOnce({ text: '{"x":1}', name: 'x.json' });
    btn(root, 'Projekt öffnen').click();
    await flush();
    expect(status(root)).toBe('Keine Pocket-808-Datei');
    expect(store.state.value).toBe(before);
    scope.dispose();
  });

  it('Abbrechen der Auswahl tut nichts', async () => {
    const { root, files, store, scope } = setup();
    const before = store.state.value;
    files.pickProject.mockResolvedValueOnce(null);
    btn(root, 'Projekt öffnen').click();
    await flush();
    expect(store.state.value).toBe(before);
    expect(status(root)).toBe('');
    scope.dispose();
  });

  it('gültige Datei: Frage, Abbrechen lässt alles wie es ist', async () => {
    const { root, files, store, scope } = setup();
    const before = store.state.value;
    const text = encodeProject(
      { state: { ...baseState(), tempo: 77 }, pads: [], drums: {} },
      new Date(),
    );
    files.pickProject.mockResolvedValueOnce({ text, name: 'a.json' });
    btn(root, 'Projekt öffnen').click();
    await flush();
    const ask = root.querySelector<HTMLElement>('.replace-ask');
    expect(ask?.hidden).toBe(false);
    expect(ask?.textContent).toContain('Aktuelles Projekt ersetzen?');
    btn(root, 'Abbrechen').click();
    expect(ask?.hidden).toBe(true);
    expect(store.state.value).toBe(before);
    scope.dispose();
  });

  it('Ersetzen übernimmt Zustand und Samples; Zurück stellt beides wieder her', async () => {
    const { root, files, store, c, scope } = setup();
    const tempo = store.state.value.tempo;
    const pad = Float32Array.from([0.5, -0.5]);
    const text = encodeProject(
      {
        state: { ...baseState(), tempo: 77 },
        pads: [pad],
        drums: { SD: { pcm: pad, name: 'Snap' } },
      },
      new Date(),
    );
    files.pickProject.mockResolvedValueOnce({ text, name: 'a.json' });
    btn(root, 'Projekt öffnen').click();
    await flush();
    btn(root, 'Ersetzen').click();
    expect(store.state.value.tempo).toBe(77);
    expect(c.samples.pads.value[0]?.length).toBe(2);
    expect(c.samples.drums.value.get('SD')?.name).toBe('Snap');
    expect(status(root)).toBe('Projekt geöffnet');
    expect(root.querySelector<HTMLElement>('.replace-ask')?.hidden).toBe(true);
    store.undo();
    expect(store.state.value.tempo).toBe(tempo);
    expect(c.samples.pads.value[0]).toBeNull();
    expect(c.samples.drums.value.size).toBe(0);
    scope.dispose();
  });

  it('open() von außen (Kürzel) öffnet bei gültiger Datei den Dialog mit der Frage', async () => {
    const { root, files, p, scope } = setup();
    const text = encodeProject({ state: baseState(), pads: [], drums: {} }, new Date());
    files.pickProject.mockResolvedValueOnce({ text, name: 'a.json' });
    await p.open();
    expect(root.querySelector('dialog')?.open).toBe(true);
    expect(root.querySelector<HTMLElement>('.replace-ask')?.hidden).toBe(false);
    scope.dispose();
  });
});

describe('Datei-Dialog: Audio exportieren', () => {
  it('zeigt die Länge; leerer Song ist gesperrt', () => {
    const { root, scope } = setup({ ...baseState(), tempo: 90, song: [] });
    expect(root.querySelector('.export-len')?.textContent).toBe('Länge 0:05');
    expect(btn(root, 'Song').disabled).toBe(true);
    expect(btn(root, 'WAV erzeugen').disabled).toBe(false);
    btn(root, '4×').click();
    expect(root.querySelector('.export-len')?.textContent).toBe('Länge 0:13');
    scope.dispose();
  });

  it('zu lang: gesperrt mit Hinweis', () => {
    const song = Array.from({ length: 32 }, () => ({ p: 'A' as const, n: 16 }));
    const { root, scope } = setup({ ...baseState(), tempo: 60, song });
    btn(root, 'Song').click();
    expect(btn(root, 'WAV erzeugen').disabled).toBe(true);
    expect(root.querySelector('.export-len')?.textContent).toBe(
      'Zu lang für den Export (max. 5 min)',
    );
    expect(root.querySelector<HTMLElement>('.export-reps')?.hidden).toBe(true);
    scope.dispose();
  });

  it('erzeugt mit Fortschritt, dann WAV sichern', async () => {
    const { root, audio, files, scope } = setup({ ...baseState(), tempo: 90, mode: 'song' });
    let finish: (b: Blob | null) => void = () => undefined;
    audio.exportWav.mockImplementationOnce(
      () =>
        new Promise<Blob | null>((r) => {
          finish = r;
        }),
    );
    btn(root, 'WAV erzeugen').click();
    const [state, playFor, seconds, onProgress] = audio.exportWav.mock.calls[0] as unknown as [
      State,
      number,
      number,
      (f: number) => void,
    ];
    expect(state.mode).toBe('pattern');
    expect(playFor).toBeCloseTo((16 * 60) / 90 / 4);
    expect(seconds).toBeCloseTo(playFor + 2);
    expect(btn(root, 'WAV erzeugen').disabled).toBe(true);
    onProgress(0.5);
    expect(status(root)).toBe('Rendere … 50 %');
    const wav = new Blob(['RIFF'], { type: 'audio/wav' });
    finish(wav);
    await flush();
    expect(status(root)).toBe('Export fertig · 0:05');
    const save = btn(root, 'WAV sichern');
    expect(save.hidden).toBe(false);
    save.click();
    await flush();
    expect(files.save).toHaveBeenCalledWith(wav, expect.stringMatching(/^pocket808-pattern-A-1x-/));
    btn(root, '2×').click();
    expect(save.hidden).toBe(true);
    scope.dispose();
  });

  it('Song-Export rendert im Song-Modus', () => {
    const { root, audio, scope } = setup({ ...baseState(), song: [{ p: 'B', n: 2 }] });
    btn(root, 'Song').click();
    btn(root, 'WAV erzeugen').click();
    const [state] = audio.exportWav.mock.calls[0] as unknown as [State];
    expect(state.mode).toBe('song');
    scope.dispose();
  });

  it('Abbrechen bricht ab und meldet es; danach geht ein neuer Export', async () => {
    const { root, audio, scope } = setup();
    let finish: (b: Blob | null) => void = () => undefined;
    audio.exportWav.mockImplementationOnce(
      (_s: State, _p: number, _x: number, _o: (f: number) => void, signal: AbortSignal) =>
        new Promise<Blob | null>((r) => {
          finish = r;
          signal.addEventListener('abort', () => {
            r(null);
          });
        }),
    );
    btn(root, 'WAV erzeugen').click();
    const cancel = btn(root, 'Export abbrechen');
    expect(cancel.hidden).toBe(false);
    cancel.click();
    await flush();
    finish(null);
    expect(status(root)).toBe('Export abgebrochen');
    expect(cancel.hidden).toBe(true);
    expect(btn(root, 'WAV erzeugen').disabled).toBe(false);
    scope.dispose();
  });

  it('ein Fehler beim Rendern wird gemeldet', async () => {
    const { root, audio, scope } = setup();
    audio.exportWav.mockRejectedValueOnce(new Error('kaputt'));
    btn(root, 'WAV erzeugen').click();
    await flush();
    expect(status(root)).toBe('Export fehlgeschlagen');
    expect(btn(root, 'WAV erzeugen').disabled).toBe(false);
    scope.dispose();
  });

  it('ohne Web Audio ist der Export gesperrt', () => {
    const ctx = makeContext({ available: false });
    const p = projectDialog(ctx.c);
    expect(btn(p.el, 'WAV erzeugen').disabled).toBe(true);
    ctx.scope.dispose();
  });

  it('Abbau während des Renderns bricht ab', () => {
    const { root, audio, scope } = setup();
    let sig: AbortSignal | null = null;
    audio.exportWav.mockImplementationOnce(
      (_s: State, _p: number, _x: number, _o: (f: number) => void, signal: AbortSignal) => {
        sig = signal;
        return new Promise<Blob | null>(() => undefined);
      },
    );
    btn(root, 'WAV erzeugen').click();
    scope.dispose();
    expect((sig as AbortSignal | null)?.aborted).toBe(true);
    vi.restoreAllMocks();
  });
});

describe('Datei-Dialog: Randfälle', () => {
  it('öffnet modal, wo es showModal gibt; ein zweites Öffnen lässt ihn offen', () => {
    const { root, scope } = setup();
    const d = root.querySelector('dialog');
    if (!d) throw new Error('kein Dialog');
    const modal = vi.fn(() => {
      d.setAttribute('open', '');
    });
    d.showModal = modal;
    btn(root, 'Datei').click();
    btn(root, 'Datei').click();
    expect(modal).toHaveBeenCalledTimes(1);
    expect(d.open).toBe(true);
    scope.dispose();
  });

  it('nicht lesbare Datei gilt als fremd', async () => {
    const { root, files, scope } = setup();
    files.pickProject.mockRejectedValueOnce(new Error('lesen'));
    btn(root, 'Projekt öffnen').click();
    await flush();
    expect(status(root)).toBe('Keine Pocket-808-Datei');
    scope.dispose();
  });

  it('versteckte Knöpfe tun ohne passenden Zustand nichts; Fortschritt nach Abbruch zählt nicht', async () => {
    const { root, audio, files, scope } = setup();
    btn(root, 'Export abbrechen').click();
    btn(root, 'WAV sichern').click();
    expect(files.save).not.toHaveBeenCalled();
    let progress: (f: number) => void = () => undefined;
    audio.exportWav.mockImplementationOnce(
      (_s: State, _p: number, _x: number, onProgress: (f: number) => void) => {
        progress = onProgress;
        return Promise.resolve(null);
      },
    );
    btn(root, 'WAV erzeugen').click();
    btn(root, 'Export abbrechen').click();
    progress(0.9);
    expect(status(root)).not.toContain('90');
    await flush();
    scope.dispose();
  });
});
