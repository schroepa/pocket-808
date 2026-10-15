import { describe, expect, it, vi } from 'vitest';
import { saveFile, type ShareEnv } from './share.ts';

function env(nav: ShareEnv['navigator'] = {}) {
  const clicks: { href: string; download: string }[] = [];
  const revoke = vi.fn();
  const e: ShareEnv = {
    navigator: nav,
    document: {
      body: document.body,
      createElement: (tag: string) => {
        const el = document.createElement(tag);
        if (el instanceof HTMLAnchorElement) {
          el.click = () => {
            clicks.push({ href: el.href, download: el.download });
          };
        }
        return el;
      },
    },
    URL: { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: revoke },
    File,
  };
  return { e, clicks, revoke };
}
const blob = new Blob(['x'], { type: 'application/json' });

describe('saveFile', () => {
  it('teilt die Datei, wenn der Browser Dateien teilen kann (iPhone)', async () => {
    const share = vi.fn(() => Promise.resolve());
    const canShare = vi.fn(() => true);
    const { e, clicks } = env({ share, canShare, maxTouchPoints: 5 });
    expect(await saveFile(e, blob, 'a.json')).toBe('shared');
    const arg = (share.mock.calls[0] as unknown as [ShareData])[0];
    expect(arg.files?.[0]?.name).toBe('a.json');
    expect(arg.files?.[0]?.type).toBe('application/json');
    expect(clicks).toEqual([]);
  });

  it('Abbruch im Teilen-Menü ist kein Fehler und lädt nichts herunter', async () => {
    const share = vi.fn(() => Promise.reject(new DOMException('weg', 'AbortError')));
    const { e, clicks } = env({ share, canShare: () => true, maxTouchPoints: 5 });
    expect(await saveFile(e, blob, 'a.json')).toBe('cancelled');
    expect(clicks).toEqual([]);
  });

  it('anderer Fehler beim Teilen: Download als Rückfall', async () => {
    const share = vi.fn(() => Promise.reject(new DOMException('nein', 'NotAllowedError')));
    const { e, clicks } = env({ share, canShare: () => true, maxTouchPoints: 5 });
    expect(await saveFile(e, blob, 'a.json')).toBe('downloaded');
    expect(clicks).toEqual([{ href: 'blob:x', download: 'a.json' }]);
  });

  it('ohne Teilen von Dateien: Download, URL wird danach freigegeben', async () => {
    vi.useFakeTimers();
    const { e, clicks, revoke } = env({ canShare: () => false, share: vi.fn() });
    expect(await saveFile(e, blob, 'b.wav')).toBe('downloaded');
    expect(clicks).toEqual([{ href: 'blob:x', download: 'b.wav' }]);
    expect(document.querySelector('a[download]')).toBeNull();
    expect(revoke).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(revoke).toHaveBeenCalledWith('blob:x');
    vi.useRealTimers();
    const old = env({});
    expect(await saveFile(old.e, blob, 'c.wav')).toBe('downloaded');
  });

  it('Desktop (Safari auf dem Mac kann teilen, hat aber kein „Sichern“): Download', async () => {
    const share = vi.fn(() => Promise.resolve());
    const { e, clicks } = env({ share, canShare: () => true, maxTouchPoints: 0 });
    expect(await saveFile(e, blob, 'a.json')).toBe('downloaded');
    expect(share).not.toHaveBeenCalled();
    expect(clicks).toHaveLength(1);
  });
});
