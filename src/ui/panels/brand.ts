import { h } from '../dom.ts';
import './deck.css';

/** Kopf mit Name, Untertitel und Farbstreifen; extra z. B. der Kürzel-Knopf (Desktop). */
export function brand(extra?: HTMLElement): HTMLElement {
  return h('header', { class: 'brand', attrs: { 'data-area': 'brand' } }, [
    h('div', {}, [
      h('h1', { text: 'Pocket 808' }),
      h('div', { class: 'brand-sub', text: 'Drum Machine · Synth' }),
    ]),
    extra ?? null,
    h('div', { class: 'stripe', attrs: { 'aria-hidden': 'true' } }, [
      h('i'),
      h('i'),
      h('i'),
      h('i'),
    ]),
  ]);
}
