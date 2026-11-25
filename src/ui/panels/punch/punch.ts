import type { PunchKind, UiContext } from '../../context.ts';
import { holdButton } from '../../controls/hold.ts';
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

/** Die acht Haltetasten: Effekte wirken, solange die Taste gehalten wird; mehrere gleichzeitig möglich. */
export function punchGrid(c: UiContext): HTMLElement {
  return h(
    'div',
    { class: 'punch-grid', attrs: { role: 'group', 'aria-label': 'Punch-Effekte' } },
    PUNCH_PADS.map((p) =>
      holdButton(c.scope, {
        class: 'punch-pad',
        text: p.label,
        ariaLabel: `${p.label} halten`,
        on: () => {
          c.audio.punchOn(p.kind);
        },
        off: () => {
          c.audio.punchOff(p.kind);
        },
      }),
    ),
  );
}
