"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminUser } from "@/lib/auth/get-current-admin-user";

function assertPermission(user: { permissions: Set<string> }, permission: string) {
  if (!user.permissions.has(permission)) {
    throw new Error(`Missing required permission: ${permission}`);
  }
}

export async function listNewsletterSubscribers() {
  const user = await requireAdminUser();
  assertPermission(user, "manage_content");

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("newsletter_subscribers")
    .select("*")
    .order("created_at", { ascending: false });

  return data ?? [];
}

export async function unsubscribeNewsletterSubscriber(id: string) {
  const user = await requireAdminUser();
  assertPermission(user, "manage_content");

  const supabase = createAdminClient();
  await supabase.from("newsletter_subscribers").update({ status: "unsubscribed" }).eq("id", id);
  return { ok: true as const };
}
