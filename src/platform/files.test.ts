import { describe, expect, it } from 'vitest';
import { fileBaseName, pickAudioFile } from './files.ts';

describe('fileBaseName', () => {
  it.each([
    ['kick.wav', 'kick'],
    ['Mein langer Name.final.mp3', 'Mein langer '],
    ['ohne', 'ohne'],
  ])('%s → %s', (n, e) => {
    expect(fileBaseName(n)).toBe(e);
  });
});

describe('pickAudioFile', () => {
  function capture() {
    let input: HTMLInputElement | null = null;
    const doc = {
      createElement: (tag: string) => {
        const el = document.createElement(tag);
        if (el instanceof HTMLInputElement) {
          input = el;
          el.click = () => undefined;
        }
        return el;
      },
    };
    const get = (): HTMLInputElement => {
      if (!input) throw new Error('kein input');
      return input;
    };
    return { doc, get };
  }
  it('liefert Daten und Namen der gewählten Datei', async () => {
    const { doc, get } = capture();
    const p = pickAudioFile(doc as never, { capture: true });
    const el = get();
    expect(el.accept).toBe('audio/*');
    expect(el.type).toBe('file');
    expect(el.hasAttribute('capture')).toBe(true);
    Object.defineProperty(el, 'files', {
      value: [new File([new Uint8Array([1, 2, 3])], 'snare.wav')],
    });
    el.dispatchEvent(new Event('change'));
    const r = await p;
    expect(r?.name).toBe('snare');
    expect(r?.data.byteLength).toBe(3);
  });
  it('Abbrechen oder leere Auswahl liefert null', async () => {
    const a = capture();
    const p1 = pickAudioFile(a.doc as never);
    expect(a.get().hasAttribute('capture')).toBe(false);
    a.get().dispatchEvent(new Event('cancel'));
    expect(await p1).toBeNull();
    const b = capture();
    const p2 = pickAudioFile(b.doc as never);
    Object.defineProperty(b.get(), 'files', { value: [] });
    b.get().dispatchEvent(new Event('change'));
    expect(await p2).toBeNull();
  });
  it('Lesefehler lehnt ab', async () => {
    const { doc, get } = capture();
    const p = pickAudioFile(doc as never);
    const f = new File([], 'x.wav');
    Object.defineProperty(f, 'arrayBuffer', { value: () => Promise.reject(new Error('weg')) });
    Object.defineProperty(get(), 'files', { value: [f] });
    get().dispatchEvent(new Event('change'));
    await expect(p).rejects.toThrow('weg');
  });
});
