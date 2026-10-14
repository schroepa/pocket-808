import { describe, expect, it, vi } from 'vitest';
import { createWakeLock } from './wake.ts';

function setup(supported = true) {
  const sentinel = { release: vi.fn(() => Promise.resolve()) };
  const request = vi.fn(() => Promise.resolve(sentinel));
  const listeners = new Set<() => void>();
  const doc = {
    visibilityState: 'visible' as DocumentVisibilityState,
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
  };
  const lock = createWakeLock({
    navigator: supported ? { wakeLock: { request } } : {},
    document: doc as never,
  });
  const fire = () => {
    for (const f of listeners) f();
  };
  return { lock, request, sentinel, doc, fire, listeners };
}
const tick = () => new Promise((r) => setTimeout(r, 0));

describe('createWakeLock', () => {
  it('hält und gibt frei', async () => {
    const { lock, request, sentinel } = setup();
    lock.hold();
    await tick();
    expect(request).toHaveBeenCalledWith('screen');
    lock.release();
    expect(sentinel.release).toHaveBeenCalled();
  });
  it('fordert nach Rückkehr in den Vordergrund neu an, nur solange gehalten wird', async () => {
    const { lock, request, fire, doc } = setup();
    lock.hold();
    await tick();
    doc.visibilityState = 'hidden';
    fire();
    await tick();
    expect(request).toHaveBeenCalledTimes(1);
    doc.visibilityState = 'visible';
    fire();
    await tick();
    expect(request).toHaveBeenCalledTimes(2);
    lock.release();
    fire();
    await tick();
    expect(request).toHaveBeenCalledTimes(2);
  });
  it('kommt die Zusage erst nach dem Freigeben, wird sie sofort zurückgegeben', async () => {
    const { lock, sentinel } = setup();
    lock.hold();
    lock.release();
    await tick();
    expect(sentinel.release).toHaveBeenCalledTimes(1);
  });
  it('ohne Unterstützung und bei Fehlern still', async () => {
    const { lock } = setup(false);
    lock.hold();
    await tick();
    lock.release();
    const s = setup();
    s.request.mockRejectedValueOnce(new Error('verweigert'));
    s.lock.hold();
    await tick();
    s.lock.release();
    expect(s.sentinel.release).not.toHaveBeenCalled();
  });
  it('ein Fehler beim Freigeben bleibt still', async () => {
    const { lock, sentinel } = setup();
    sentinel.release.mockImplementationOnce(() => Promise.reject(new Error('schon frei')));
    lock.hold();
    await tick();
    lock.release();
    await tick();
    expect(sentinel.release).toHaveBeenCalledTimes(1);
  });
  it('dispose entfernt den Listener', () => {
    const { lock, listeners } = setup();
    lock.dispose();
    expect(listeners.size).toBe(0);
  });
});
