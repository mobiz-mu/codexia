"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminUser } from "@/lib/auth/get-current-admin-user";

export async function listCustomers() {
  const user = await requireAdminUser();
  if (!user.permissions.has("manage_bookings")) {
    throw new Error("Missing required permission: manage_bookings");
  }

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("booking_customers")
    .select("*, bookings(id, reference, status, total_cents, currency, created_at)")
    .order("created_at", { ascending: false });

  type Row = {
    booking_id: string;
    full_name: string;
    email: string;
    phone: string;
    country: string;
    bookings: { id: string; reference: string; status: string; total_cents: number; currency: string; created_at: string } | null;
  };

  const rows = (data ?? []) as unknown as Row[];

  const byEmail = new Map<
    string,
    {
      fullName: string;
      email: string;
      phone: string;
      country: string;
      bookingCount: number;
      totalCentsByCurrency: Record<string, number>;
      lastBookingAt: string;
      lastReference: string;
    }
  >();

  for (const row of rows) {
    const existing = byEmail.get(row.email);
    const totalCents = row.bookings?.total_cents ?? 0;
    const currency = row.bookings?.currency ?? "EUR";
    const createdAt = row.bookings?.created_at ?? "";

    if (existing) {
      existing.bookingCount += 1;
      existing.totalCentsByCurrency[currency] = (existing.totalCentsByCurrency[currency] ?? 0) + totalCents;
      if (createdAt > existing.lastBookingAt) {
        existing.lastBookingAt = createdAt;
        existing.lastReference = row.bookings?.reference ?? "";
      }
    } else {
      byEmail.set(row.email, {
        fullName: row.full_name,
        email: row.email,
        phone: row.phone,
        country: row.country,
        bookingCount: 1,
        totalCentsByCurrency: { [currency]: totalCents },
        lastBookingAt: createdAt,
        lastReference: row.bookings?.reference ?? "",
      });
    }
  }

  return Array.from(byEmail.values()).sort((a, b) => (a.lastBookingAt < b.lastBookingAt ? 1 : -1));
}
