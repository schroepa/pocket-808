import { CHANNEL_NAMES, CHANNELS } from '../../core/constants.ts';
import type { UiContext } from '../context.ts';
import { bind, h, listen } from '../dom.ts';
import type { Nav, TrackId } from '../nav.ts';
import { shiftTrack, trackTap, trackTitle } from '../track.ts';
import { samplerPads } from './sampler/pads.ts';
import './track-select.css';

/* Spurwahl: schmale Leiste mit Pad-Feld (iPhone) bzw. eine Taste je Spur (Tablet, Desktop). */

/** Taste einer Spur: wählen und anhören, Markierung für Auswahl und eigenes Sample */
function trackButton(
  c: UiContext,
  nav: Nav,
  id: TrackId,
  className: string,
  children: readonly (Node | string)[],
): HTMLButtonElement {
  const b = h(
    'button',
    {
      class: className,
      attrs: { type: 'button', 'aria-label': `${CHANNEL_NAMES[id]} wählen und anhören` },
    },
    children,
  );
  trackTap(c, nav, b, id);
  bind(
    c.scope,
    () => nav.track.value === id,
    (on) => {
      b.classList.toggle('sel', on);
      b.setAttribute('aria-pressed', String(on));
    },
  );
  // eigene Samples gibt es nur für Drums
  bind(
    c.scope,
    () => [...c.samples.drums.value.keys()].some((v) => v === id),
    (on) => {
      b.classList.toggle('cust', on);
    },
  );
  return b;
}

/** vorige Spur, Titel (öffnet das Pad-Feld), nächste Spur; die Pfeile wählen ohne Ton */
export function trackBar(c: UiContext, nav: Nav): HTMLElement {
  const arrow = (text: string, label: string, d: -1 | 1): HTMLButtonElement =>
    h('button', {
      class: 'track-step',
      text,
      attrs: { type: 'button', 'aria-label': label },
      on: {
        click: () => {
          shiftTrack(nav, d);
        },
      },
    });
  const title = h('button', {
    class: 'track-title',
    attrs: { type: 'button', 'aria-label': 'Spur wählen', 'aria-haspopup': 'dialog' },
    on: {
      click: () => {
        nav.sheet.value = nav.sheet.peek() === 'tracks' ? null : 'tracks';
      },
    },
  });
  bind(
    c.scope,
    () => trackTitle(c.store.state.value, nav.track.value),
    (t) => {
      title.textContent = t;
    },
  );
  bind(
    c.scope,
    () => nav.sheet.value === 'tracks',
    (open) => {
      title.setAttribute('aria-expanded', String(open));
    },
  );
  return h('div', { class: 'track-bar' }, [
    arrow('‹', 'Vorige Spur', -1),
    title,
    arrow('›', 'Nächste Spur', 1),
  ]);
}

/** alle 13 Spuren als Tasten nebeneinander */
export function trackKeys(c: UiContext, nav: Nav): HTMLElement {
  return h(
    'div',
    { class: 'track-keys', attrs: { role: 'group', 'aria-label': 'Spuren' } },
    CHANNELS.map((id) => trackButton(c, nav, id, 'track-key', [id])),
  );
}

/**
 * Inhalt des Pad-Felds: zwölf Spur-Pads und die acht Sampler-Pads. Nach einem Tipp schließt das Feld;
 * bei scharfer Aufnahme bleibt es zum Einspielen offen.
 */
export function trackPadsContent(c: UiContext, nav: Nav): HTMLElement {
  const done = (): void => {
    if (!c.audio.recording.peek()) nav.sheet.value = null;
  };
  const tracks = CHANNELS.filter((id) => id !== 'SM').map((id) => {
    const b = trackButton(c, nav, id, 'track-pad', [id, h('small', { text: CHANNEL_NAMES[id] })]);
    listen(c.scope, b, 'click', done);
    return b;
  });
  // samplerPads wählt, hört vor und nimmt selbst auf: hier nur noch die Spur wechseln
  const sampler = samplerPads(c, () => {
    nav.selectTrack('SM');
    done();
  });
  return h('div', { class: 'track-pads' }, [
    h('div', { class: 'track-grid', attrs: { role: 'group', 'aria-label': 'Spuren' } }, tracks),
    h('div', { class: 'cap-label', text: 'Sampler' }),
    sampler,
  ]);
}
