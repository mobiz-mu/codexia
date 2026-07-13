import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHmac } from "crypto";
import { verifyMcbWebhookSignature } from "./mcb";

describe("verifyMcbWebhookSignature", () => {
  const originalSecret = process.env.MCB_WEBHOOK_SECRET;

  beforeEach(() => {
    process.env.MCB_WEBHOOK_SECRET = "test-secret";
  });

  afterEach(() => {
    process.env.MCB_WEBHOOK_SECRET = originalSecret;
  });

  it("accepts a correctly signed payload", () => {
    const body = JSON.stringify({ amount_cents: 1000 });
    const signature = createHmac("sha256", "test-secret").update(body).digest("hex");
    expect(verifyMcbWebhookSignature(body, signature)).toBe(true);
  });

  it("rejects a payload signed with the wrong secret", () => {
    const body = JSON.stringify({ amount_cents: 1000 });
    const signature = createHmac("sha256", "wrong-secret").update(body).digest("hex");
    expect(verifyMcbWebhookSignature(body, signature)).toBe(false);
  });

  it("rejects a tampered body even with a validly-formatted signature", () => {
    const originalBody = JSON.stringify({ amount_cents: 1000 });
    const signature = createHmac("sha256", "test-secret").update(originalBody).digest("hex");
    const tamperedBody = JSON.stringify({ amount_cents: 999999 });
    expect(verifyMcbWebhookSignature(tamperedBody, signature)).toBe(false);
  });

  it("rejects when no signature header is present", () => {
    expect(verifyMcbWebhookSignature("{}", null)).toBe(false);
  });

  it("rejects when the webhook secret is not configured", () => {
    delete process.env.MCB_WEBHOOK_SECRET;
    const body = "{}";
    const signature = createHmac("sha256", "test-secret").update(body).digest("hex");
    expect(verifyMcbWebhookSignature(body, signature)).toBe(false);
  });
});
