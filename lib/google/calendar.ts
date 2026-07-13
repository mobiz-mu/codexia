import "server-only";
import { createSign } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

const GOOGLE_API_TIMEOUT_MS = 10_000;

type ServiceAccount = { client_email: string; private_key: string };

function base64url(input: Buffer | string) {
  return Buffer.from(input).toString("base64url");
}

function getServiceAccount(): ServiceAccount | null {
  const encoded = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64;
  if (!encoded) return null;
  try {
    return JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

async function getAccessToken(account: ServiceAccount): Promise<string> {
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const claim = base64url(
    JSON.stringify({
      iss: account.client_email,
      scope: "https://www.googleapis.com/auth/calendar",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })
  );

  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claim}`);
  signer.end();
  const signature = base64url(signer.sign(account.private_key));
  const assertion = `${header}.${claim}.${signature}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
    signal: AbortSignal.timeout(GOOGLE_API_TIMEOUT_MS),
  });

  if (!res.ok) throw new Error(`Google token exchange failed: ${await res.text()}`);
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

type BookingEventInput = {
  bookingId: string;
  reference: string;
  vehicleName: string;
  customerName: string;
  pickupAt: string;
  returnAt: string;
  pickupLocationName: string;
  dropoffLocationName: string;
};

async function logSync(
  bookingId: string,
  action: "create" | "update" | "delete",
  status: "success" | "failed",
  googleEventId: string | null,
  error?: string
) {
  const supabase = createAdminClient();
  await supabase.from("calendar_sync_log").insert({
    booking_id: bookingId,
    action,
    status,
    google_event_id: googleEventId,
    error: error ?? null,
  });
}

/**
 * Best-effort sync: Google Calendar is not configured in every environment
 * (GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 / GOOGLE_CALENDAR_ID are optional), so
 * failures are logged and swallowed rather than blocking booking mutations.
 */
export async function upsertBookingCalendarEvent(input: BookingEventInput): Promise<void> {
  const account = getServiceAccount();
  const calendarId = process.env.GOOGLE_CALENDAR_ID;
  if (!account || !calendarId) return;

  const supabase = createAdminClient();
  const { data: booking } = await supabase.from("bookings").select("google_event_id").eq("id", input.bookingId).single();
  const existingEventId = booking?.google_event_id ?? null;

  const event = {
    summary: `${input.reference} — ${input.vehicleName}`,
    description: `Customer: ${input.customerName}\nPickup: ${input.pickupLocationName}\nDrop-off: ${input.dropoffLocationName}`,
    start: { dateTime: input.pickupAt, timeZone: "Indian/Mauritius" },
    end: { dateTime: input.returnAt, timeZone: "Indian/Mauritius" },
  };

  try {
    const accessToken = await getAccessToken(account);
    const url = existingEventId
      ? `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${existingEventId}`
      : `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;

    const res = await fetch(url, {
      method: existingEventId ? "PATCH" : "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(event),
      signal: AbortSignal.timeout(GOOGLE_API_TIMEOUT_MS),
    });

    if (!res.ok) throw new Error(await res.text());
    const data = (await res.json()) as { id: string };

    if (!existingEventId) {
      await supabase.from("bookings").update({ google_event_id: data.id }).eq("id", input.bookingId);
    }

    await logSync(input.bookingId, existingEventId ? "update" : "create", "success", data.id);
  } catch (err) {
    await logSync(
      input.bookingId,
      existingEventId ? "update" : "create",
      "failed",
      existingEventId,
      err instanceof Error ? err.message : "Unknown error"
    );
  }
}

export async function deleteBookingCalendarEvent(bookingId: string): Promise<void> {
  const account = getServiceAccount();
  const calendarId = process.env.GOOGLE_CALENDAR_ID;
  if (!account || !calendarId) return;

  const supabase = createAdminClient();
  const { data: booking } = await supabase.from("bookings").select("google_event_id").eq("id", bookingId).single();
  if (!booking?.google_event_id) return;

  try {
    const accessToken = await getAccessToken(account);
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${booking.google_event_id}`,
      { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(GOOGLE_API_TIMEOUT_MS) }
    );

    if (!res.ok && res.status !== 410) throw new Error(await res.text());

    await supabase.from("bookings").update({ google_event_id: null }).eq("id", bookingId);
    await logSync(bookingId, "delete", "success", booking.google_event_id);
  } catch (err) {
    await logSync(bookingId, "delete", "failed", booking.google_event_id, err instanceof Error ? err.message : "Unknown error");
  }
}
