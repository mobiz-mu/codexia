import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendReviewRequestEmail } from "@/lib/email/review-request";

const DELAY_HOURS = 24;

/**
 * Sends the post-rental review request exactly once, DELAY_HOURS after a
 * booking reaches "completed" (an admin-driven transition — this route
 * never changes booking status itself, only decides when to email about
 * one that already changed). Dedup mirrors reminder_logs: insert the log
 * row first, then send, so a concurrent run can't double-send.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const cutoff = new Date(Date.now() - DELAY_HOURS * 60 * 60 * 1000).toISOString();

  const { data: completions, error } = await supabase
    .from("booking_status_history")
    .select("booking_id")
    .eq("new_status", "completed")
    .lte("at", cutoff);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const candidateIds = [...new Set((completions ?? []).map((c) => c.booking_id))];
  if (candidateIds.length === 0) {
    return NextResponse.json({ sent: 0, skipped: 0 });
  }

  const { data: alreadySent } = await supabase
    .from("review_request_logs")
    .select("booking_id")
    .in("booking_id", candidateIds);
  const alreadySentIds = new Set((alreadySent ?? []).map((r) => r.booking_id));
  const pendingIds = candidateIds.filter((id) => !alreadySentIds.has(id));

  let sent = 0;
  for (const bookingId of pendingIds) {
    const { error: insertError } = await supabase
      .from("review_request_logs")
      .insert({ booking_id: bookingId });
    if (insertError) continue;

    const { data: booking } = await supabase
      .from("bookings")
      .select("status")
      .eq("id", bookingId)
      .maybeSingle();
    if (booking?.status !== "completed") continue;

    await sendReviewRequestEmail(bookingId, "en");
    sent += 1;
  }

  return NextResponse.json({ sent, skipped: candidateIds.length - pendingIds.length });
}
