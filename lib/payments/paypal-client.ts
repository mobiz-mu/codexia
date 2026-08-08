import "server-only";

/**
 * Server-only PayPal REST client (Orders API v2 + webhook verification).
 * Deliberately fetch-based with no @paypal/* SDK dependency — the API is
 * plain JSON over HTTPS with OAuth2 client-credentials auth, and this keeps
 * the project's dependency footprint unchanged.
 */

type PayPalEnvironment = "sandbox" | "live";

function getEnvironment(): PayPalEnvironment {
  const env = process.env.PAYPAL_ENVIRONMENT;
  return env === "live" ? "live" : "sandbox";
}

function getBaseUrl(): string {
  return getEnvironment() === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
}

// .env.example ships these as empty; a few setups end up with the literal
// placeholder text pasted in instead of a real value (e.g. "YOUR_SECRET").
// That still "looks set" to a truthiness check, so every PayPal call fails
// with an opaque 401 — this catches it at the source with an actionable
// message instead of leaving the real cause to be reverse-engineered from
// PayPal's response.
const PLACEHOLDER_PATTERN = /^your[_-]/i;

function getClientId(): string {
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
  if (!clientId) throw new Error("NEXT_PUBLIC_PAYPAL_CLIENT_ID is not set");
  if (PLACEHOLDER_PATTERN.test(clientId)) {
    throw new Error(
      "NEXT_PUBLIC_PAYPAL_CLIENT_ID is still set to a placeholder value — replace it with the real Client ID from your PayPal Developer Dashboard app."
    );
  }
  return clientId;
}

function getClientSecret(): string {
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!secret) throw new Error("PAYPAL_CLIENT_SECRET is not set");
  if (PLACEHOLDER_PATTERN.test(secret)) {
    throw new Error(
      "PAYPAL_CLIENT_SECRET is still set to a placeholder value (e.g. \"YOUR_SECRET\") — replace it with the real Secret from your PayPal Developer Dashboard app. This is why PayPal authentication is failing."
    );
  }
  return secret;
}

let cachedToken: { accessToken: string; expiresAt: number } | null = null;

async function getPayPalAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.accessToken;
  }

  const credentials = Buffer.from(`${getClientId()}:${getClientSecret()}`).toString("base64");
  const response = await fetch(`${getBaseUrl()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    if (response.status === 401) {
      console.error("PayPal OAuth token request rejected (401) — PAYPAL_CLIENT_SECRET or client ID is invalid for this environment", {
        environment: getEnvironment(),
      });
      throw new Error("PayPal authentication failed: the configured Client ID/Secret pair was rejected by PayPal.");
    }
    console.error("PayPal OAuth token request failed", { status: response.status, environment: getEnvironment(), body });
    throw new Error(`PayPal OAuth token request failed: ${response.status}`);
  }

  const data = (await response.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return cachedToken.accessToken;
}

async function paypalFetch<T>(path: string, init: RequestInit): Promise<T> {
  const accessToken = await getPayPalAccessToken();
  const response = await fetch(`${getBaseUrl()}${path}`, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  const text = await response.text();
  const body = text ? (JSON.parse(text) as unknown) : null;

  if (!response.ok) {
    console.error("PayPal API request failed", { path, status: response.status, body });
    throw new Error(`PayPal API request to ${path} failed: ${response.status} ${text}`);
  }

  return body as T;
}

export type PayPalOrderResponse = {
  id: string;
  status: string;
};

export type PayPalCaptureResponse = {
  id: string;
  status: string;
  purchase_units: Array<{
    custom_id?: string;
    invoice_id?: string;
    payments?: {
      captures?: Array<{
        id: string;
        status: string;
        amount: { currency_code: string; value: string };
      }>;
    };
  }>;
  payer?: { payer_id?: string; email_address?: string };
};

/**
 * Creates a PayPal order server-side for the exact amount the server has
 * computed (never a client-supplied amount). `custom_id` binds the order to
 * the booking so capture-time verification can reject an order that doesn't
 * belong to the booking being confirmed.
 */
export async function createPayPalOrder(input: {
  amountEurCents: number;
  bookingId: string;
  bookingReference: string;
}): Promise<PayPalOrderResponse> {
  const value = (input.amountEurCents / 100).toFixed(2);
  return paypalFetch<PayPalOrderResponse>("/v2/checkout/orders", {
    method: "POST",
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: { currency_code: "EUR", value },
          description: `Codexia booking ${input.bookingReference}`,
          custom_id: input.bookingId,
          invoice_id: `${input.bookingReference}-${Date.now()}`,
        },
      ],
    }),
  });
}

export async function capturePayPalOrder(orderId: string): Promise<PayPalCaptureResponse> {
  return paypalFetch<PayPalCaptureResponse>(`/v2/checkout/orders/${orderId}/capture`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function getPayPalOrder(orderId: string): Promise<PayPalCaptureResponse> {
  return paypalFetch<PayPalCaptureResponse>(`/v2/checkout/orders/${orderId}`, {
    method: "GET",
  });
}

export type PayPalWebhookVerificationInput = {
  transmissionId: string;
  transmissionTime: string;
  certUrl: string;
  authAlgo: string;
  transmissionSig: string;
  webhookEvent: unknown;
};

export async function verifyPayPalWebhookSignature(input: PayPalWebhookVerificationInput): Promise<boolean> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) throw new Error("PAYPAL_WEBHOOK_ID is not set");
  if (PLACEHOLDER_PATTERN.test(webhookId)) {
    throw new Error(
      "PAYPAL_WEBHOOK_ID is still set to a placeholder value — replace it with the real Webhook ID from your PayPal Developer Dashboard app's webhook subscription."
    );
  }

  const result = await paypalFetch<{ verification_status: string }>(
    "/v1/notifications/verify-webhook-signature",
    {
      method: "POST",
      body: JSON.stringify({
        transmission_id: input.transmissionId,
        transmission_time: input.transmissionTime,
        cert_url: input.certUrl,
        auth_algo: input.authAlgo,
        transmission_sig: input.transmissionSig,
        webhook_id: webhookId,
        webhook_event: input.webhookEvent,
      }),
    }
  );

  return result.verification_status === "SUCCESS";
}
