import { publicStorageUrl } from "./storage";

export type VehicleImageVariantSize = "thumb" | "card" | "hero" | "gallery";

type VehicleImageVariants = Partial<
  Record<VehicleImageVariantSize, Partial<Record<"webp" | "avif", string>>>
>;

/**
 * Resolves the public URL for a vehicle image at a given purpose size,
 * preferring the pre-generated WebP variant (lib/images/process-vehicle-image.ts)
 * over the full original — a fleet-card doesn't need a 1200px source. Falls
 * back to the original path for images uploaded before the variant pipeline
 * existed (no variants recorded), so nothing breaks for older uploads.
 */
export function vehicleImageUrl(
  image: { path: string; variants?: unknown },
  size: VehicleImageVariantSize
): string | null {
  const variants = image.variants as VehicleImageVariants | null | undefined;
  const variantPath = variants?.[size]?.webp;
  return publicStorageUrl("vehicle-images", variantPath ?? image.path);
}
