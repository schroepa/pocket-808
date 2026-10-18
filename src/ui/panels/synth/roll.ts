import { ROWS, SCALES } from '../../../core/constants.ts';
import { degreeName } from '../../../core/music.ts';
import { CHORD_LABELS, CHORD_MARKS } from '../../../core/notes.ts';
import { currentPattern } from '../../../core/pattern.ts';
import { noteAt } from '../../../core/synth.ts';
import type { ChordKind } from '../../../core/types.ts';
import { must } from '../../../core/util.ts';
import { computed, signal } from '../../../store/signals.ts';
import type { UiContext } from '../../context.ts';
import { chip } from '../../controls/chip.ts';
import { markColumn } from '../../controls/marker.ts';
import { bind, h } from '../../dom.ts';
import './roll.css';

const LENGTHS = [
  [1, '1/16'],
  [2, '1/8'],
  [4, '1/4'],
] as const;

/** Werkzeug für Tipps in der Roll (Etappe 6a); bleibt nur in der Oberfläche */
type Tool = 'note' | 'a' | 's' | 'ch';
const TOOLS: readonly (readonly [Tool, string])[] = [
  ['note', 'Note'],
  ['a', 'Akzent'],
  ['s', 'Slide'],
  ['ch', 'Akkord'],
];

/** Piano-Roll des gewählten Parts: eine Takthälfte (8 Steps) × 12 Stufen (Legacy renderRoll). */
export function pianoRoll(c: UiContext): HTMLElement {
  const { store, scope, audio, readout } = c;
  const page = signal(0);
  const tool = signal<Tool>('note');
  const playStep = computed(() => audio.playhead.value.step);
  const tonality = store.select(
    (s) => ({ key: s.key, scale: s.scale }),
    (a, b) => a.key === b.key && a.scale === b.scale,
  );
  const scaleLen = computed(() => must(SCALES[tonality.value.scale], 'Skala').s.length);

  const pages = ['1–8', '9–16'].map((t, i) => {
    const b = chip(scope, {
      label: t,
      ariaLabel: `Steps ${t}`,
      active: computed(() => page.value === i),
      onClick: () => {
        page.value = i;
      },
    });
    bind(
      scope,
      () => playStep.value >= 0 && playStep.value >> 3 === i,
      (on) => {
        b.classList.toggle('now', on);
      },
    );
    return b;
  });
  const lengths = LENGTHS.map(([n, t]) =>
    chip(scope, {
      label: t,
      ariaLabel: `Notenlänge ${t}`,
      active: store.select((s) => s.noteLen === n),
      onClick: () => {
        store.update((s) => ({ ...s, noteLen: n }));
      },
    }),
  );

  const tools = TOOLS.map(([t, label]) =>
    chip(scope, {
      label,
      ariaLabel: `Werkzeug ${label}`,
      active: computed(() => tool.value === t),
      onClick: () => {
        tool.value = t;
      },
    }),
  );

  const headCells = Array.from({ length: 8 }, (_, col) => {
    const sp = h('span');
    bind(
      scope,
      () => page.value * 8 + col + 1,
      (n) => {
        sp.textContent = String(n);
      },
    );
    return sp;
  });
  const columns: HTMLButtonElement[][] = Array.from({ length: 8 }, () => []);
  const rows = Array.from({ length: ROWS }, (_, i) => {
    const d = ROWS - 1 - i;
    const name = computed(() => degreeName(d, tonality.value));
    const lab = h('button', {
      class: 'rl',
      attrs: { type: 'button' },
      on: {
        click: () => {
          audio.auditionNote(store.state.peek().part, d, 1);
        },
      },
    });
    bind(
      scope,
      () => name.value,
      (n) => {
        lab.textContent = n;
        lab.setAttribute('aria-label', `Ton ${n} anhören`);
      },
    );
    const cells = Array.from({ length: 8 }, (_, col) => {
      const step = computed(() => page.value * 8 + col);
      // Text-Schlüssel: Zustand der Zelle und Attribute der Startnote ("on|a|s|3")
      const hit = store.select((s) => {
        const row = currentPattern(s).notes[s.part];
        const k = noteAt(row, step.value);
        if (k?.d !== d) return '';
        if (k.start !== step.value) return 'tail';
        const n = row[k.start];
        return `on|${n?.a ? 'a' : ''}|${n?.s ? 's' : ''}|${n?.ch ?? ''}`;
      });
      const b = h('button', {
        class: col % 4 === 0 ? 'pc q' : 'pc',
        attrs: { type: 'button' },
        on: {
          click: () => {
            const s = step.peek();
            const t = tool.peek();
            if (t !== 'note') {
              if (!hit.peek()) return;
              if (t === 'ch') store.cycleChord(s);
              else store.toggleNoteFlag(t, s);
              const now = store.state.peek();
              const row = currentPattern(now).notes[now.part];
              const k = noteAt(row, s);
              const n = k ? row[k.start] : null;
              if (t === 'ch') readout.flash(n?.ch ? CHORD_LABELS[n.ch] : 'Kein Akkord');
              // Akzent und Akkord im Stand mit Attributen vorhören; Slide braucht eine Vorgängerin
              if (n && t !== 's' && !audio.playing.peek()) audio.auditionNote(now.part, d, n.l, n);
              return;
            }
            store.placeNote(d, s);
            const now = store.state.peek();
            const set = currentPattern(now).notes[now.part][s]?.d === d;
            if (set && !audio.playing.peek()) audio.auditionNote(now.part, d, now.noteLen);
          },
        },
      });
      bind(
        scope,
        () => hit.value,
        (v) => {
          const [state = '', a, sl, ch] = v.split('|');
          b.classList.toggle('on', state === 'on');
          b.classList.toggle('tail', state === 'tail');
          b.classList.toggle('acc', a === 'a');
          b.classList.toggle('sl', sl === 's');
          b.textContent = ch ? CHORD_MARKS[ch as ChordKind] : '';
          b.setAttribute('aria-pressed', String(state === 'on'));
        },
      );
      bind(
        scope,
        () => {
          const ch = hit.value.split('|')[3];
          const extra = ch ? ` · ${CHORD_LABELS[ch as ChordKind]}` : '';
          return `${name.value} Step ${step.value + 1}${extra}`;
        },
        (l) => {
          b.setAttribute('aria-label', l);
        },
      );
      must(columns[col], 'Spalte').push(b);
      return b;
    });
    const row = h('div', { class: 'rr' }, [lab, ...cells]);
    bind(
      scope,
      () => d % scaleLen.value === 0,
      (root) => {
        row.classList.toggle('root', root);
      },
    );
    return row;
  });
  markColumn(
    scope,
    computed(() => {
      const s = playStep.value;
      return s >= 0 && s >> 3 === page.value ? s & 7 : -1;
    }),
    (col) => must(columns[col], 'Spalte'),
  );
  return h('div', { class: 'roll-wrap' }, [
    h('div', { class: 'roll-head' }, [
      h('div', { class: 'chips', attrs: { role: 'group', 'aria-label': 'Takthälfte' } }, pages),
      h('div', { class: 'chips', attrs: { role: 'group', 'aria-label': 'Notenlänge' } }, lengths),
      h('div', { class: 'chips tools', attrs: { role: 'group', 'aria-label': 'Werkzeug' } }, tools),
    ]),
    h('div', { class: 'roll' }, [
      h('div', { class: 'rr hd', attrs: { 'aria-hidden': 'true' } }, [h('span'), ...headCells]),
      ...rows,
    ]),
  ]);
}
