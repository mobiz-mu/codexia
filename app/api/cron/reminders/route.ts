import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendBookingReminderEmail } from "@/lib/email/booking-reminder";

const REMINDER_ELIGIBLE_STATUSES = [
  "confirmed",
  "partially_paid",
  "paid",
  "vehicle_assigned",
  "ready_for_pickup",
] as const;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const now = new Date();
  const sevenDaysOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const { data: candidates, error } = await supabase
    .from("bookings")
    .select("id")
    .in("status", REMINDER_ELIGIBLE_STATUSES)
    .is("deleted_at", null)
    .gte("pickup_at", now.toISOString())
    .lte("pickup_at", sevenDaysOut.toISOString());

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!candidates || candidates.length === 0) {
    return NextResponse.json({ sent: 0, skipped: 0 });
  }

  const { data: alreadyReminded } = await supabase
    .from("reminder_logs")
    .select("booking_id")
    .eq("reminder_type", "seven_day")
    .in(
      "booking_id",
      candidates.map((c) => c.id)
    );

  const alreadyRemindedIds = new Set((alreadyReminded ?? []).map((r) => r.booking_id));
  const pending = candidates.filter((c) => !alreadyRemindedIds.has(c.id));

  let sent = 0;
  for (const booking of pending) {
    // The unique (booking_id, reminder_type) constraint is the real
    // dedup guarantee; insert first so a concurrent run can't double-send.
    const { error: insertError } = await supabase
      .from("reminder_logs")
      .insert({ booking_id: booking.id, reminder_type: "seven_day" });

    if (insertError) continue;

    await sendBookingReminderEmail(booking.id, "en");
    sent += 1;
  }

  return NextResponse.json({ sent, skipped: candidates.length - pending.length });
}
