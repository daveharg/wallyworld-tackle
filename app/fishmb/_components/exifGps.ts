/**
 * Lightweight EXIF GPS reader — extracts latitude/longitude from a JPEG's
 * EXIF data without any dependencies. Returns null when the photo has no
 * GPS tags (location services off, screenshot, stripped by a messaging app, …).
 */

function readAscii(view: DataView, offset: number, length: number): string {
  let s = "";
  for (let i = 0; i < length; i++) {
    const c = view.getUint8(offset + i);
    if (c === 0) break;
    s += String.fromCharCode(c);
  }
  return s;
}

function rational(view: DataView, offset: number, little: boolean): number {
  const num = little ? view.getUint32(offset, true) : view.getUint32(offset, false);
  const den = little ? view.getUint32(offset + 4, true) : view.getUint32(offset + 4, false);
  return den === 0 ? 0 : num / den;
}

function dmsToDeg(dms: number[], ref: string): number {
  const deg = dms[0] + dms[1] / 60 + dms[2] / 3600;
  return ref === "S" || ref === "W" ? -deg : deg;
}

export async function readGpsFromImage(file: File): Promise<{ lat: number; lng: number } | null> {
  try {
    const buf = await file.arrayBuffer();
    const view = new DataView(buf);
    if (view.getUint16(0, false) !== 0xffd8) return null; // not a JPEG

    let offset = 2;
    while (offset + 4 < view.byteLength) {
      if (view.getUint8(offset) !== 0xff) break;
      const marker = view.getUint8(offset + 1);
      const segLen = view.getUint16(offset + 2, false);
      // APP1 with Exif header
      if (marker === 0xe1 && segLen > 8 && readAscii(view, offset + 4, 4) === "Exif") {
        const tiffStart = offset + 10;
        const little = readAscii(view, tiffStart, 2) === "II";
        const get16 = (o: number) => (little ? view.getUint16(o, true) : view.getUint16(o, false));
        const get32 = (o: number) => (little ? view.getUint32(o, true) : view.getUint32(o, false));
        if (get16(tiffStart + 2) !== 42) return null;

        const ifd0 = tiffStart + get32(tiffStart + 4);
        const entries = get16(ifd0);
        let gpsIfdRel = 0;
        for (let i = 0; i < entries; i++) {
          const e = ifd0 + 2 + i * 12;
          if (get16(e) === 0x8825) {
            gpsIfdRel = get32(e + 8);
            break;
          }
        }
        if (!gpsIfdRel) return null;

        const gpsIfd = tiffStart + gpsIfdRel;
        const gEntries = get16(gpsIfd);
        let latRef = "", lngRef = "";
        let lat: number[] | null = null;
        let lng: number[] | null = null;
        for (let i = 0; i < gEntries; i++) {
          const e = gpsIfd + 2 + i * 12;
          const tag = get16(e);
          const type = get16(e + 2);
          const count = get32(e + 4);
          let valOff = e + 8;
          const typeSize = type === 2 ? 1 : type === 5 ? 8 : 0;
          if (typeSize * count > 4) valOff = tiffStart + get32(e + 8);
          if (tag === 0x0001) latRef = readAscii(view, valOff, 2);
          else if (tag === 0x0003) lngRef = readAscii(view, valOff, 2);
          else if (tag === 0x0002 && type === 5 && count === 3) {
            lat = [rational(view, valOff, little), rational(view, valOff + 8, little), rational(view, valOff + 16, little)];
          } else if (tag === 0x0004 && type === 5 && count === 3) {
            lng = [rational(view, valOff, little), rational(view, valOff + 8, little), rational(view, valOff + 16, little)];
          }
        }
        if (lat && lng) {
          return { lat: dmsToDeg(lat, latRef), lng: dmsToDeg(lng, lngRef) };
        }
        return null;
      }
      if (marker === 0xda || marker === 0xd9) break; // start of scan / end
      offset += 2 + segLen;
    }
  } catch {
    // fall through
  }
  return null;
}
