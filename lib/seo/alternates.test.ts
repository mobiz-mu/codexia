import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { buildAlternates } from "./alternates";

describe("buildAlternates", () => {
  const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://www.codexia.mu";
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
  });

  it("builds a self-referencing canonical for the current locale", () => {
    const result = buildAlternates("en", "/fleet/nissan-march");
    expect(result?.canonical).toBe("https://www.codexia.mu/en/fleet/nissan-march");
  });

  it("emits hreflang entries for every locale plus x-default", () => {
    const result = buildAlternates("fr", "/about");
    const languages = result?.languages as Record<string, string>;
    expect(languages.en).toBe("https://www.codexia.mu/en/about");
    expect(languages.fr).toBe("https://www.codexia.mu/fr/about");
    expect(languages["x-default"]).toBe("https://www.codexia.mu/en/about");
  });

  it("treats the homepage path as empty rather than trailing-slashed", () => {
    const result = buildAlternates("en", "/");
    expect(result?.canonical).toBe("https://www.codexia.mu/en");
  });

  it("prefers an explicit canonical override when provided", () => {
    const result = buildAlternates("en", "/blog/my-post", "https://www.codexia.mu/custom-canonical");
    expect(result?.canonical).toBe("https://www.codexia.mu/custom-canonical");
  });

  it("falls back to localhost when NEXT_PUBLIC_SITE_URL is unset", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    const result = buildAlternates("en", "/contact");
    expect(result?.canonical).toBe("http://localhost:3000/en/contact");
  });
});
