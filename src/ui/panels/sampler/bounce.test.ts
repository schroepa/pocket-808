import { describe, expect, it } from 'vitest';
import type { State } from '../../../core/types.ts';
import { makeContext } from '../../test-utils.ts';
import { createMessage } from './message.ts';
import { samplerTools } from './tools.ts';

const flush = () => new Promise((r) => setTimeout(r, 0));
const btn = (el: HTMLElement, name: string) =>
  [...el.querySelectorAll<HTMLButtonElement>('button')].find(
    (b) => b.textContent === name || b.getAttribute('aria-label') === name,
  );

function setup() {
  const ctx = makeContext();
  const msg = createMessage(ctx.scope);
  const el = samplerTools(ctx.c, msg);
  el.append(msg.el);
  return { ...ctx, el, msg };
}

describe('Bounce', () => {
  it('leeres Pad: rendert das Pattern im Pattern-Modus und legt es als „Bounce“ ab', async () => {
    const { el, audio, c, store, msg, scope } = setup();
    const pcm = Float32Array.from([0.1, 0.2]);
    audio.bounce.mockResolvedValueOnce({ pcm, cut: false });
    store.update((s) => ({ ...s, mode: 'song' }));
    btn(el, 'Pattern auf dieses Pad bouncen')?.click();
    expect(msg.el.textContent).toBe('Bounce läuft …');
    const [state] = audio.bounce.mock.calls[0] as unknown as [State];
    expect(state.mode).toBe('pattern');
    await flush();
    expect(c.samples.pads.value[0]).toBe(pcm);
    expect(store.state.value.smp.pads[0]?.name).toBe('Bounce');
    expect(msg.el.textContent).toBe('Pad 1: Bounce');
    expect(audio.auditionPad).toHaveBeenCalledWith(0);
    scope.dispose();
  });

  it('volles Pad: erst fragen; Abbrechen tut nichts, Ersetzen bounct', async () => {
    const { el, audio, c, msg, scope } = setup();
    c.samples.setPad(0, Float32Array.from([0.5]));
    btn(el, 'Pattern auf dieses Pad bouncen')?.click();
    const ask = el.querySelector<HTMLElement>('.bounce-ask');
    expect(ask?.hidden).toBe(false);
    expect(ask?.textContent).toContain('Pad 1 ersetzen?');
    expect(audio.bounce).not.toHaveBeenCalled();
    btn(el, 'Abbrechen')?.click();
    expect(ask?.hidden).toBe(true);
    expect(audio.bounce).not.toHaveBeenCalled();
    btn(el, 'Pattern auf dieses Pad bouncen')?.click();
    audio.bounce.mockResolvedValueOnce({ pcm: Float32Array.from([0.3]), cut: true });
    btn(el, 'Ersetzen')?.click();
    expect(ask?.hidden).toBe(true);
    await flush();
    expect(msg.el.textContent).toBe('Pad 1: Bounce (auf 3 s gekürzt)');
    scope.dispose();
  });

  it('Fehler und Abbruch melden; ein zweiter Tipp während des Renderns zählt nicht', async () => {
    const { el, audio, msg, scope } = setup();
    let finish: (v: null) => void = () => undefined;
    audio.bounce.mockImplementationOnce(
      () =>
        new Promise((r) => {
          finish = r;
        }),
    );
    btn(el, 'Pattern auf dieses Pad bouncen')?.click();
    btn(el, 'Pattern auf dieses Pad bouncen')?.click();
    expect(audio.bounce).toHaveBeenCalledTimes(1);
    finish(null);
    await flush();
    expect(msg.el.textContent).toBe('Bounce fehlgeschlagen');
    audio.bounce.mockRejectedValueOnce(new Error('kaputt'));
    btn(el, 'Pattern auf dieses Pad bouncen')?.click();
    await flush();
    expect(msg.el.textContent).toBe('Bounce fehlgeschlagen');
    scope.dispose();
  });
});
