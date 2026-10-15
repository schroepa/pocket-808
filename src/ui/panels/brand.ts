import { h } from '../dom.ts';
import './deck.css';

/** Kopf mit Name, Untertitel und Farbstreifen; tools z. B. Datei-Knopf und Kürzel-Knopf (Desktop). */
export function brand(...tools: HTMLElement[]): HTMLElement {
  return h('header', { class: 'brand', attrs: { 'data-area': 'brand' } }, [
    h('div', {}, [
      h('h1', { text: 'Pocket 808' }),
      h('div', { class: 'brand-sub', text: 'Drum Machine · Synth' }),
    ]),
    tools.length ? h('div', { class: 'brand-tools' }, tools) : null,
    h('div', { class: 'stripe', attrs: { 'aria-hidden': 'true' } }, [
      h('i'),
      h('i'),
      h('i'),
      h('i'),
    ]),
  ]);
}
