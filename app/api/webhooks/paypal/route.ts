import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyPayPalWebhookSignature } from "@/lib/payments/paypal-client";
import { createNotification } from "@/lib/notifications/create";

type PayPalCaptureResource = {
  id: string;
  status: string;
  custom_id?: string;
  amount?: { currency_code: string; value: string };
  supplementary_data?: { related_ids?: { order_id?: string } };
};

type PayPalWebhookEvent = {
  id: string;
  event_type: string;
  resource: PayPalCaptureResource;
};

/**
 * Secondary, asynchronous confirmation channel for PayPal payment events —
 * the primary flow is the direct createOrder/capture round trip in
 * lib/actions/booking.ts. This exists to (a) catch captures the browser
 * never got to report (tab closed mid-flow) and (b) record refunds/disputes/
 * reversals, which only ever arrive as webhooks, never as a browser event.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  const transmissionId = request.headers.get("paypal-transmission-id");
  const transmissionTime = request.headers.get("paypal-transmission-time");
  const certUrl = request.headers.get("paypal-cert-url");
  const authAlgo = request.headers.get("paypal-auth-algo");
  const transmissionSig = request.headers.get("paypal-transmission-sig");

  if (!transmissionId || !transmissionTime || !certUrl || !authAlgo || !transmissionSig) {
    return NextResponse.json({ error: "Missing PayPal signature headers" }, { status: 400 });
  }

  let event: PayPalWebhookEvent;
  try {
    event = JSON.parse(rawBody) as PayPalWebhookEvent;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  let verified = false;
  try {
    verified = await verifyPayPalWebhookSignature({
      transmissionId,
      transmissionTime,
      certUrl,
      authAlgo,
      transmissionSig,
      webhookEvent: event,
    });
  } catch (err) {
    console.error("PayPal webhook signature verification request failed", err);
    return NextResponse.json({ error: "Signature verification failed" }, { status: 400 });
  }

  if (!verified) {
    console.error("PayPal webhook signature invalid", { eventId: event.id, eventType: event.event_type });
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { error: insertError } = await supabase.from("webhook_events").insert({
    provider: "paypal",
    event_id: event.id,
    event_type: event.event_type,
    payload: event,
  });
  if (insertError) {
    // Unique violation on event_id = we've already processed this delivery
    // (PayPal retries webhooks) — ack without reprocessing.
    return NextResponse.json({ ok: true, duplicate: true });
  }

  await handlePayPalEvent(supabase, event);

  await supabase.from("webhook_events").update({ processed_at: new Date().toISOString() }).eq("event_id", event.id);

  console.log("PayPal webhook processed", { eventId: event.id, eventType: event.event_type });
  return NextResponse.json({ ok: true });
}

async function handlePayPalEvent(supabase: ReturnType<typeof createAdminClient>, event: PayPalWebhookEvent) {
  const resource = event.resource;
  const orderId = resource.supplementary_data?.related_ids?.order_id;

  switch (event.event_type) {
    case "PAYMENT.CAPTURE.COMPLETED":
      await handleCaptureCompleted(supabase, resource, orderId);
      return;
    case "PAYMENT.CAPTURE.DENIED":
      await markTransactionStatus(supabase, orderId, resource, "denied");
      await notifyAdmin(supabase, "payment_verification_failed", orderId, resource, "capture_denied_webhook");
      return;
    case "PAYMENT.CAPTURE.REFUNDED":
      await markTransactionStatus(supabase, orderId, resource, "refunded");
      await notifyAdmin(supabase, "payment_refunded", orderId, resource, "capture_refunded_webhook");
      return;
    case "PAYMENT.CAPTURE.REVERSED":
      await markTransactionStatus(supabase, orderId, resource, "reversed");
      await notifyAdmin(supabase, "payment_refunded", orderId, resource, "capture_reversed_webhook");
      return;
    default:
      // Unrecognized/uninteresting event type — acknowledged, no action.
      return;
  }
}

async function findTransaction(supabase: ReturnType<typeof createAdminClient>, orderId: string | undefined, captureId: string) {
  if (orderId) {
    const { data } = await supabase
      .from("payment_transactions")
      .select("id, booking_id, status, amount_cents")
      .eq("idempotency_key", orderId)
      .maybeSingle();
    if (data) return data;
  }
  const { data } = await supabase
    .from("payment_transactions")
    .select("id, booking_id, status, amount_cents")
    .eq("capture_id", captureId)
    .maybeSingle();
  return data;
}

async function markTransactionStatus(
  supabase: ReturnType<typeof createAdminClient>,
  orderId: string | undefined,
  resource: PayPalCaptureResource,
  status: "denied" | "refunded" | "reversed"
) {
  const transaction = await findTransaction(supabase, orderId, resource.id);
  if (!transaction) {
    console.error("PayPal webhook: no matching payment_transactions row", { orderId, captureId: resource.id, status });
    return;
  }
  await supabase.from("payment_transactions").update({ status }).eq("id", transaction.id);
}

async function notifyAdmin(
  supabase: ReturnType<typeof createAdminClient>,
  type: "payment_verification_failed" | "payment_refunded",
  orderId: string | undefined,
  resource: PayPalCaptureResource,
  reason: string
) {
  const transaction = orderId
    ? await supabase.from("payment_transactions").select("booking_id").eq("idempotency_key", orderId).maybeSingle()
    : { data: null };
  const bookingId = transaction.data?.booking_id ?? null;

  await createNotification(
    type,
    { orderId: orderId ?? null, captureId: resource.id, reason },
    bookingId ? `/admin/bookings/${bookingId}` : undefined
  );
}

async function handleCaptureCompleted(
  supabase: ReturnType<typeof createAdminClient>,
  resource: PayPalCaptureResource,
  orderId: string | undefined
) {
  const transaction = await findTransaction(supabase, orderId, resource.id);
  if (!transaction) {
    console.error("PayPal webhook COMPLETED: no matching payment_transactions row", { orderId, captureId: resource.id });
    return;
  }

  if (transaction.status === "succeeded") {
    // Already confirmed via the direct capture flow — duplicate delivery
    // (PayPal retries webhooks) or the two channels raced. Not an error.
    console.log("PayPal webhook: duplicate capture ignored (already succeeded)", { orderId, captureId: resource.id });
    return;
  }

  const { data: booking } = await supabase
    .from("bookings")
    .select("id, reference, status, total_cents, paid_cents, currency, vehicle_id")
    .eq("id", transaction.booking_id)
    .maybeSingle();
  if (!booking || booking.paid_cents > 0) return;

  const capturedAmountEurCents = resource.amount ? Math.round(parseFloat(resource.amount.value) * 100) : 0;
  const currencyOk = resource.amount?.currency_code === "EUR";
  const referenceOk = resource.custom_id === booking.id;
  const amountOk = capturedAmountEurCents >= transaction.amount_cents - 5;

  if (!currencyOk || !referenceOk || !amountOk || resource.status !== "COMPLETED") {
    const reason = !currencyOk
      ? "currency_mismatch"
      : !referenceOk
        ? "booking_reference_mismatch"
        : !amountOk
          ? "amount_mismatch"
          : "capture_not_completed";
    console.error("PayPal webhook verification failed", { bookingId: booking.id, orderId, reason });
    const { error: denyError } = await supabase
      .from("payment_transactions")
      .update({ status: "denied" })
      .eq("id", transaction.id);
    if (denyError) {
      console.error("PayPal webhook: failed to mark transaction denied (database write failure)", denyError.message);
    }
    await notifyAdmin(supabase, "payment_verification_failed", orderId, resource, reason);
    return;
  }

  // Mirrors captureBookingPayment's success path in lib/actions/booking.ts —
  // this only runs when the browser never got to report the capture itself.
  const { computeDeposit } = await import("@/lib/pricing/deposit");
  const { getSiteSettings } = await import("@/lib/config/get-site-settings");
  const { canTransition } = await import("@/lib/booking/status-machine");
  const { sendBookingConfirmedEmail } = await import("@/lib/email/booking-confirmed");

  const currentStatus = booking.status as Parameters<typeof canTransition>[0];
  if (!canTransition(currentStatus, "confirmed")) return;

  const [{ data: vehicle }, { data: customer }, settings] = await Promise.all([
    booking.vehicle_id
      ? supabase.from("vehicles").select("name").eq("id", booking.vehicle_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("booking_customers").select("full_name").eq("booking_id", booking.id).maybeSingle(),
    getSiteSettings(),
  ]);
  const deposit = computeDeposit({
    totalCents: booking.total_cents,
    currency: booking.currency,
    depositThresholdEurCents: settings.depositThresholdEurCents,
    depositMidTierMaxEurCents: settings.depositMidTierMaxEurCents,
    depositMidTierAmountEurCents: settings.depositMidTierAmountEurCents,
    depositHighTierAmountEurCents: settings.depositHighTierAmountEurCents,
    legacyExchangeRate: settings.eurExchangeRate,
  });

  const { error: markSucceededError } = await supabase
    .from("payment_transactions")
    .update({ status: "succeeded", capture_id: resource.id })
    .eq("id", transaction.id);
  if (markSucceededError) {
    console.error("PayPal webhook: failed to mark transaction succeeded (database write failure)", markSucceededError.message);
  }

  const { error: paymentInsertError } = await supabase.from("payments").insert({
    booking_id: booking.id,
    method: "online",
    amount_cents: deposit.depositCents,
    currency: booking.currency,
    status: "recorded",
    note: `PayPal order ${orderId ?? "unknown"} (confirmed via webhook)`,
    paid_at: new Date().toISOString(),
  });
  if (paymentInsertError) {
    console.error("PayPal webhook: failed to record payments row (database write failure)", paymentInsertError.message);
  }

  const { error: bookingUpdateError } = await supabase
    .from("bookings")
    .update({ paid_cents: booking.paid_cents + deposit.depositCents, status: "confirmed" })
    .eq("id", booking.id);
  if (bookingUpdateError) {
    console.error("PayPal webhook: failed to update booking to confirmed (database write failure)", bookingUpdateError.message);
  }

  await supabase.from("booking_status_history").insert({
    booking_id: booking.id,
    old_status: currentStatus,
    new_status: "confirmed",
    customer_note: "Payment received via PayPal (confirmed via webhook)",
  });

  // No locale is stored on the booking; the direct-capture flow gets it
  // from the client, but this fallback path only ever runs when that flow
  // never completed, so default to English.
  await sendBookingConfirmedEmail(booking.id, "en");

  await createNotification(
    "online_payment_received",
    { reference: booking.reference, customerName: customer?.full_name ?? "", vehicleName: vehicle?.name ?? "" },
    `/admin/bookings/${booking.id}`
  );

  await supabase.from("analytics_events").insert({ event: "booking_paid", vehicle_id: booking.vehicle_id });
}
