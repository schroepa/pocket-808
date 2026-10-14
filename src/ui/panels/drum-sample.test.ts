import { describe, expect, it } from 'vitest';
import { makeContext } from '../test-utils.ts';
import { drumSampleRow } from './drum-sample.ts';
import { stepEditor } from './step-editor.ts';
import { selectedVoice } from './voice.ts';

const flush = () => new Promise((r) => setTimeout(r, 0));

function setup() {
  const ctx = makeContext();
  const el = drumSampleRow(ctx.c, selectedVoice(ctx.store));
  const [load, orig] = [...el.querySelectorAll<HTMLButtonElement>('button')];
  if (!load || !orig) throw new Error('Knöpfe fehlen');
  return { ...ctx, el, load, orig };
}

describe('drumSampleRow', () => {
  it('lädt, speichert, hört vor und meldet', async () => {
    const { load, orig, c, audio } = setup();
    expect(load.textContent).toBe('Eigenes Sample');
    expect(orig.disabled).toBe(true);
    load.click();
    await flush();
    const s = c.samples.drums.value.get('BD');
    expect(s?.name).toBe('Kick');
    expect(s?.pcm.length).toBe(4);
    expect(audio.audition).toHaveBeenCalledWith('BD');
    expect(c.readout.text.value).toBe('BD · SAMPLE GELADEN');
    expect(load.textContent).toBe('Sample ersetzen');
    expect(orig.disabled).toBe(false);
  });

  it('schneidet lange Stille am Anfang ab (40 Samples Vorlauf)', async () => {
    const { load, c, audio } = setup();
    const pcm = new Float32Array(200);
    pcm[100] = 0.5;
    audio.decode.mockResolvedValueOnce(pcm);
    load.click();
    await flush();
    expect(c.samples.drums.value.get('BD')?.pcm.length).toBe(140);
  });

  it('Original stellt den synthetischen Klang wieder her', async () => {
    const { load, orig, c, audio } = setup();
    load.click();
    await flush();
    audio.audition.mockClear();
    orig.click();
    expect(c.samples.drums.value.has('BD')).toBe(false);
    expect(audio.audition).toHaveBeenCalledWith('BD');
    expect(c.readout.text.value).toBe('BD · ORIGINAL');
  });

  it('Abbrechen ändert nichts', async () => {
    const { load, c, files, audio } = setup();
    files.pickAudio.mockResolvedValueOnce(null);
    load.click();
    await flush();
    expect(c.samples.drums.value.size).toBe(0);
    expect(audio.audition).not.toHaveBeenCalled();
    expect(audio.decode).not.toHaveBeenCalled();
  });

  it('unlesbare Datei: Meldung, nichts gespeichert', async () => {
    const { load, c, audio, storage } = setup();
    audio.decode.mockRejectedValueOnce(new Error('kaputt'));
    load.click();
    await flush();
    expect(c.samples.drums.value.size).toBe(0);
    expect(storage.size).toBe(0);
    expect(c.readout.text.value).toBe('NICHT LESBAR');
  });

  it('steht im Step-Editor', () => {
    const { c } = makeContext();
    expect(
      stepEditor(c).querySelector('[aria-label="Eigenes Sample für diese Spur laden"]'),
    ).not.toBeNull();
  });
});
