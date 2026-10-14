import { effect, untracked } from '../store/signals.ts';

/*
 * Kleinste DOM-Schicht: Elemente erzeugen, Werte aus Signalen binden, Listener mit Aufräumen.
 * Alles, was an einem Scope hängt, endet mit scope.dispose().
 */

export interface Scope {
  add(fn: () => void): void;
  dispose(): void;
}

export function createScope(): Scope {
  let fns: (() => void)[] = [];
  return {
    add(fn) {
      fns.push(fn);
    },
    dispose() {
      const list = fns;
      fns = [];
      for (const fn of list.reverse()) fn();
    },
  };
}

type Child = Node | string | null | false;

export interface Props {
  class?: string;
  text?: string;
  attrs?: Readonly<Record<string, string>>;
  on?: { [K in keyof HTMLElementEventMap]?: (e: HTMLElementEventMap[K]) => void };
}

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Props = {},
  children: readonly Child[] = [],
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props.class) el.className = props.class;
  if (props.text !== undefined) el.textContent = props.text;
  for (const [k, v] of Object.entries(props.attrs ?? {})) el.setAttribute(k, v);
  for (const [type, fn] of Object.entries(props.on ?? {})) {
    el.addEventListener(type, fn as EventListener);
  }
  for (const c of children) if (c !== null && c !== false) el.append(c);
  return el;
}

const UNSET: unique symbol = Symbol('unset');

/** read() bestimmt die Abhängigkeiten; apply() schreibt ins DOM, nur wenn sich der Wert ändert. */
export function bind<T>(scope: Scope, read: () => T, apply: (v: T) => void): void {
  let last: T | typeof UNSET = UNSET;
  scope.add(
    effect(() => {
      const v = read();
      if (last !== UNSET && Object.is(v, last)) return;
      last = v;
      untracked(() => {
        apply(v);
      });
    }),
  );
}

/** Listener mit Aufräumen; der Ereignistyp folgt aus dem Namen (HTMLElementEventMap). */
export function listen<K extends keyof HTMLElementEventMap>(
  scope: Scope,
  target: EventTarget,
  type: K,
  fn: (e: HTMLElementEventMap[K]) => void,
  opts?: AddEventListenerOptions,
): void {
  const handler = fn as EventListener;
  target.addEventListener(type, handler, opts);
  scope.add(() => {
    target.removeEventListener(type, handler, opts);
  });
}
