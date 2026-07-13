"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminUser } from "@/lib/auth/get-current-admin-user";
import { sendBookingConfirmedEmail } from "@/lib/email/booking-confirmed";

function assertPermission(user: { permissions: Set<string> }, permission: string) {
  if (!user.permissions.has(permission)) {
    throw new Error(`Missing required permission: ${permission}`);
  }
}

export async function listPendingProofs() {
  const user = await requireAdminUser();
  assertPermission(user, "approve_payment_proofs");

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("payment_proofs")
    .select("*, bookings(reference, total_cents)")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  type Row = {
    id: string;
    booking_id: string;
    storage_path: string;
    bank_name: string | null;
    transaction_ref: string | null;
    payment_date: string | null;
    bookings: { reference: string; total_cents: number } | null;
  };

  const rows = (data ?? []) as unknown as Row[];

  const withSignedUrls = await Promise.all(
    rows.map(async (row) => {
      const { data: signed } = await supabase.storage
        .from("payment-proofs")
        .createSignedUrl(row.storage_path, 300);
      return { ...row, signedUrl: signed?.signedUrl ?? null };
    })
  );

  return withSignedUrls;
}

export type ProofActionResult = { ok: true } | { ok: false; error: string };

export async function approvePaymentProof(proofId: string, locale: "en" | "fr" = "en"): Promise<ProofActionResult> {
  const user = await requireAdminUser();
  assertPermission(user, "approve_payment_proofs");

  const supabase = createAdminClient();
  const { data: proof } = await supabase.from("payment_proofs").select("*").eq("id", proofId).maybeSingle();
  if (!proof) return { ok: false, error: "Proof not found." };

  const { data: booking } = await supabase.from("bookings").select("*").eq("id", proof.booking_id).maybeSingle();
  if (!booking) return { ok: false, error: "Booking not found." };

  await supabase.from("payment_proofs").update({ status: "approved", reviewer_id: user.id }).eq("id", proofId);

  await supabase.from("payments").insert({
    booking_id: booking.id,
    method: "bank_transfer",
    amount_cents: booking.total_cents,
    status: "recorded",
    recorded_by: user.id,
    paid_at: new Date().toISOString(),
  });

  await supabase
    .from("bookings")
    .update({ status: "confirmed", paid_cents: booking.total_cents })
    .eq("id", booking.id);

  await supabase.from("booking_status_history").insert({
    booking_id: booking.id,
    old_status: booking.status,
    new_status: "confirmed",
    actor_id: user.id,
    internal_note: "Payment proof approved",
  });

  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: "payment_proof_approved",
    entity: "payment_proofs",
    entity_id: proofId,
  });

  await sendBookingConfirmedEmail(booking.id, locale);

  return { ok: true };
}

export async function rejectPaymentProof(proofId: string, reason: string): Promise<ProofActionResult> {
  const user = await requireAdminUser();
  assertPermission(user, "approve_payment_proofs");

  if (!reason.trim()) return { ok: false, error: "A rejection reason is required." };

  const supabase = createAdminClient();
  const { data: proof } = await supabase.from("payment_proofs").select("*").eq("id", proofId).maybeSingle();
  if (!proof) return { ok: false, error: "Proof not found." };

  await supabase
    .from("payment_proofs")
    .update({ status: "rejected", reviewer_id: user.id, rejection_reason: reason })
    .eq("id", proofId);

  await supabase.from("booking_status_history").insert({
    booking_id: proof.booking_id,
    old_status: "payment_proof_submitted",
    new_status: "rejected",
    actor_id: user.id,
    internal_note: reason,
  });

  await supabase.from("bookings").update({ status: "rejected" }).eq("id", proof.booking_id);

  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: "payment_proof_rejected",
    entity: "payment_proofs",
    entity_id: proofId,
    diff: { reason },
  });

  return { ok: true };
}
