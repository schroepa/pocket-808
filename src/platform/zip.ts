/*
 * Minimaler ZIP-Schreiber für genau eine Datei, ohne Kompression („stored“). Gebraucht im
 * Claude-Artifact, dessen Download-Freigabe .wav nicht erlaubt, .zip aber schon.
 */

const TABLE = Uint32Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

export function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  // Index liegt immer in 0..255
  for (const b of data) c = Number(TABLE[(c ^ b) & 0xff]) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** ZIP-Archiv mit einer unkomprimierten Datei (Name UTF-8, Zeitstempel als DOS-Zeit). */
export function zipStore(name: string, data: Uint8Array, at: Date): Uint8Array<ArrayBuffer> {
  const file = new TextEncoder().encode(name);
  const crc = crc32(data);
  const time = (at.getHours() << 11) | (at.getMinutes() << 5) | (at.getSeconds() >> 1);
  const date = ((at.getFullYear() - 1980) << 9) | ((at.getMonth() + 1) << 5) | at.getDate();
  const local = 30 + file.length;
  const central = 46 + file.length;
  const out = new Uint8Array(local + data.length + central + 22);
  const v = new DataView(out.buffer);
  const common = (at0: number): void => {
    v.setUint16(at0, 20, true); // benötigte Version
    v.setUint16(at0 + 2, 0x0800, true); // Name in UTF-8
    v.setUint16(at0 + 4, 0, true); // gespeichert
    v.setUint16(at0 + 6, time, true);
    v.setUint16(at0 + 8, date, true);
    v.setUint32(at0 + 10, crc, true);
    v.setUint32(at0 + 14, data.length, true);
    v.setUint32(at0 + 18, data.length, true);
    v.setUint16(at0 + 22, file.length, true);
  };
  v.setUint32(0, 0x04034b50, true);
  common(4);
  out.set(file, 30);
  out.set(data, local);
  const cd = local + data.length;
  v.setUint32(cd, 0x02014b50, true);
  v.setUint16(cd + 4, 20, true); // erstellt mit
  common(cd + 6);
  out.set(file, cd + 46);
  const end = cd + central;
  v.setUint32(end, 0x06054b50, true);
  v.setUint16(end + 8, 1, true);
  v.setUint16(end + 10, 1, true);
  v.setUint32(end + 12, central, true);
  v.setUint32(end + 16, cd, true);
  return out;
}
