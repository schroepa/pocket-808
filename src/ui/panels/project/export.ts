import {
  EXPORT_MAX,
  exportFileName,
  exportPlan,
  formatDuration,
  type ExportScope,
} from '../../../core/export.ts';
import { must } from '../../../core/util.ts';
import { computed, signal } from '../../../store/signals.ts';
import type { UiContext } from '../../context.ts';
import { chip } from '../../controls/chip.ts';
import { segment } from '../../controls/segment.ts';
import { bind, h } from '../../dom.ts';

type Repeats = '1' | '2' | '4' | '8';
type Job =
  | { kind: 'idle' }
  | { kind: 'busy'; ctrl: AbortController }
  | { kind: 'done'; blob: Blob; name: string };

/** WAV-Export: Pattern 1/2/4/8× oder Song; Rendern mit Fortschritt und Abbrechen, dann „WAV sichern“. */
export function exportSection(
  c: UiContext,
  say: (text: string, flash?: boolean) => void,
): HTMLElement {
  const { store, scope } = c;
  const range = signal<ExportScope>('pattern');
  const reps = signal<Repeats>('1');
  const plan = computed(() => exportPlan(store.state.value, range.value, Number(reps.value)));
  const job = signal<Job>({ kind: 'idle' });
  const idle: Job = { kind: 'idle' };

  // Ein fertiges Ergebnis verfällt, sobald Umfang oder Wiederholungen sich ändern (Spezifikation);
  // andere Bedienung, etwa der Slot-Wechsel der laufenden Song-Wiedergabe, lässt es stehen
  bind(
    scope,
    () => `${range.value}|${reps.value}`,
    () => {
      if (job.peek().kind === 'done') job.value = idle;
    },
  );
  scope.add(() => {
    const j = job.peek();
    if (j.kind === 'busy') j.ctrl.abort();
  });

  const generate = (): void => {
    const p = must(plan.peek() ?? undefined, 'Export-Plan');
    const s = store.state.peek();
    const sc = range.peek();
    const r = Number(reps.peek());
    const ctrl = new AbortController();
    job.value = { kind: 'busy', ctrl };
    say('Rendere … 0 %', false);
    c.audio
      .exportWav(
        { ...s, mode: sc === 'song' ? 'song' : 'pattern' },
        p.playFor,
        p.seconds,
        (f) => {
          if (!ctrl.signal.aborted) say(`Rendere … ${String(Math.round(f * 100))} %`, false);
        },
        ctrl.signal,
      )
      .then(
        (blob) => {
          if (!blob || ctrl.signal.aborted) {
            job.value = idle;
            say('Export abgebrochen');
            return;
          }
          job.value = { kind: 'done', blob, name: exportFileName(s, sc, r, new Date()) };
          say(`Export fertig · ${formatDuration(p.seconds)}`);
        },
        () => {
          job.value = idle;
          say('Export fehlgeschlagen');
        },
      );
  };

  const rangeSeg = segment(scope, {
    label: 'Umfang',
    options: [
      { value: 'pattern', label: 'Pattern' },
      { value: 'song', label: 'Song' },
    ],
    value: range,
    write: (v) => {
      range.value = v;
    },
  });
  const songRadio = must(rangeSeg.querySelectorAll('button')[1], 'Song-Knopf');
  bind(
    scope,
    () => store.state.value.song.length === 0,
    (empty) => {
      songRadio.disabled = empty;
    },
  );
  const repsSeg = h('div', { class: 'export-reps' }, [
    segment(scope, {
      label: 'Wiederholungen',
      options: (['1', '2', '4', '8'] as const).map((v) => ({ value: v, label: `${v}×` })),
      value: reps,
      write: (v) => {
        reps.value = v;
      },
    }),
  ]);
  bind(
    scope,
    () => range.value === 'song',
    (song) => {
      repsSeg.hidden = song;
    },
  );
  const len = h('p', { class: 'export-len' });
  bind(
    scope,
    () => plan.value,
    (p) => {
      len.textContent = !p
        ? 'Song ist leer'
        : p.seconds > EXPORT_MAX
          ? 'Zu lang für den Export (max. 5 min)'
          : `Länge ${formatDuration(p.seconds)}`;
    },
  );

  const busy = computed(() => job.value.kind === 'busy');
  const make = chip(scope, {
    label: 'WAV erzeugen',
    onClick: generate,
    disabled: computed(() => {
      const p = plan.value;
      return !c.audio.available || !p || p.seconds > EXPORT_MAX || busy.value;
    }),
  });
  const cancel = chip(scope, {
    label: 'Abbrechen',
    ariaLabel: 'Export abbrechen',
    onClick: () => {
      const j = job.peek();
      if (j.kind === 'busy') j.ctrl.abort();
    },
  });
  const store_ = chip(scope, {
    label: 'WAV sichern',
    onClick: () => {
      const j = job.peek();
      if (j.kind !== 'done') return;
      void c.files.save(j.blob, j.name).then((r) => {
        if (r === 'failed') say('Sichern nicht möglich');
        else if (r !== 'cancelled') say('WAV gesichert');
      });
    },
  });
  bind(
    scope,
    () => job.value.kind,
    (k) => {
      cancel.hidden = k !== 'busy';
      store_.hidden = k !== 'done';
    },
  );

  return h('section', { class: 'file-sec', attrs: { 'aria-label': 'Audio exportieren' } }, [
    h('h3', { class: 'cap-label', text: 'Audio exportieren' }),
    h('div', { class: 'export-row' }, [rangeSeg, repsSeg]),
    len,
    h('div', { class: 'chips' }, [make, cancel, store_]),
  ]);
}
