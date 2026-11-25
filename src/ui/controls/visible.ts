import { releaseHolds } from './hold.ts';

/** blendet el aus bzw. ein und löst vorher gehaltene Tasten */
export function show(el: HTMLElement, visible: boolean): void {
  if (!visible) releaseHolds(el);
  el.hidden = !visible;
}
