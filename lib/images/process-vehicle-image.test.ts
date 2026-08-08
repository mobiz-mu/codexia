import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { processVehicleImage } from "./process-vehicle-image";

async function makeTestImage(width = 800, height = 600) {
  return sharp({
    create: { width, height, channels: 3, background: { r: 100, g: 150, b: 200 } },
  })
    .jpeg()
    .toBuffer();
}

describe("processVehicleImage", () => {
  it("generates a webp variant for every size", async () => {
    const input = await makeTestImage();
    const result = await processVehicleImage(input);

    for (const size of ["thumb", "card", "hero", "gallery"] as const) {
      expect(result.variants[size]?.webp).toBeInstanceOf(Buffer);
      expect(result.variants[size]!.webp!.length).toBeGreaterThan(0);
    }
  });

  it("never upscales beyond the source width", async () => {
    const input = await makeTestImage(300, 200); // narrower than the "hero" target of 1200
    const result = await processVehicleImage(input);

    const heroMeta = await sharp(result.variants.hero!.webp!).metadata();
    expect(heroMeta.width).toBeLessThanOrEqual(300);
  });

  it("produces a small base64 blur placeholder", async () => {
    const input = await makeTestImage();
    const result = await processVehicleImage(input);

    expect(result.blurDataUrl).toMatch(/^data:image\/webp;base64,/);
    expect(result.blurDataUrl.length).toBeLessThan(2000);
  });

  it("produces a stable content hash for identical bytes", async () => {
    const input = await makeTestImage();
    const a = await processVehicleImage(input);
    const b = await processVehicleImage(Buffer.from(input));
    expect(a.contentHash).toBe(b.contentHash);
    expect(a.contentHash).toHaveLength(64);
  });

  it("produces a different hash for different images", async () => {
    const a = await processVehicleImage(await makeTestImage(800, 600));
    const b = await processVehicleImage(await makeTestImage(400, 300));
    expect(a.contentHash).not.toBe(b.contentHash);
  });
});
