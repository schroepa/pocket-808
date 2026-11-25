import { must } from '../../../core/util.ts';
import { computed, type ReadonlySignal } from '../../../store/signals.ts';
import type { UiContext } from '../../context.ts';
import type { recordTap } from '../../record.ts';
import type { Pad } from '../../../core/types.ts';

/** Gewähltes Pad, seine Werte und sein Sample (null: leer) */
export function padState(c: UiContext): {
  sel: ReadonlySignal<number>;
  pad: ReadonlySignal<Pad>;
  pcm: ReadonlySignal<Float32Array | null>;
} {
  const sel = c.store.select((s) => s.smp.sel);
  return {
    sel,
    pad: c.store.select((s) => must(s.smp.pads[s.smp.sel], 'Pad')),
    pcm: computed(() => c.samples.pads.value[sel.value] ?? null),
  };
}

/** Pad vorhören, wenn es ein Sample hat (Legacy smpAudition) */
export function hearPad(c: UiContext, i: number): void {
  if (c.samples.pads.peek()[i]) c.audio.auditionPad(i);
}

/** Der Schlag, den ein Tipp auf Pad i aufnimmt; null, wenn es leer ist */
export function padHit(c: UiContext, i: number): ReturnType<Parameters<typeof recordTap>[2]> {
  if (!c.samples.pads.peek()[i]) return null;
  return {
    make: (pos) => ({ kind: 'pad', pad: i, semis: 0, ...pos }),
    label: `Pad ${String(i + 1)}`,
  };
}
