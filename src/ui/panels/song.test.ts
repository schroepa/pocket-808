import { describe, expect, it, onTestFinished } from 'vitest';
import { makeContext } from '../test-utils.ts';
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

  it('die gespielte Position bleibt in der scrollenden Kette sichtbar', () => {
    const { el, blocks, store, audio } = songSetup();
    store.update((s) => ({
      ...s,
      song: Array.from({ length: 32 }, () => ({ p: 'A' as const, n: 1 })),
    }));
    const chain = el.querySelector<HTMLElement>('.chain');
    if (!chain) throw new Error('Kette');
    // jsdom rechnet kein Layout: Reihen zu 64 px, sichtbar 128 px
    Object.defineProperty(chain, 'clientHeight', { value: 128 });
    blocks().forEach((b, i) => {
      Object.defineProperty(b, 'offsetTop', { value: Math.floor(i / 6) * 64 });
      Object.defineProperty(b, 'offsetHeight', { value: 58 });
    });
    audio.playhead.value = { step: 0, songIndex: 3 };
    expect(chain.scrollTop).toBe(0);
    audio.playhead.value = { step: 0, songIndex: 20 };
    expect(chain.scrollTop).toBe(3 * 64 + 58 - 128);
    audio.playhead.value = { step: 0, songIndex: 31 };
    expect(chain.scrollTop).toBe(5 * 64 + 58 - 128);
    audio.playhead.value = { step: 0, songIndex: 0 };
    expect(chain.scrollTop).toBe(0);
  });

  it('Umbau beim Spielen: die Kette bleibt stehen, außer die gespielte Position wäre verdeckt', () => {
    // jsdom rechnet kein Layout: Reihen zu 64 px; ein nicht eingehängter Block liegt bei 0
    Object.defineProperty(HTMLElement.prototype, 'offsetTop', {
      configurable: true,
      get(this: HTMLElement) {
        const box = this.parentElement;
        if (!box?.classList.contains('chain')) return 0;
        return Math.floor([...box.children].indexOf(this) / 6) * 64;
      },
    });
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
      configurable: true,
      get: () => 58,
    });
    onTestFinished(() => {
      Reflect.deleteProperty(HTMLElement.prototype, 'offsetTop');
      Reflect.deleteProperty(HTMLElement.prototype, 'offsetHeight');
    });
    const { el, btn, blocks, store, audio } = songSetup();
    store.update((s) => ({
      ...s,
      song: Array.from({ length: 31 }, () => ({ p: 'A' as const, n: 1 })),
    }));
    const chain = el.querySelector<HTMLElement>('.chain');
    if (!chain) throw new Error('Kette');
    Object.defineProperty(chain, 'clientHeight', { value: 128 });
    audio.playing.value = true;
    store.setMode('song');
    audio.playhead.value = { step: 0, songIndex: 20 };
    expect(chain.scrollTop).toBe(3 * 64 + 58 - 128);

    // gespielte Position (Reihe 3) ist sichtbar: jede Änderung lässt die Kette, wo sie ist
    chain.scrollTop = 150;
    blocks()[19]?.click();
    for (const label of [
      'Wiederholungen erhöhen',
      'Wiederholungen verringern',
      'Nach vorne schieben',
      'Nach hinten schieben',
      'Aktuelles Pattern an den Song anhängen',
      'Position entfernen',
    ]) {
      btn(label).click();
      expect(chain.scrollTop, label).toBe(150);
    }

    // weggescrollt: der Umbau holt die gespielte Position zurück
    chain.scrollTop = 0;
    btn('Aktuelles Pattern an den Song anhängen').click();
    expect(chain.scrollTop).toBe(3 * 64 + 58 - 128);
  });
});
