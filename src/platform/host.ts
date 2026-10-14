/** Artifact-Host (window.claude.hot): Zustand beim Neuladen übergeben und zurückbekommen. */
export interface HostHot {
  snapshot?: (fn: () => unknown) => void;
  ready?: (fn: (data: unknown) => void) => void;
  data?: unknown;
}

export function connectHost(
  win: { claude?: { hot?: HostHot } },
  snapshot: () => unknown,
  init: (data: unknown) => void,
): void {
  const hot = win.claude?.hot;
  if (typeof hot?.snapshot === 'function') hot.snapshot(snapshot);
  if (typeof hot?.ready === 'function') hot.ready(init);
  else init(hot?.data);
}

/** Zustand aus den Host-Daten ({ state }) */
export const hostState = (data: unknown): unknown =>
  typeof data === 'object' && data !== null ? (data as { state?: unknown }).state : undefined;
