import { SLOTS } from '../core/constants.ts';
import { must } from '../core/util.ts';
import type { ReadonlySignal } from '../store/signals.ts';
import type { UiContext } from './context.ts';
import { chip } from './controls/chip.ts';
import { h, listen } from './dom.ts';
import type { Layout } from './layout.ts';

const TEXT = 'input, textarea, select, [contenteditable]';
const OWN_ARROWS = '[role=slider], [role=radio], [role=tab]';

export const SHORTCUTS: readonly (readonly [string, string])[] = [
  ['Leertaste', 'Start / Stopp'],
  ['1 – 8', 'Pattern A – H'],
  ['↑ / ↓', 'Spur wählen'],
  ['⌘/Strg + Z', 'Zurück'],
  ['⌘/Strg + C', 'Pattern kopieren'],
  ['⌘/Strg + V', 'Pattern einfügen'],
  ['⌘/Strg + S', 'Projekt sichern'],
  ['⌘/Strg + O', 'Projekt öffnen'],
];

/** Aktionen des Datei-Dialogs für die Kürzel ⌘/Strg+S und ⌘/Strg+O */
export interface FileActions {
  save(): void;
  open(): void;
}

/** Tastaturkürzel, nur im Desktop-Layout; Texteingaben und eigene Tasten der Regler haben Vorrang. */
export function installKeys(
  c: UiContext,
  layout: ReadonlySignal<Layout>,
  doc: Document,
  files?: FileActions,
): void {
  const { store, audio, readout } = c;
  listen(c.scope, doc, 'keydown', (e) => {
    if (layout.peek() !== 'desktop' || e.defaultPrevented) return;
    const t = e.target instanceof Element ? e.target : doc.body;
    // Texteingaben und ein offener (modaler) Dialog haben Vorrang
    if (t.closest(TEXT) || doc.querySelector('dialog[open]')) return;
    const mod = e.metaKey || e.ctrlKey;
    const k = e.key.toLowerCase();
    if (e.key === ' ' && !mod) {
      e.preventDefault();
      if (e.repeat) return;
      if (audio.playing.peek()) audio.stop();
      else audio.start();
    } else if (!mod && !e.altKey && !e.repeat && /^[1-8]$/.test(e.key)) {
      store.selectSlot(must(SLOTS[Number(e.key) - 1], 'Slot'));
    } else if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && !mod) {
      if (t.closest(OWN_ARROWS)) return;
      e.preventDefault();
      const d = e.key === 'ArrowUp' ? -1 : 1;
      store.update((s) => ({ ...s, sel: Math.min(9, Math.max(0, s.sel + d)) }));
    } else if (mod && k === 'z' && !e.shiftKey) {
      e.preventDefault();
      store.undo();
    } else if (mod && k === 'c') {
      if (doc.getSelection()?.toString()) return;
      e.preventDefault();
      store.copy();
      readout.flash(`PATTERN ${store.state.peek().cur} KOPIERT`);
    } else if (mod && files && (k === 's' || k === 'o')) {
      e.preventDefault();
      if (k === 's') files.save();
      else files.open();
    } else if (mod && k === 'v') {
      if (!store.canPaste.peek()) return;
      e.preventDefault();
      store.paste();
      readout.flash(`EINGEFÜGT IN ${store.state.peek().cur}`);
    }
  });
}

/** Knopf „?“ mit Dialog, der die Kürzel auflistet (nur auf dem Desktop sichtbar, deck.css). */
export function shortcutHelp(c: UiContext): HTMLElement {
  const dialog = h('dialog', { class: 'keys-help', attrs: { 'aria-label': 'Tastaturkürzel' } }, [
    h('h2', { text: 'Tastaturkürzel' }),
    h(
      'dl',
      {},
      SHORTCUTS.flatMap(([k, v]) => [h('dt', { text: k }), h('dd', { text: v })]),
    ),
    h('form', { attrs: { method: 'dialog' } }, [h('button', { class: 'chip', text: 'Schließen' })]),
  ]);
  const open = chip(c.scope, {
    label: '?',
    ariaLabel: 'Tastaturkürzel',
    onClick: () => {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    },
  });
  return h('div', { class: 'help' }, [open, dialog]);
}
