import type { ReadonlySignal } from '../../store/signals.ts';
import { bind, h, listen, type Scope } from '../dom.ts';
import { chip } from './chip.ts';
import { show } from './visible.ts';
import './sheet.css';

export interface SheetOptions {
  label: string;
  open: ReadonlySignal<boolean>;
  close(): void;
  content: HTMLElement;
}

/**
 * Nicht modale Fläche über der Arbeitsfläche: Der Rest bleibt bedienbar. Öffnen fokussiert den ersten
 * Knopf, Schließen gibt den Fokus zurück, sofern er nicht inzwischen woanders liegt.
 */
export function sheet(scope: Scope, o: SheetOptions): HTMLElement {
  const close = (): void => {
    o.close();
  };
  const el = h('div', { class: 'sheet', attrs: { role: 'dialog', 'aria-label': o.label } }, [
    h('div', { class: 'sheet-head' }, [chip(scope, { label: 'Schließen', onClick: close })]),
    o.content,
  ]);
  const doc = el.ownerDocument;
  el.hidden = true;
  let opener: Element | null = null;
  bind(
    scope,
    () => o.open.value,
    (open) => {
      if (open === !el.hidden) return;
      const active = doc.activeElement;
      if (open) {
        opener = active;
        show(el, true);
        el.querySelector<HTMLElement>('button:not(:disabled)')?.focus();
      } else {
        // vor dem Ausblenden prüfen: Browser nehmen einem versteckten Element den Fokus
        const mine = el.contains(active) || active === doc.body;
        show(el, false);
        if (mine && opener instanceof HTMLElement) opener.focus();
        opener = null;
      }
    },
  );
  listen(scope, doc, 'keydown', (e) => {
    if (e.key !== 'Escape' || el.hidden || e.defaultPrevented) return;
    // ein modaler Dialog darüber schließt zuerst
    if (doc.querySelector('dialog[open]')) return;
    e.preventDefault();
    close();
  });
  return el;
}
