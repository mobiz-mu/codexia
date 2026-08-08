"use client";

import { useEffect, useId, useRef, useState } from "react";
import { usePayPalScript } from "@/lib/payments/use-paypal-script";

export type PayPalApproveDetails = {
  orderId: string;
};

/**
 * Reusable PayPal checkout button. Uses PayPal's dynamic Smart Buttons UI,
 * not a fixed-amount Hosted Button, because the amount charged has to vary
 * per booking (full amount vs. €100 deposit) — a Hosted Button's price is
 * fixed in the PayPal dashboard and can't be overridden from the page.
 *
 * Both createOrder and capture happen server-side (see createOrder/onApprove
 * below) — the browser only relays the order id PayPal's popup needs and the
 * fact that the customer approved it. The server is the source of truth for
 * whether the payment actually succeeded.
 */
export function PayPalCheckoutButton({
  bookingId,
  accessToken,
  disabled,
  onCreateOrder,
  onApprove,
  onError,
}: {
  bookingId: string;
  accessToken: string;
  disabled?: boolean;
  onCreateOrder: (bookingId: string, accessToken: string) => Promise<{ ok: true; orderId: string } | { ok: false; error: string }>;
  onApprove: (details: PayPalApproveDetails) => void | Promise<void>;
  onError?: (message: string) => void;
}) {
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
  const { ready, error: scriptError } = usePayPalScript(clientId);
  const containerId = `paypal-button-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const containerRef = useRef<HTMLDivElement>(null);
  const [renderError, setRenderError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || disabled || !containerRef.current) return;
    const paypal = (window as unknown as { paypal?: Record<string, unknown> }).paypal;
    if (!paypal || typeof paypal.Buttons !== "function") return;

    containerRef.current.innerHTML = "";

    type PayPalButtonsConfig = {
      style?: Record<string, unknown>;
      createOrder: () => Promise<string>;
      onApprove: (data: { orderID: string }) => Promise<void>;
      onError: (err: unknown) => void;
      onCancel?: () => void;
    };

    const buttonsFactory = paypal.Buttons as (config: PayPalButtonsConfig) => { render: (target: string) => void };

    const buttons = buttonsFactory({
      style: { layout: "vertical", color: "gold", shape: "pill", label: "paypal" },
      createOrder: async () => {
        const result = await onCreateOrder(bookingId, accessToken);
        if (!result.ok) {
          setRenderError(result.error);
          onError?.(result.error);
          throw new Error(result.error);
        }
        return result.orderId;
      },
      onApprove: async (data) => {
        try {
          await onApprove({ orderId: data.orderID });
        } catch {
          setRenderError("We couldn't confirm your payment. Please contact support before retrying.");
          onError?.("We couldn't confirm your payment. Please contact support before retrying.");
        }
      },
      onError: () => {
        setRenderError("PayPal was unable to process this payment. Please try again.");
        onError?.("PayPal was unable to process this payment. Please try again.");
      },
    });

    buttons.render(`#${containerId}`);
  }, [ready, disabled, bookingId, accessToken, containerId, onCreateOrder, onApprove, onError]);

  if (scriptError) {
    return <p className="text-sm text-red-600">{scriptError}</p>;
  }

  return (
    <div>
      <div id={containerId} ref={containerRef} aria-busy={!ready}>
        {!ready && <p className="text-sm text-muted">Loading PayPal…</p>}
      </div>
      {renderError && (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {renderError}
        </p>
      )}
    </div>
  );
}
