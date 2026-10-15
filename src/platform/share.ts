/** Was saveFile vom Browser braucht (in Tests ersetzbar). */
export interface ShareEnv {
  navigator: {
    canShare?: (data: ShareData) => boolean;
    share?: (data: ShareData) => Promise<void>;
  };
  document: Pick<Document, 'createElement' | 'body'>;
  URL: { createObjectURL(b: Blob): string; revokeObjectURL(u: string): void };
  File: typeof File;
}

/**
 * Datei hinausgeben: auf dem iPhone über das Teilen-Menü („In Dateien sichern“, AirDrop), sonst als
 * Download. Teilen braucht eine frische Nutzergeste; ein Abbruch im Menü ist kein Fehler.
 */
export async function saveFile(
  env: ShareEnv,
  blob: Blob,
  name: string,
): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const file = new env.File([blob], name, { type: blob.type });
  const nav = env.navigator;
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file] });
      return 'shared';
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
    }
  }
  const url = env.URL.createObjectURL(blob);
  const a = env.document.createElement('a');
  a.href = url;
  a.download = name;
  a.hidden = true;
  env.document.body.append(a);
  a.click();
  a.remove();
  // erst nach dem Klick freigeben, sonst bricht der Download in manchen Browsern ab
  setTimeout(() => {
    env.URL.revokeObjectURL(url);
  }, 0);
  return 'downloaded';
}
