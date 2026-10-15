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

describe('saveFile im Claude-Artifact (downloads)', () => {
  function withDownloads(save: (r: { filename: string; data: unknown }) => Promise<unknown>) {
    const ctx = env({ share: vi.fn(), canShare: () => true, maxTouchPoints: 5 });
    return { ...ctx, e: { ...ctx.e, downloads: () => ({ save }) } };
  }
  it('JSON geht direkt über die Download-Freigabe, kein Teilen, kein Link', async () => {
    const save = vi.fn(() => Promise.resolve({ status: 'saved' }));
    const { e, clicks } = withDownloads(save);
    expect(await saveFile(e, blob, 'p.pocket808.json')).toBe('downloaded');
    expect(save).toHaveBeenCalledWith({ filename: 'p.pocket808.json', data: blob });
    expect(e.navigator.share).not.toHaveBeenCalled();
    expect(clicks).toEqual([]);
  });
  it('WAV ist dort nicht erlaubt: kommt als ZIP mit der unveränderten WAV darin', async () => {
    const save = vi.fn<(r: { filename: string; data: unknown }) => Promise<unknown>>(() =>
      Promise.resolve({ status: 'saved' }),
    );
    const { e } = withDownloads(save);
    const wav = new Blob([Uint8Array.from([82, 73, 70, 70])], { type: 'audio/wav' });
    expect(await saveFile(e, wav, 'beat.wav')).toBe('downloaded');
    const arg = save.mock.calls[0]?.[0];
    expect(arg?.filename).toBe('beat.zip');
    const z = new Uint8Array(arg?.data as ArrayBuffer);
    expect(new DataView(z.buffer).getUint32(0, true)).toBe(0x04034b50);
    expect(new TextDecoder().decode(z.subarray(30, 38))).toBe('beat.wav');
    expect([...z.subarray(38, 42)]).toEqual([82, 73, 70, 70]);
  });
  it('abgelehnt: cancelled; andere Fehler: failed', async () => {
    const declined = withDownloads(() =>
      Promise.reject(Object.assign(new Error('nein'), { code: 'declined' })),
    );
    expect(await saveFile(declined.e, blob, 'a.json')).toBe('cancelled');
    const broken = withDownloads(() =>
      Promise.reject(Object.assign(new Error('weg'), { code: 'unavailable' })),
    );
    expect(await saveFile(broken.e, blob, 'a.json')).toBe('failed');
  });
  it('ohne Freigabe (null) bleibt alles wie im Browser', async () => {
    const ctx = env({ canShare: () => false });
    expect(await saveFile({ ...ctx.e, downloads: () => null }, blob, 'a.json')).toBe('downloaded');
    expect(ctx.clicks).toHaveLength(1);
  });
});
