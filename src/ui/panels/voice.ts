import { VOICE_IDS } from '../../core/constants.ts';
import { currentPattern, subStepsOf } from '../../core/pattern.ts';
import type { VoiceId } from '../../core/types.ts';
import { must } from '../../core/util.ts';
import type { ReadonlySignal } from '../../store/signals.ts';
import type { Store } from '../../store/store.ts';
import type { UiContext } from '../context.ts';

export const selectedVoice = (store: Store): ReadonlySignal<VoiceId> =>
  store.select((s) => must(VOICE_IDS[s.sel], 'Stimme'));

/** Step klingt: gesetzt oder mit Sub-Steps belegt (Legacy paintStep/paintCell) */
export const drumOn = (store: Store, voice: () => VoiceId, step: number): ReadonlySignal<boolean> =>
  store.select((s) => {
    const p = currentPattern(s);
    const id = voice();
    return p[id][step] === 1 || subStepsOf(p, id, step) !== null;
  });

export const drumSub = (
  store: Store,
  voice: () => VoiceId,
  step: number,
): ReadonlySignal<boolean> =>
  store.select((s) => subStepsOf(currentPattern(s), voice(), step) !== null);

/** Legacy toggle(): umschalten; nur wenn der Step dadurch an ist und nichts läuft, vorhören */
export function toggleWithAudition(c: UiContext, voice: VoiceId, step: number): void {
  c.store.toggleStep(voice, step);
  const p = currentPattern(c.store.state.peek());
  if (p[voice][step] === 1 && !c.audio.playing.peek()) c.audio.audition(voice);
}
