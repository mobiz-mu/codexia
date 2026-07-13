import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyMcbWebhookSignature } from "@/lib/payments/mcb";
import { canTransition, type BookingStatus } from "@/lib/booking/status-machine";
import { createNotification } from "@/lib/notifications/create";

type McbWebhookPayload = {
  idempotency_key: string;
  booking_reference: string;
  amount_cents: number;
  currency?: string;
  status: "succeeded" | "failed" | "cancelled";
  provider_ref?: string;
};

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-mcb-signature");

  if (!verifyMcbWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: McbWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: booking } = await supabase
    .from("bookings")
    .select("id, status, total_cents, paid_cents")
    .eq("reference", payload.booking_reference)
    .maybeSingle();

  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  const { data: existing } = await supabase
    .from("payment_transactions")
    .select("id, status")
    .eq("idempotency_key", payload.idempotency_key)
    .maybeSingle();

  // Idempotent: a retried webhook delivery for an already-processed
  // transaction is a no-op, so MCB retries can never double-credit a booking.
  if (existing && existing.status !== "pending") {
    return NextResponse.json({ ok: true, alreadyProcessed: true });
  }

  const transactionRow = {
    booking_id: booking.id,
    provider: "mcb",
    provider_ref: payload.provider_ref ?? null,
    amount_cents: payload.amount_cents,
    currency: payload.currency ?? "EUR",
    status: payload.status,
    webhook_payload: payload,
    idempotency_key: payload.idempotency_key,
  };

  if (existing) {
    await supabase.from("payment_transactions").update(transactionRow).eq("id", existing.id);
  } else {
    await supabase.from("payment_transactions").insert(transactionRow);
  }

  if (payload.status === "succeeded") {
    const newPaidCents = booking.paid_cents + payload.amount_cents;
    await supabase.from("payments").insert({
      booking_id: booking.id,
      method: "online",
      amount_cents: payload.amount_cents,
      currency: payload.currency ?? "EUR",
      status: "recorded",
      note: `MCB transaction ${payload.provider_ref ?? payload.idempotency_key}`,
      paid_at: new Date().toISOString(),
    });

    const currentStatus = booking.status as BookingStatus;
    const targetStatus: BookingStatus = newPaidCents >= booking.total_cents ? "paid" : "partially_paid";

    if (canTransition(currentStatus, targetStatus)) {
      await supabase.from("bookings").update({ paid_cents: newPaidCents, status: targetStatus }).eq("id", booking.id);
      await supabase.from("booking_status_history").insert({
        booking_id: booking.id,
        old_status: currentStatus,
        new_status: targetStatus,
        customer_note: "Payment received via MCB",
      });
    } else {
      await supabase.from("bookings").update({ paid_cents: newPaidCents }).eq("id", booking.id);
    }

    await createNotification(
      "online_payment_received",
      { reference: payload.booking_reference, amountCents: payload.amount_cents },
      `/admin/bookings/${booking.id}`
    );
  }

  return NextResponse.json({ ok: true });
}
