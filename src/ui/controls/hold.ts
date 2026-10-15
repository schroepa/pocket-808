import { h, listen, type Scope } from '../dom.ts';

/**
 * Taste zum Halten (Stutter, Fill): Zeiger runter oder Enter/Leertaste schaltet ein. Loslassen, Abbruch,
 * Zeigerverlust, Fokusverlust, ein verstecktes Fenster und der Abbau schalten immer aus: Es darf nie
 * etwas hängen bleiben. Aktiv: Klasse on und aria-pressed.
 */
export function holdButton(
  scope: Scope,
  o: { class: string; text: string; ariaLabel: string; on(): void; off(): void },
): HTMLButtonElement {
  const b = h('button', {
    class: o.class,
    text: o.text,
    attrs: { type: 'button', 'aria-label': o.ariaLabel, 'aria-pressed': 'false' },
  });
  const set = (v: boolean): void => {
    if (b.classList.contains('on') === v) return;
    b.classList.toggle('on', v);
    b.setAttribute('aria-pressed', String(v));
    if (v) o.on();
    else o.off();
  };
  const off = (): void => {
    set(false);
  };
  listen(scope, b, 'pointerdown', (e) => {
    e.preventDefault();
    try {
      b.setPointerCapture(e.pointerId);
    } catch {
      /* jsdom und ältere Browser */
    }
    set(true);
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) {
    listen(scope, b, type, off);
  }
  listen(scope, b, 'keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    set(true);
  });
  listen(scope, b, 'keyup', off);
  // keyup kann woanders landen (Tab, App-Wechsel, Gerät zugeklappt)
  listen(scope, b, 'blur', off);
  const doc = b.ownerDocument;
  const onHidden = (): void => {
    if (doc.visibilityState === 'hidden') off();
  };
  doc.addEventListener('visibilitychange', onHidden);
  scope.add(() => {
    doc.removeEventListener('visibilitychange', onHidden);
  });
  scope.add(off);
  return b;
}
