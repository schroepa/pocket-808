import type { Timer } from '../store/persist.ts';
import type { SampleBank } from '../store/samples.ts';
import type { ReadonlySignal } from '../store/signals.ts';
import type { Store } from '../store/store.ts';
import type { UiAudio, UiContext, UiFiles, UiRecorder } from './context.ts';
import { devices } from './devices.ts';
import { createScope, h } from './dom.ts';
import { installKeys, shortcutHelp } from './keys.ts';
import { watchLayout, type Layout } from './layout.ts';
import { brand } from './panels/brand.ts';
import { deck } from './panels/deck.ts';
import { fxDevice, mixerDevice } from './panels/mixer/device.ts';
import { samplerDevice } from './panels/sampler/device.ts';
import { patternsPanel } from './panels/patterns.ts';
import { slots } from './panels/slots.ts';
import { songPanel } from './panels/song.ts';
import { stepEditor } from './panels/step-editor.ts';
import { synthDevice } from './panels/synth/device.ts';
import { tracks } from './panels/tracks.ts';
import { transport } from './panels/transport.ts';
import { drivePlayhead } from './playhead.ts';
import { createReadout, voiceLine } from './readout.ts';
import './styles/app.css';

export interface ShellDeps {
  store: Store;
  samples: SampleBank;
  audio: UiAudio;
  files: UiFiles;
  recorder: UiRecorder;
  timer: Timer;
  win: Pick<Window, 'matchMedia' | 'requestAnimationFrame' | 'cancelAnimationFrame'>;
}

/**
 * Baut die Oberfläche als einen Baum. Die DOM-Reihenfolge ist zugleich Lesereihenfolge und
 * Mobile-Layout; Tablet und Desktop ordnen per CSS (styles/layout.css, data-layout).
 */
export function mountShell(
  root: HTMLElement,
  deps: ShellDeps,
): { layout: ReadonlySignal<Layout>; dispose(): void } {
  const scope = createScope();
  const layout = watchLayout(scope, deps.win, document.documentElement);
  const readout = createReadout(scope, voiceLine(deps.store, deps.audio.available), deps.timer);
  const c: UiContext = {
    store: deps.store,
    samples: deps.samples,
    audio: deps.audio,
    files: deps.files,
    recorder: deps.recorder,
    readout,
    scope,
  };
  root.replaceChildren(
    h('main', { class: 'shell' }, [
      brand(shortcutHelp(c)),
      deck(c),
      slots(c),
      // Spalte 1 auf dem Desktop (zwei Blöcke untereinander), sonst display: contents.
      // Die DOM-Reihenfolge ist zugleich Lese- und Mobile-Reihenfolge: Geräte vor Song.
      h('div', { class: 'col-main' }, [stepEditor(c), tracks(c)]),
      devices(c, layout, [synthDevice(c), samplerDevice(c), mixerDevice(c), fxDevice(c)]),
      h('div', { class: 'col-extra' }, [songPanel(c), patternsPanel(c)]),
      transport(c),
    ]),
  );
  installKeys(c, layout, document);
  drivePlayhead(scope, deps.audio, {
    request: (fn) => deps.win.requestAnimationFrame(fn),
    cancel: (id) => {
      deps.win.cancelAnimationFrame(id);
    },
  });
  return {
    layout,
    dispose() {
      scope.dispose();
      root.replaceChildren();
    },
  };
}
