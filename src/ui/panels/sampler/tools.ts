import { SMP_MAX } from '../../../core/constants.ts';
import { clearedPad, loadedPad, toggleReverse } from '../../../core/sampler.ts';
import { computed, signal } from '../../../store/signals.ts';
import type { UiContext } from '../../context.ts';
import { chip } from '../../controls/chip.ts';
import { h } from '../../dom.ts';
import { hearPad, padState } from './common.ts';
import type { Message } from './message.ts';

/** Laden, Aufnehmen, Rückwärts, Leeren (Legacy smpTools, decodeInto, recToggle, clearSample) */
export function samplerTools(c: UiContext, msg: Message): HTMLElement {
  const { store, scope, samples, audio, files, recorder } = c;
  const { sel, pad } = padState(c);
  const recording = signal<{ stop(): void } | null>(null);

  const decodeInto = async (i: number, data: ArrayBuffer, name: string): Promise<void> => {
    try {
      const pcm = await audio.decode(data);
      samples.setPad(i, pcm);
      store.update((s) => loadedPad(s, i, name));
      hearPad(c, i);
      msg.show(`Pad ${i + 1} geladen`);
    } catch {
      msg.show('Datei nicht lesbar');
    }
  };
  const pick = async (capture: boolean): Promise<void> => {
    const i = sel.peek();
    try {
      const file = await files.pickAudio(capture ? { capture: true } : undefined);
      if (file) await decodeInto(i, file.data, file.name);
    } catch {
      msg.show('Datei nicht lesbar');
    }
  };
  const record = async (): Promise<void> => {
    const running = recording.peek();
    if (running) {
      running.stop();
      return;
    }
    const i = sel.peek();
    const r = await recorder.start(SMP_MAX * 1000);
    if ('error' in r) {
      msg.show(
        `${r.error === 'denied' ? 'Mikro gesperrt' : 'Mikro hier nicht verfügbar'} · öffne Aufnahme-App`,
      );
      await pick(true);
      return;
    }
    recording.value = r;
    msg.show(`Aufnahme läuft · max. ${SMP_MAX} s`, true);
    const buf = await r.done;
    recording.value = null;
    if (buf) await decodeInto(i, buf, 'Aufnahme');
    else msg.show('Nichts aufgenommen');
  };
  return h('div', { class: 'chips smp-tools' }, [
    chip(scope, {
      label: 'Laden',
      onClick: () => {
        void pick(false);
      },
    }),
    chip(scope, {
      label: computed(() => (recording.value ? 'Stopp' : 'Rec')),
      ariaLabel: 'Mit dem Mikrofon aufnehmen',
      active: computed(() => recording.value !== null),
      onClick: () => {
        void record();
      },
    }),
    chip(scope, {
      label: 'Rev',
      ariaLabel: 'Rückwärts abspielen',
      active: computed(() => pad.value.rev),
      onClick: () => {
        const i = sel.peek();
        store.update((s) => toggleReverse(s, i));
        hearPad(c, i);
      },
    }),
    chip(scope, {
      label: 'Leeren',
      onClick: () => {
        const i = sel.peek();
        samples.setPad(i, null);
        store.update((s) => clearedPad(s, i));
      },
    }),
  ]);
}
