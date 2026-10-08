/**
 * Client-side photo compression for FishMB uploads.
 *
 * iPhone photos are routinely 4–8MB, which exceeds the ~4.5MB serverless
 * request-body limit — the request dies before the server can parse it.
 * Compress every photo before appending it to FormData so uploads survive.
 */

type Drawable = ImageBitmap | HTMLImageElement;

/**
 * Compress an image file: long edge ≤ 1920px, JPEG quality 0.82.
 * Returns the original file untouched on any failure or if it isn't an image.
 * Never upscales.
 */
export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  try {
    const src = await loadDrawable(file);
    const width = src.width as number;
    const height = src.height as number;
    const longEdge = Math.max(width, height);
    const scale = longEdge > 1920 ? 1920 / longEdge : 1;
    if (scale >= 1 && file.type === "image/jpeg" && file.size <= 4_000_000) {
      return file; // already small enough
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
    if (typeof (src as ImageBitmap).close === "function") {
      (src as ImageBitmap).close();
    }
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.82)
    );
    if (!blob) return file;
    const name = file.name.replace(/\.\w+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg" });
  } catch {
    return file;
  }
}

async function loadDrawable(file: File): Promise<Drawable> {
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(file);
  }
  // Fallback for very old browsers: decode via an <img> element.
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("decode failed"));
      img.src = url;
    });
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}
