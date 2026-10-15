import { zipStore } from './zip.ts';

/** Download-Freigabe des Claude-Artifacts (claude.use("downloads")), nur das Nötige */
export interface ArtifactDownloads {
  save(r: { filename: string; data: Blob | ArrayBuffer }): Promise<unknown>;
}

/** Endungen, die die Download-Freigabe im Artifact annimmt (downloads.d.ts) */
const ARTIFACT_EXT = /\.(gif|png|jpe?g|webp|mp4|webm|txt|json|md|csv|svg|pdf|zip)$/i;

export type SaveOutcome = 'shared' | 'downloaded' | 'cancelled' | 'failed';

/** Was saveFile vom Browser braucht (in Tests ersetzbar). */
export interface ShareEnv {
  /** im Claude-Artifact die Download-Freigabe, sonst null (Getter: kein await vor dem Teilen) */
  downloads?: () => ArtifactDownloads | null;
  navigator: {
    canShare?: (data: ShareData) => boolean;
    share?: (data: ShareData) => Promise<void>;
    /** > 0 auf Touch-Geräten (iPhone, iPad); Safari auf dem Mac kann teilen, aber nicht sichern */
    maxTouchPoints?: number;
  };
  document: Pick<Document, 'createElement' | 'body'>;
  URL: { createObjectURL(b: Blob): string; revokeObjectURL(u: string): void };
  File: typeof File;
}

/**
 * Datei hinausgeben: auf dem iPhone über das Teilen-Menü („In Dateien sichern“, AirDrop), sonst als
 * Download. Teilen braucht eine frische Nutzergeste; ein Abbruch im Menü ist kein Fehler.
 */
export async function saveFile(env: ShareEnv, blob: Blob, name: string): Promise<SaveOutcome> {
  const dl = env.downloads?.();
  if (dl) return saveInArtifact(dl, blob, name);
  const file = new env.File([blob], name, { type: blob.type });
  const nav = env.navigator;
  const touch = (nav.maxTouchPoints ?? 0) > 0;
  if (touch && nav.share && nav.canShare?.({ files: [file] })) {
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

/** Im Artifact: über die Download-Freigabe; nicht erlaubte Endungen (z. B. .wav) als ZIP. */
async function saveInArtifact(
  dl: ArtifactDownloads,
  blob: Blob,
  name: string,
): Promise<SaveOutcome> {
  let filename = name;
  let data: Blob | ArrayBuffer = blob;
  if (!ARTIFACT_EXT.test(name)) {
    filename = `${name.replace(/\.[^.]*$/, '')}.zip`;
    data = zipStore(name, new Uint8Array(await blob.arrayBuffer()), new Date()).buffer;
  }
  try {
    await dl.save({ filename, data });
    return 'downloaded';
  } catch (e) {
    return (e as { code?: unknown } | null)?.code === 'declined' ? 'cancelled' : 'failed';
  }
}
