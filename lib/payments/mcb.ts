import "server-only";
import { createHmac, timingSafeEqual } from "crypto";

export function isMcbConfigured(): boolean {
  return Boolean(process.env.MCB_MERCHANT_ID && process.env.MCB_API_KEY && process.env.MCB_WEBHOOK_SECRET);
}

/**
 * MCB juice/API credentials are not issued yet, so online payment stays
 * "Coming Soon" in the booking wizard. This throws rather than faking a
 * checkout URL, per the no-fake-payment-success constraint.
 */
export async function createMcbPaymentIntent(): Promise<never> {
  throw new Error("Online payment via MCB is not yet available.");
}

/**
 * HMAC-SHA256 signature check for the MCB webhook, verified with a
 * constant-time comparison to avoid timing attacks. The exact header name
 * and signing scheme will need to match MCB's real webhook docs once
 * credentials are issued; this is a best-effort stub in that shape.
 */
export function verifyMcbWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.MCB_WEBHOOK_SECRET;
  if (!secret || !signatureHeader) return false;

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const expectedBuf = Buffer.from(expected, "hex");
  const actualBuf = Buffer.from(signatureHeader, "hex");

  if (expectedBuf.length !== actualBuf.length) return false;
  return timingSafeEqual(expectedBuf, actualBuf);
}
