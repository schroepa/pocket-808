import { afterEach, describe, expect, it, vi } from 'vitest';
import { baseState } from '../core/defaults.ts';
import { createSampleBank } from '../store/samples.ts';
import { createStore } from '../store/store.ts';
import { mountShell } from './shell.ts';
import { fakeAudio, manualTimer } from './test-utils.ts';

const media = (matches: Record<string, boolean>) => (q: string) =>
  ({
    matches: matches[q] ?? false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }) as unknown as MediaQueryList;

const mounted: { dispose(): void }[] = [];
afterEach(() => {
  for (const m of mounted.splice(0)) m.dispose();
});

function mount(matches: Record<string, boolean> = {}) {
  const root = document.createElement('div');
  document.body.replaceChildren(root);
  const audio = fakeAudio();
  const raf = { request: vi.fn(() => 7), cancel: vi.fn() };
  const shell = mountShell(root, {
    store: createStore(baseState()),
    samples: createSampleBank({ getItem: () => null, setItem: () => undefined }, {}),
    audio,
    files: { pickAudio: () => Promise.resolve(null) },
    timer: manualTimer(),
    win: {
      matchMedia: media(matches),
      requestAnimationFrame: raf.request,
      cancelAnimationFrame: raf.cancel,
    },
  });
  mounted.push(shell);
  return { root, shell, audio, raf };
}

describe('mountShell', () => {
  it('baut die Bereiche in Lesereihenfolge', () => {
    const { root } = mount();
    const areas = [...root.querySelectorAll('[data-area]')].map((e) => e.getAttribute('data-area'));
    expect(areas).toEqual(['brand', 'deck', 'slots', 'editor', 'tracks', 'devices', 'transport']);
  });
  it('setzt data-layout am Dokument', () => {
    const { shell } = mount({ '(min-width: 768px)': true, '(min-width: 1024px)': true });
    expect(document.documentElement.dataset.layout).toBe('desktop');
    expect(shell.layout.value).toBe('desktop');
  });
  it('Start lässt den Lauflicht-Takt laufen, Stopp beendet ihn', () => {
    const { root, raf } = mount();
    const play = root.querySelector<HTMLButtonElement>('.play');
    play?.click();
    expect(raf.request).toHaveBeenCalled();
    play?.click();
    expect(raf.cancel).toHaveBeenCalledWith(7);
  });
  it('dispose räumt Bindungen ab und leert die Wurzel', () => {
    const { root, shell, audio } = mount();
    shell.dispose();
    expect(root.childElementCount).toBe(0);
    audio.playhead.value = { step: 3, songIndex: -1 };
    expect(document.querySelector('.now')).toBeNull();
  });
  it('Tastaturkürzel wirken auf dem Desktop', () => {
    const { audio, shell } = mount({ '(min-width: 768px)': true, '(min-width: 1024px)': true });
    document.body.dispatchEvent(
      new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }),
    );
    expect(audio.start).toHaveBeenCalled();
    shell.dispose();
  });
});
