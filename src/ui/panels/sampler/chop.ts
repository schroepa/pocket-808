import { CHOP_SIZES, setChop, type ChopSize } from '../../../core/chop.ts';
import { currentPattern } from '../../../core/pattern.ts';
import { stepIsOn } from '../../../core/stepopts.ts';
import type { SubKey } from '../../../core/types.ts';
import { must } from '../../../core/util.ts';
import { computed } from '../../../store/signals.ts';
import type { UiContext } from '../../context.ts';
import { chip } from '../../controls/chip.ts';
import { segment } from '../../controls/segment.ts';
import { h } from '../../dom.ts';
import { padState } from './common.ts';
import type { Message } from './message.ts';

/** Chop: Pad in 2, 4 oder 8 Slices teilen und die Slices auf die gesetzten Steps verteilen */
export function samplerChop(c: UiContext, msg: Message): HTMLElement {
  const { store, scope } = c;
  const { sel, pad } = padState(c);
  return h('div', { class: 'smp-chop' }, [
    segment(scope, {
      label: 'Chop',
      options: [
        { value: 'off', label: 'Aus' },
        ...CHOP_SIZES.map((n) => ({ value: String(n), label: String(n) })),
      ],
      value: computed(() => (pad.value.sl ? String(pad.value.sl) : 'off')),
      write: (v) => {
        const i = sel.peek();
        store.update((s) => setChop(s, i, v === 'off' ? undefined : (Number(v) as ChopSize)));
      },
    }),
    chip(scope, {
      label: 'Verteilen',
      ariaLabel: 'Slices auf die Steps verteilen',
      onClick: () => {
        const i = sel.peek();
        if (!must(store.state.peek().smp.pads[i], 'Pad').sl) {
          msg.show('Erst Chop wählen');
          return;
        }
        const pat = currentPattern(store.state.peek());
        if (![...Array(16).keys()].some((st) => stepIsOn(pat, `P${String(i)}` as SubKey, st))) {
          msg.show('Erst Steps setzen');
          return;
        }
        store.distributeSlices(i);
        msg.show(`Pad ${String(i + 1)}: Slices verteilt`);
      },
    }),
  ]);
}
