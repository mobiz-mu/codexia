import "server-only";
import { createHash } from "crypto";
import sharp from "sharp";

export type ImageVariantSize = "thumb" | "card" | "hero" | "gallery";
export type ImageVariantFormat = "webp" | "avif";

// Target width per purpose — admin thumbnails/fleet cards never need a
// 1200px-wide image, so serving the right variant instead of the original
// cuts real bytes over the wire, independent of next/image's own on-request
// resizing.
const VARIANT_WIDTHS: Record<ImageVariantSize, number> = {
  thumb: 160,
  card: 480,
  hero: 1200,
  gallery: 800,
};

export type ProcessedImageVariants = Partial<Record<ImageVariantSize, Partial<Record<ImageVariantFormat, Buffer>>>>;

export type ProcessedImage = {
  contentHash: string;
  blurDataUrl: string;
  variants: ProcessedImageVariants;
  strippedOriginal: Buffer;
};

/**
 * Generates WebP (always) and AVIF (best-effort) variants at a fixed set of
 * sizes, plus a base64 blur placeholder, from an uploaded image buffer.
 * `.rotate()` with no arguments auto-orients using the source EXIF
 * orientation tag before sharp's default (metadata-stripping) output — the
 * visual rotation is preserved, everything else in EXIF (GPS, device info,
 * timestamps) is dropped, which is the point.
 *
 * `strippedOriginal` applies the same rotate-then-strip treatment at full
 * resolution — this is what actually gets uploaded as the "original" file,
 * so a customer's GPS/device metadata never lands in the (public) storage
 * bucket even though nothing downstream resizes it.
 */
export async function processVehicleImage(originalBuffer: Buffer): Promise<ProcessedImage> {
  const contentHash = createHash("sha256").update(originalBuffer).digest("hex");

  const metadata = await sharp(originalBuffer, { failOn: "none" }).metadata();
  const originalWidth = metadata.width ?? 0;

  const strippedOriginal = await sharp(originalBuffer, { failOn: "none" }).rotate().toBuffer();

  const variants: ProcessedImageVariants = {};

  for (const size of Object.keys(VARIANT_WIDTHS) as ImageVariantSize[]) {
    const targetWidth = VARIANT_WIDTHS[size];
    const width = originalWidth > 0 ? Math.min(targetWidth, originalWidth) : targetWidth;

    const pipeline = sharp(originalBuffer, { failOn: "none" }).rotate().resize({ width, withoutEnlargement: true });

    const webp = await pipeline.clone().webp({ quality: 78 }).toBuffer();
    const formats: Partial<Record<ImageVariantFormat, Buffer>> = { webp };

    try {
      formats.avif = await pipeline.clone().avif({ quality: 50 }).toBuffer();
    } catch (err) {
      // Some libvips builds lack AVIF support — WebP alone is still a real
      // improvement over serving the original, so don't fail the upload.
      console.error(`processVehicleImage: AVIF encoding unavailable for "${size}"`, err);
    }

    variants[size] = formats;
  }

  const blurBuffer = await sharp(originalBuffer, { failOn: "none" })
    .rotate()
    .resize({ width: 16 })
    .webp({ quality: 40 })
    .toBuffer();

  return {
    contentHash,
    blurDataUrl: `data:image/webp;base64,${blurBuffer.toString("base64")}`,
    variants,
    strippedOriginal,
  };
}
