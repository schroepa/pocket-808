import { SONG_MAX } from '../../core/song.ts';
import type { SongEntry } from '../../core/types.ts';
import { computed, signal, type ReadonlySignal } from '../../store/signals.ts';
import type { UiContext } from '../context.ts';
import { chip } from '../controls/chip.ts';
import { bind, createScope, h } from '../dom.ts';
import './song.css';

/** Song-Kette mit Werkzeugen (Legacy buildSong, renderChain, bump, moveBlk, delBlk) */
export function songPanel(c: UiContext): HTMLElement {
  const { store, scope, audio } = c;
  const song = store.select((s) => s.song);
  const selected = signal(-1);
  const has = computed(() => selected.value >= 0 && selected.value < song.value.length);
  const entry = computed((): SongEntry | undefined => song.value[selected.value]);

  const chain = h('div', { class: 'chain' });
  let inner = createScope();
  scope.add(() => {
    inner.dispose();
  });
  bind(
    scope,
    () => song.value,
    (list) => {
      inner.dispose();
      inner = createScope();
      const s = inner;
      if (!list.length) {
        chain.replaceChildren(
          h('div', {
            class: 'chain-empty',
            text: 'Noch leer. Wähle ein Pattern und tippe auf „anhängen“.',
          }),
        );
        return;
      }
      chain.replaceChildren(
        ...list.map((e, i) => {
          const b = h(
            'button',
            {
              class: 'blk',
              attrs: {
                type: 'button',
                'aria-label': `Position ${i + 1}: Pattern ${e.p}, ${e.n} mal`,
              },
              on: {
                click: () => {
                  selected.value = i;
                  const st = store.state.peek();
                  if (!(audio.playing.peek() && st.mode === 'song')) store.selectSlot(e.p);
                },
              },
            },
            [e.p, h('small', { text: `×${e.n}` })],
          );
          bind(
            s,
            () => selected.value === i,
            (on) => {
              b.classList.toggle('sel', on);
            },
          );
          bind(
            s,
            () => audio.playhead.value.songIndex === i,
            (on) => {
              b.classList.toggle('play', on);
            },
          );
          return b;
        }),
      );
    },
  );
  const tool = (
    label: string | ReadonlySignal<string>,
    ariaLabel: string,
    disabled: () => boolean,
    fn: () => void,
  ) => chip(scope, { label, ariaLabel, disabled: computed(disabled), onClick: fn });
  const tools = h('div', { class: 'chips song-tools' }, [
    tool(
      computed(() => `+ ${store.state.value.cur} anhängen`),
      'Aktuelles Pattern an den Song anhängen',
      () => song.value.length >= SONG_MAX,
      () => {
        store.appendToSong();
        selected.value = song.peek().length - 1;
      },
    ),
    tool(
      '−',
      'Wiederholungen verringern',
      () => (entry.value?.n ?? 1) <= 1,
      () => {
        store.bumpRepeat(selected.peek(), -1);
      },
    ),
    tool(
      '+',
      'Wiederholungen erhöhen',
      () => (entry.value?.n ?? 16) >= 16,
      () => {
        store.bumpRepeat(selected.peek(), 1);
      },
    ),
    tool(
      '←',
      'Nach vorne schieben',
      () => !has.value || selected.value === 0,
      () => {
        store.moveEntry(selected.peek(), -1);
        selected.value -= 1;
      },
    ),
    tool(
      '→',
      'Nach hinten schieben',
      () => !has.value || selected.value === song.value.length - 1,
      () => {
        store.moveEntry(selected.peek(), 1);
        selected.value += 1;
      },
    ),
    tool(
      'Entfernen',
      'Position entfernen',
      () => !has.value,
      () => {
        store.removeEntry(selected.peek());
        selected.value = Math.min(selected.peek(), song.peek().length - 1);
      },
    ),
  ]);
  return h(
    'section',
    { class: 'panel song', attrs: { 'aria-label': 'Song', 'data-area': 'song' } },
    [
      h('div', { class: 'ed-head' }, [
        h('h2', {}, ['Song', h('small', { text: 'Reihenfolge' })]),
        chip(scope, {
          label: 'Leeren',
          onClick: () => {
            store.clearSong();
            selected.value = -1;
          },
        }),
      ]),
      chain,
      tools,
    ],
  );
}
