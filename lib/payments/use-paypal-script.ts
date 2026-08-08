"use client";

import { useEffect, useState } from "react";

declare global {
  interface Window {
    paypal?: unknown;
  }
}

let loadPromise: Promise<void> | null = null;

/**
 * Loads the PayPal JS SDK exactly once per page, no matter how many
 * PayPalCheckoutButton instances mount. Currency is fixed to EUR — the
 * site's sole live pricing currency (see lib/pricing/deposit.ts); any
 * legacy MUR-priced record is rejected before reaching checkout.
 */
function loadPayPalScript(clientId: string): Promise<void> {
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    if (window.paypal) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(
      clientId
    )}&currency=EUR&intent=capture&disable-funding=venmo`;
    script.async = true;
    script.onload = () => {
      // The browser fires `load` once the network request for the script
      // succeeds, even if the script's own body throws (e.g. PayPal
      // rejecting an invalid/malformed client-id with a thrown "SDK
      // Validation error" instead of a network-level failure). That leaves
      // window.paypal undefined despite a "successful" load — check for it
      // explicitly rather than trusting onload alone, so a bad client-id
      // surfaces as a real error instead of an infinite silent spinner.
      const paypal = (window as unknown as { paypal?: { Buttons?: unknown } }).paypal;
      if (!paypal || typeof paypal.Buttons !== "function") {
        reject(new Error("PayPal SDK loaded but did not initialize — the client ID is likely invalid."));
        return;
      }
      resolve();
    };
    script.onerror = () => reject(new Error("Failed to load the PayPal SDK."));
    document.body.appendChild(script);
  });

  return loadPromise;
}

export function usePayPalScript(clientId: string | undefined) {
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    loadPayPalScript(clientId)
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch((err) => {
        // Technical reason to the browser console for debugging (no
        // secrets involved — client ID is a public value by design); the
        // customer only ever sees the generic message below.
        console.error("PayPal SDK failed to initialize", err instanceof Error ? err.message : err);
        if (!cancelled) setLoadError("Failed to load PayPal. Please refresh and try again.");
      });
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  const error = !clientId ? "PayPal is not configured." : loadError;

  return { ready, error };
}
