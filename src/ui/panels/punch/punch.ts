import { computed, signal, type Signal } from '../../../store/signals.ts';
import type { PunchKind } from '../../context.ts';
import type { UiContext } from '../../context.ts';
import { holdButton } from '../../controls/hold.ts';
import type { Device } from '../../devices.ts';
import { h } from '../../dom.ts';
import './punch.css';

/** Die acht Halte-Effekte in Raster-Reihenfolge (wie die Punch-in-Effekte der Pocket Operator) */
export const PUNCH_PADS: readonly { kind: PunchKind; label: string }[] = [
  { kind: 'loop8', label: 'Loop 1/8' },
  { kind: 'loop16', label: 'Loop 1/16' },
  { kind: 'half', label: 'Half' },
  { kind: 'tape', label: 'Tape' },
  { kind: 'lp', label: 'Tief' },
  { kind: 'hp', label: 'Hoch' },
  { kind: 'crush', label: 'Crush' },
  { kind: 'echo', label: 'Echo' },
];

/**
 * Die acht Haltetasten: Effekte wirken, solange die Taste gehalten wird; mehrere gleichzeitig möglich.
 * `held` führt mit, was gerade gehalten wird.
 */
export function punchGrid(
  c: UiContext,
  held: Signal<readonly PunchKind[]> = signal<readonly PunchKind[]>([]),
): HTMLElement {
  return h(
    'div',
    { class: 'punch-grid', attrs: { role: 'group', 'aria-label': 'Punch-Effekte' } },
    PUNCH_PADS.map((p) =>
      holdButton(c.scope, {
        class: 'punch-pad',
        text: p.label,
        ariaLabel: `${p.label} halten`,
        on: () => {
          held.value = [...held.peek(), p.kind];
          c.audio.punchOn(p.kind);
        },
        off: () => {
          held.value = held.peek().filter((k) => k !== p.kind);
          c.audio.punchOff(p.kind);
        },
      }),
    ),
  );
}

/** Gerät „Punch“ der langen Seite; die Zusammenfassung nennt die gehaltenen Effekte */
export function punchDevice(c: UiContext): Device {
  const held = signal<readonly PunchKind[]>([]);
  return {
    id: 'punch',
    name: 'Punch',
    summary: computed(() => {
      const on = held.value;
      return on.length
        ? PUNCH_PADS.filter((p) => on.includes(p.kind))
            .map((p) => p.label)
            .join(' · ')
        : '8 Effekte · halten';
    }),
    body: (scope) => punchGrid({ ...c, scope }, held),
  };
}
