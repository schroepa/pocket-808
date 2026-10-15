/** Dateiname ohne Endung, höchstens 12 Zeichen (Legacy) */
export const fileBaseName = (name: string): string => name.replace(/\.[^.]*$/, '').slice(0, 12);

type Doc = Pick<Document, 'createElement' | 'body'>;

/** Datei über ein verborgenes Feld wählen; Abbrechen oder leere Auswahl liefert null. */
function pick<T>(doc: Doc, accept: string, capture: boolean, read: (f: File) => Promise<T>) {
  const input = doc.createElement('input');
  input.type = 'file';
  input.accept = accept;
  if (capture) input.setAttribute('capture', '');
  // verborgen im Dokument: WebKit verliert sonst bei losgelösten Feldern change/cancel
  input.hidden = true;
  doc.body.append(input);
  return new Promise<T | null>((resolve, reject) => {
    input.addEventListener('cancel', () => {
      input.remove();
      resolve(null);
    });
    input.addEventListener('change', () => {
      input.remove();
      const f = input.files?.[0];
      if (!f) {
        resolve(null);
        return;
      }
      read(f).then(resolve, reject);
    });
    input.click();
  });
}

/** Audiodatei wählen oder aufnehmen (capture). Abbrechen liefert null. */
export function pickAudioFile(
  doc: Doc,
  opts: { capture?: boolean } = {},
): Promise<{ data: ArrayBuffer; name: string } | null> {
  return pick(doc, 'audio/*', opts.capture === true, async (f) => ({
    data: await f.arrayBuffer(),
    name: fileBaseName(f.name),
  }));
}

/** Textdatei wählen (Projektdatei); liefert Inhalt und vollen Namen. */
export function pickTextFile(
  doc: Doc,
  accept: string,
): Promise<{ text: string; name: string } | null> {
  return pick(doc, accept, false, async (f) => ({ text: await f.text(), name: f.name }));
}
