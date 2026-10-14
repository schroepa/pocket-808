import type { UiAudio } from './context.ts';
import { bind, type Scope } from './dom.ts';

/** requestAnimationFrame-Takt: holt die Abspielposition (engine.tick), solange gespielt wird. */
export function drivePlayhead(
  scope: Scope,
  audio: Pick<UiAudio, 'playing' | 'tick'>,
  raf: { request(fn: () => void): number; cancel(id: number): void },
): void {
  let id: number | null = null;
  const frame = (): void => {
    audio.tick();
    id = raf.request(frame);
  };
  const stop = (): void => {
    if (id !== null) raf.cancel(id);
    id = null;
  };
  bind(
    scope,
    () => audio.playing.value,
    (on) => {
      if (on) id = raf.request(frame);
      else stop();
    },
  );
  scope.add(stop);
}
