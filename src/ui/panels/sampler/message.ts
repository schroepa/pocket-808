import { h, type Scope } from '../../dom.ts';

export interface Message {
  readonly el: HTMLElement;
  /** Meldung zeigen; ohne keep nach 4,5 s ausblenden (Legacy smpNote) */
  show(text: string, keep?: boolean): void;
}

export function createMessage(scope: Scope): Message {
  const el = h('div', { class: 'smp-msg', attrs: { role: 'status' } });
  el.hidden = true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  scope.add(() => {
    clearTimeout(timer);
  });
  return {
    el,
    show(text, keep = false) {
      el.textContent = text;
      el.hidden = false;
      clearTimeout(timer);
      if (!keep) {
        timer = setTimeout(() => {
          el.hidden = true;
        }, 4500);
      }
    },
  };
}
