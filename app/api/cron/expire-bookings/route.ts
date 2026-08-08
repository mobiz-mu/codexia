import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const EXPIRY_HOURS = 24;

/**
 * Releases abandoned unpaid bookings so they stop occupying an
 * availability-board slot indefinitely. Only "pending" bookings age out —
 * anything further along (awaiting_payment, confirmed, etc.) needs a human
 * decision, not an automatic cancellation.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const cutoff = new Date(Date.now() - EXPIRY_HOURS * 60 * 60 * 1000).toISOString();

  const { data: candidates, error } = await supabase
    .from("bookings")
    .select("id, status")
    .eq("status", "pending")
    .is("deleted_at", null)
    .lt("created_at", cutoff);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!candidates || candidates.length === 0) {
    return NextResponse.json({ expired: 0 });
  }

  let expired = 0;
  for (const booking of candidates) {
    const { error: updateError } = await supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", booking.id)
      .eq("status", "pending");
    if (updateError) continue;

    await supabase.from("booking_status_history").insert({
      booking_id: booking.id,
      old_status: booking.status,
      new_status: "cancelled",
      customer_note: `Automatically cancelled — no payment received within ${EXPIRY_HOURS} hours.`,
    });
    expired += 1;
  }

  return NextResponse.json({ expired, checked: candidates.length });
}
