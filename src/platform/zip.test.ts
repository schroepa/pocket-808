import { crc32 as nodeCrc } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { crc32, zipStore } from './zip.ts';

describe('ZIP (ohne Kompression)', () => {
  it('CRC-32 wie zlib', () => {
    const data = new TextEncoder().encode('Pocket 808 – Drum Machine');
    expect(crc32(data)).toBe(nodeCrc(data));
    expect(crc32(new Uint8Array(0))).toBe(0);
  });

  it('eine Datei: lokaler Kopf, Daten unverändert, Verzeichnis und Abschluss', () => {
    const data = Uint8Array.from([1, 2, 3, 250]);
    const z = zipStore('beat.wav', data, new Date(2026, 9, 15, 13, 30, 10));
    const v = new DataView(z.buffer);
    const name = new TextEncoder().encode('beat.wav');
    // lokaler Dateikopf
    expect(v.getUint32(0, true)).toBe(0x04034b50);
    expect(v.getUint16(8, true)).toBe(0); // gespeichert, nicht komprimiert
    expect(v.getUint32(14, true)).toBe(nodeCrc(data));
    expect(v.getUint32(18, true)).toBe(4);
    expect(v.getUint32(22, true)).toBe(4);
    expect(v.getUint16(26, true)).toBe(name.length);
    expect([...z.subarray(30, 30 + name.length)]).toEqual([...name]);
    expect([...z.subarray(30 + name.length, 34 + name.length)]).toEqual([1, 2, 3, 250]);
    // DOS-Zeit 13:30:10 und Datum 2026-10-15
    expect(v.getUint16(10, true)).toBe((13 << 11) | (30 << 5) | 5);
    expect(v.getUint16(12, true)).toBe(((2026 - 1980) << 9) | (10 << 5) | 15);
    // zentrales Verzeichnis
    const cd = 30 + name.length + 4;
    expect(v.getUint32(cd, true)).toBe(0x02014b50);
    expect(v.getUint32(cd + 16, true)).toBe(nodeCrc(data));
    expect(v.getUint32(cd + 42, true)).toBe(0); // Versatz des lokalen Kopfs
    // Abschluss
    const end = z.length - 22;
    expect(v.getUint32(end, true)).toBe(0x06054b50);
    expect(v.getUint16(end + 10, true)).toBe(1);
    expect(v.getUint32(end + 12, true)).toBe(46 + name.length);
    expect(v.getUint32(end + 16, true)).toBe(cd);
    expect(z.length).toBe(30 + name.length + 4 + 46 + name.length + 22);
  });
});
