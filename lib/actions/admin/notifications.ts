"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminUser } from "@/lib/auth/get-current-admin-user";

export async function listNotifications() {
  await requireAdminUser();
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("notifications")
    .select("*")
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(100);

  return data ?? [];
}

export async function markNotificationRead(id: string) {
  await requireAdminUser();
  const supabase = createAdminClient();
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
  return { ok: true as const };
}

export async function archiveNotification(id: string) {
  await requireAdminUser();
  const supabase = createAdminClient();
  await supabase.from("notifications").update({ archived_at: new Date().toISOString() }).eq("id", id);
  return { ok: true as const };
}
