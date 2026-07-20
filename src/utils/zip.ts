/**
 * A minimal ZIP writer for exactly one case: bundling a single text
 * file with the Unix executable bit set, because a plain browser
 * download of a .command file loses its executable permission —
 * double-clicking it then fails with "you do not have appropriate
 * access privileges" (see src/components/ScanModal.tsx). Zip preserves
 * Unix file-mode bits in its external-attributes field, and both
 * Safari (auto-extracts on download) and Finder (double-click) restore
 * them on unzip, so this is the smallest fix that actually works
 * without asking anyone to open a terminal or run chmod.
 *
 * STORE only (no compression) — the file is a few KB of shell script,
 * not worth pulling in a deflate implementation for.
 */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date: Date): { time: number; dateVal: number } {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
  const dateVal = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, dateVal };
}

function writeUint32LE(view: DataView, offset: number, value: number) {
  view.setUint32(offset, value, true);
}

/** Builds a single-entry ZIP file. `unixMode` is an octal permission
 * value like 0o755 (rwxr-xr-x — needed so the extracted file is
 * directly double-clickable). */
export function createSingleFileZip(filename: string, content: string, unixMode: number): Blob {
  const nameBytes = new TextEncoder().encode(filename);
  const dataBytes = new TextEncoder().encode(content);
  const crc = crc32(dataBytes);
  const { time, dateVal } = dosDateTime(new Date());
  const externalAttrs = (unixMode << 16) | 0x8000; // 0x8000 = S_IFREG (regular file) in the high word Unix zip tools expect

  const localHeader = new Uint8Array(30 + nameBytes.length);
  const lv = new DataView(localHeader.buffer);
  writeUint32LE(lv, 0, 0x04034b50);
  lv.setUint16(4, 20, true); // version needed
  lv.setUint16(6, 0, true); // flags
  lv.setUint16(8, 0, true); // method: stored
  lv.setUint16(10, time, true);
  lv.setUint16(12, dateVal, true);
  writeUint32LE(lv, 14, crc);
  writeUint32LE(lv, 18, dataBytes.length);
  writeUint32LE(lv, 22, dataBytes.length);
  lv.setUint16(26, nameBytes.length, true);
  lv.setUint16(28, 0, true); // extra field length
  localHeader.set(nameBytes, 30);

  const centralHeaderOffset = localHeader.length + dataBytes.length;
  const centralHeader = new Uint8Array(46 + nameBytes.length);
  const cv = new DataView(centralHeader.buffer);
  writeUint32LE(cv, 0, 0x02014b50);
  cv.setUint16(4, (3 << 8) | 20, true); // version made by: unix (3) + spec version
  cv.setUint16(6, 20, true); // version needed
  cv.setUint16(8, 0, true); // flags
  cv.setUint16(10, 0, true); // method
  cv.setUint16(12, time, true);
  cv.setUint16(14, dateVal, true);
  writeUint32LE(cv, 16, crc);
  writeUint32LE(cv, 20, dataBytes.length);
  writeUint32LE(cv, 24, dataBytes.length);
  cv.setUint16(28, nameBytes.length, true);
  cv.setUint16(30, 0, true); // extra length
  cv.setUint16(32, 0, true); // comment length
  cv.setUint16(34, 0, true); // disk number
  cv.setUint16(36, 0, true); // internal attrs
  writeUint32LE(cv, 38, externalAttrs);
  writeUint32LE(cv, 42, 0); // local header offset
  centralHeader.set(nameBytes, 46);

  const endRecord = new Uint8Array(22);
  const ev = new DataView(endRecord.buffer);
  writeUint32LE(ev, 0, 0x06054b50);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, 1, true); // entries on this disk
  ev.setUint16(10, 1, true); // total entries
  writeUint32LE(ev, 12, centralHeader.length);
  writeUint32LE(ev, 16, centralHeaderOffset);
  ev.setUint16(20, 0, true); // comment length

  return new Blob([localHeader, dataBytes, centralHeader, endRecord], { type: 'application/zip' });
}
