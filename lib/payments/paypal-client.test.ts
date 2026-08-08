import { describe, it, expect, beforeEach, vi } from "vitest";

function mockFetchSequence(responses: Array<{ status?: number; body: unknown }>) {
  const fn = vi.fn();
  for (const { status = 200, body } of responses) {
    fn.mockImplementationOnce(async () => ({
      ok: status >= 200 && status < 300,
      status,
      text: async () => JSON.stringify(body),
      json: async () => body,
    }));
  }
  vi.stubGlobal("fetch", fn);
  return fn;
}

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllGlobals();
  process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID = "test-client-id";
  process.env.PAYPAL_CLIENT_SECRET = "test-client-secret";
  process.env.PAYPAL_ENVIRONMENT = "sandbox";
  process.env.PAYPAL_WEBHOOK_ID = "test-webhook-id";
});

describe("createPayPalOrder", () => {
  it("fetches an OAuth token then creates an order against the server-computed amount", async () => {
    const fetchMock = mockFetchSequence([
      { body: { access_token: "token-1", expires_in: 3600 } },
      { body: { id: "ORDER-1", status: "CREATED" } },
    ]);

    const { createPayPalOrder } = await import("./paypal-client");
    const result = await createPayPalOrder({
      amountEurCents: 10050,
      bookingId: "booking-1",
      bookingReference: "CDX-1",
    });

    expect(result).toEqual({ id: "ORDER-1", status: "CREATED" });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const [tokenCall, orderCall] = fetchMock.mock.calls;
    expect(tokenCall[0]).toBe("https://api-m.sandbox.paypal.com/v1/oauth2/token");

    expect(orderCall[0]).toBe("https://api-m.sandbox.paypal.com/v2/checkout/orders");
    const orderBody = JSON.parse(orderCall[1].body as string);
    expect(orderBody.purchase_units[0].amount).toEqual({ currency_code: "EUR", value: "100.50" });
    expect(orderBody.purchase_units[0].custom_id).toBe("booking-1");
  });

  it("uses the live API base URL when PAYPAL_ENVIRONMENT=live", async () => {
    process.env.PAYPAL_ENVIRONMENT = "live";
    const fetchMock = mockFetchSequence([
      { body: { access_token: "token-1", expires_in: 3600 } },
      { body: { id: "ORDER-1", status: "CREATED" } },
    ]);

    const { createPayPalOrder } = await import("./paypal-client");
    await createPayPalOrder({ amountEurCents: 100, bookingId: "b", bookingReference: "r" });

    expect(fetchMock.mock.calls[0][0]).toBe("https://api-m.paypal.com/v1/oauth2/token");
  });

  it("reuses a cached access token across calls instead of re-authenticating", async () => {
    const fetchMock = mockFetchSequence([
      { body: { access_token: "token-1", expires_in: 3600 } },
      { body: { id: "ORDER-1", status: "CREATED" } },
      { body: { id: "ORDER-2", status: "CREATED" } },
    ]);

    const { createPayPalOrder } = await import("./paypal-client");
    await createPayPalOrder({ amountEurCents: 100, bookingId: "b1", bookingReference: "r1" });
    await createPayPalOrder({ amountEurCents: 200, bookingId: "b2", bookingReference: "r2" });

    // One token fetch + two order-creation calls = 3, not 4.
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("throws when the order-creation request fails", async () => {
    mockFetchSequence([
      { body: { access_token: "token-1", expires_in: 3600 } },
      { status: 400, body: { name: "INVALID_REQUEST" } },
    ]);

    const { createPayPalOrder } = await import("./paypal-client");
    await expect(
      createPayPalOrder({ amountEurCents: 100, bookingId: "b", bookingReference: "r" })
    ).rejects.toThrow();
  });
});

describe("capturePayPalOrder", () => {
  it("posts to the capture endpoint for the given order id", async () => {
    const fetchMock = mockFetchSequence([
      { body: { access_token: "token-1", expires_in: 3600 } },
      { body: { id: "ORDER-1", status: "COMPLETED", purchase_units: [] } },
    ]);

    const { capturePayPalOrder } = await import("./paypal-client");
    const result = await capturePayPalOrder("ORDER-1");

    expect(result.status).toBe("COMPLETED");
    expect(fetchMock.mock.calls[1][0]).toBe("https://api-m.sandbox.paypal.com/v2/checkout/orders/ORDER-1/capture");
  });
});

describe("verifyPayPalWebhookSignature", () => {
  it("returns true when PayPal reports SUCCESS", async () => {
    mockFetchSequence([
      { body: { access_token: "token-1", expires_in: 3600 } },
      { body: { verification_status: "SUCCESS" } },
    ]);

    const { verifyPayPalWebhookSignature } = await import("./paypal-client");
    const verified = await verifyPayPalWebhookSignature({
      transmissionId: "t1",
      transmissionTime: "2026-01-01T00:00:00Z",
      certUrl: "https://api.paypal.com/cert",
      authAlgo: "SHA256withRSA",
      transmissionSig: "sig",
      webhookEvent: { id: "evt-1" },
    });

    expect(verified).toBe(true);
  });

  it("returns false when PayPal reports failure", async () => {
    mockFetchSequence([
      { body: { access_token: "token-1", expires_in: 3600 } },
      { body: { verification_status: "FAILURE" } },
    ]);

    const { verifyPayPalWebhookSignature } = await import("./paypal-client");
    const verified = await verifyPayPalWebhookSignature({
      transmissionId: "t1",
      transmissionTime: "2026-01-01T00:00:00Z",
      certUrl: "https://api.paypal.com/cert",
      authAlgo: "SHA256withRSA",
      transmissionSig: "sig",
      webhookEvent: { id: "evt-1" },
    });

    expect(verified).toBe(false);
  });
});
