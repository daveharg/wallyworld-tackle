/**
 * Minimal EXIF DateTimeOriginal reader for JPEGs.
 * Returns the photo's taken-at date, or null if not found/unreadable.
 */

/** Convert "2026:10:09 23:45:12" to a Date (local time). */
export function parseExifDate(s: string): Date | null {
  const m = s.match(/(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  const d = new Date(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    Number(m[4]),
    Number(m[5]),
    Number(m[6])
  );
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function getPhotoTakenAt(file: File): Promise<Date | null> {
  try {
    const buf = await file.slice(0, 65536).arrayBuffer();
    const view = new DataView(buf);
    if (view.getUint16(0) !== 0xffd8) return null; // not a JPEG

    let offset = 2;
    while (offset < view.byteLength - 8) {
      if (view.getUint8(offset) !== 0xff) break;
      const marker = view.getUint8(offset + 1);
      const len = view.getUint16(offset + 2);
      if (marker === 0xe1) {
        // APP1 — check for "Exif\0\0"
        if (
          view.getUint32(offset + 4) === 0x45786966 &&
          view.getUint16(offset + 8) === 0x0000
        ) {
          const tiffStart = offset + 10;
          const date = parseTiffDate(view, tiffStart);
          if (date) return date;
        }
      }
      if (marker === 0xda || marker === 0xd9) break; // start of scan / end
      offset += 2 + len;
    }
  } catch {
    // Fall through to null.
  }
  return null;
}

function parseTiffDate(view: DataView, tiffStart: number): Date | null {
  try {
    const little = view.getUint16(tiffStart) === 0x4949;
    const get16 = (o: number) => (little ? view.getUint16(o, true) : view.getUint16(o));
    const get32 = (o: number) => (little ? view.getUint32(o, true) : view.getUint32(o));

    if (get16(tiffStart + 2) !== 42) return null;
    const ifd0 = tiffStart + get32(tiffStart + 4);
    const entries = get16(ifd0);

    // Find EXIF sub-IFD pointer (tag 0x8769).
    let exifIfd = 0;
    for (let i = 0; i < entries; i++) {
      const e = ifd0 + 2 + i * 12;
      if (get16(e) === 0x8769) {
        exifIfd = tiffStart + get32(e + 8);
        break;
      }
    }
    if (!exifIfd) return null;

    const exifEntries = get16(exifIfd);
    for (let i = 0; i < exifEntries; i++) {
      const e = exifIfd + 2 + i * 12;
      const tag = get16(e);
      // 0x9003 = DateTimeOriginal, 0x9004 = DateTimeDigitized
      if (tag === 0x9003 || tag === 0x9004) {
        const type = get16(e + 2);
        const count = get32(e + 4);
        if (type !== 2 || count < 19) continue; // ASCII, at least "YYYY:MM:DD HH:MM:SS"
        const valOffset = get32(e + 8);
        // Value is stored inline if it fits in 4 bytes, else it's an offset.
        // DateTime is 20 bytes so it's always an offset.
        const strOff = tiffStart + valOffset;
        let s = "";
        for (let j = 0; j < 19 && strOff + j < view.byteLength; j++) {
          const c = view.getUint8(strOff + j);
          if (c === 0) break;
          s += String.fromCharCode(c);
        }
        const d = parseExifDate(s);
        if (d) return d;
      }
    }
  } catch {
    // Fall through.
  }
  return null;
}
