import { SMP_MAX } from '../../../core/constants.ts';
import { clearedPad, loadedPad, toggleReverse } from '../../../core/sampler.ts';
import { computed, signal } from '../../../store/signals.ts';
import type { UiContext } from '../../context.ts';
import { chip } from '../../controls/chip.ts';
import { must } from '../../../core/util.ts';
import { bind, h } from '../../dom.ts';
import { hearPad, padState } from './common.ts';
import type { Message } from './message.ts';

/** Laden, Aufnehmen, Rückwärts, Leeren (Legacy smpTools, decodeInto, recToggle, clearSample) */
export function samplerTools(c: UiContext, msg: Message): HTMLElement {
  const { store, scope, samples, audio, files, recorder } = c;
  const { sel, pad } = padState(c);
  // 'pending': Mikrofon-Abfrage läuft; weitere Tipps werden bis dahin ignoriert
  const recording = signal<{ stop(): void } | 'pending' | null>(null);

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
    if (running === 'pending') return;
    if (running) {
      running.stop();
      return;
    }
    const i = sel.peek();
    recording.value = 'pending';
    const r = await recorder.start(SMP_MAX * 1000);
    if ('error' in r) {
      recording.value = null;
      msg.show(
        `${r.error === 'denied' ? 'Mikro gesperrt' : 'Mikro hier nicht verfügbar'} · öffne Aufnahme-App`,
      );
      await pick(true);
      return;
    }
    recording.value = r;
    msg.show(`Aufnahme läuft · max. ${SMP_MAX} s`, true);
    const buf = await r.done.catch(() => null);
    recording.value = null;
    if (buf) await decodeInto(i, buf, 'Aufnahme');
    else msg.show('Nichts aufgenommen');
  };
  // Bounce: Pattern auf das Pad rendern (EP-133/OP-1); ein volles Pad wird erst nach Rückfrage ersetzt
  const bouncing = signal(false);
  const asking = signal(false);
  const bounce = async (): Promise<void> => {
    const i = sel.peek();
    bouncing.value = true;
    msg.show('Bounce läuft …', true);
    // immer das aktuelle Pattern, auch wenn gerade der Song gewählt ist
    const r = await audio.bounce({ ...store.state.peek(), mode: 'pattern' }).catch(() => null);
    bouncing.value = false;
    if (!r) {
      msg.show('Bounce fehlgeschlagen');
      return;
    }
    samples.setPad(i, r.pcm);
    store.update((s) => loadedPad(s, i, 'Bounce'));
    hearPad(c, i);
    msg.show(`Pad ${String(i + 1)}: Bounce${r.cut ? ' (auf 3 s gekürzt)' : ''}`);
  };
  const ask = h('div', { class: 'bounce-ask' }, [
    h('span'),
    chip(scope, {
      label: 'Ersetzen',
      onClick: () => {
        asking.value = false;
        void bounce();
      },
    }),
    chip(scope, {
      label: 'Abbrechen',
      onClick: () => {
        asking.value = false;
      },
    }),
  ]);
  bind(
    scope,
    () => (asking.value ? `Pad ${String(sel.value + 1)} ersetzen?` : ''),
    (t) => {
      ask.hidden = t === '';
      must(ask.firstElementChild ?? undefined, 'Frage').textContent = t;
    },
  );
  return h('div', { class: 'chips smp-tools' }, [
    chip(scope, {
      label: 'Laden',
      onClick: () => {
        void pick(false);
      },
    }),
    chip(scope, {
      label: computed(() => (recording.value && recording.value !== 'pending' ? 'Stopp' : 'Rec')),
      ariaLabel: 'Mit dem Mikrofon aufnehmen',
      active: computed(() => recording.value !== null && recording.value !== 'pending'),
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
    chip(scope, {
      label: 'Bounce',
      ariaLabel: 'Pattern auf dieses Pad bouncen',
      onClick: () => {
        if (bouncing.peek()) return;
        if (samples.pads.peek()[sel.peek()]) asking.value = true;
        else void bounce();
      },
    }),
    ask,
  ]);
}
