/** Dateiname ohne Endung, höchstens 12 Zeichen (Legacy) */
export const fileBaseName = (name: string): string => name.replace(/\.[^.]*$/, '').slice(0, 12);

/** Audiodatei wählen oder aufnehmen (capture). Abbrechen liefert null. */
export function pickAudioFile(
  doc: Pick<Document, 'createElement' | 'body'>,
  opts: { capture?: boolean } = {},
): Promise<{ data: ArrayBuffer; name: string } | null> {
  const input = doc.createElement('input');
  input.type = 'file';
  input.accept = 'audio/*';
  if (opts.capture) input.setAttribute('capture', '');
  // verborgen im Dokument: WebKit verliert sonst bei losgelösten Feldern change/cancel
  input.hidden = true;
  doc.body.append(input);
  return new Promise((resolve, reject) => {
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
      f.arrayBuffer().then((data) => {
        resolve({ data, name: fileBaseName(f.name) });
      }, reject);
    });
    input.click();
  });
}
