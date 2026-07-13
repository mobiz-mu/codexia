import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/utils/rate-limit";

const ALLOWED_EVENTS = new Set(["pageview", "vehicle_view", "book_now_click", "booking_submitted"]);

export async function POST(request: NextRequest) {
  const rateLimit = await checkRateLimit("analytics_ingest", { limit: 60, windowMs: 60 * 1000 });
  if (!rateLimit.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let body: { event?: string; path?: string; vehicleId?: string; locale?: string; referrer?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.event || !ALLOWED_EVENTS.has(body.event)) {
    return NextResponse.json({ error: "Unknown event" }, { status: 400 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const userAgent = request.headers.get("user-agent") ?? "";
  // Salted daily hash instead of storing the IP, to approximate unique
  // sessions without persisting anything personally identifying.
  const dayBucket = new Date().toISOString().slice(0, 10);
  const sessionHash = createHash("sha256").update(`${ip}:${userAgent}:${dayBucket}`).digest("hex").slice(0, 32);

  const device = /mobile/i.test(userAgent) ? "mobile" : "desktop";
  const browserMatch = userAgent.match(/(Chrome|Firefox|Safari|Edg)\//);

  const supabase = createAdminClient();
  const { error } = await supabase.from("analytics_events").insert({
    event: body.event,
    path: body.path?.slice(0, 500) ?? null,
    vehicle_id: body.vehicleId ?? null,
    session_hash: sessionHash,
    device,
    browser: browserMatch?.[1] ?? null,
    locale: body.locale ?? null,
    referrer: body.referrer?.slice(0, 500) ?? null,
  });

  if (error) {
    return NextResponse.json({ error: "Failed to record event" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
