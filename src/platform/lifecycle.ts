/** Im Hintergrund stoppen (Legacy); jedes Tippen weckt einen unterbrochenen Kontext (iOS). */
export function watchLifecycle(
  doc: Pick<Document, 'hidden' | 'addEventListener' | 'removeEventListener'>,
  on: { hidden(): void; pointer(): void },
): () => void {
  const vis = (): void => {
    if (doc.hidden) on.hidden();
  };
  const ptr = (): void => {
    on.pointer();
  };
  doc.addEventListener('visibilitychange', vis);
  doc.addEventListener('pointerdown', ptr, { passive: true });
  return () => {
    doc.removeEventListener('visibilitychange', vis);
    doc.removeEventListener('pointerdown', ptr);
  };
}
