import { trimLeadingSilence } from '../../core/samples.ts';
import type { VoiceId } from '../../core/types.ts';
import { computed, type ReadonlySignal } from '../../store/signals.ts';
import type { UiContext } from '../context.ts';
import { chip } from '../controls/chip.ts';
import { h } from '../dom.ts';

/** Eigenes Sample für die gewählte Drum-Spur laden oder zum Original zurück (Legacy buildDrumSmp). */
export function drumSampleRow(c: UiContext, voice: ReadonlySignal<VoiceId>): HTMLElement {
  const { scope, samples, audio, readout, files } = c;
  const has = computed(() => samples.drums.value.has(voice.value));
  const load = async (): Promise<void> => {
    const id = voice.peek();
    try {
      const file = await files.pickAudio();
      if (!file) return;
      const pcm = trimLeadingSilence(await audio.decode(file.data));
      samples.setDrum(id, { pcm, name: file.name });
      audio.audition(id);
      readout.flash(`${id} · SAMPLE GELADEN`);
    } catch {
      readout.flash('NICHT LESBAR');
    }
  };
  return h('div', { class: 'chips smp-row' }, [
    chip(scope, {
      label: computed(() => (has.value ? 'Sample ersetzen' : 'Eigenes Sample')),
      ariaLabel: 'Eigenes Sample für diese Spur laden',
      onClick: () => {
        void load();
      },
    }),
    chip(scope, {
      label: 'Original',
      ariaLabel: 'Zurück zum synthetischen Original-Klang',
      disabled: computed(() => !has.value),
      onClick: () => {
        const id = voice.peek();
        samples.setDrum(id, null);
        audio.audition(id);
        readout.flash(`${id} · ORIGINAL`);
      },
    }),
  ]);
}
