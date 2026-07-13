"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminUser } from "@/lib/auth/get-current-admin-user";

function assertPermission(user: { permissions: Set<string> }, permission: string) {
  if (!user.permissions.has(permission)) {
    throw new Error(`Missing required permission: ${permission}`);
  }
}

export async function listContactMessages() {
  const user = await requireAdminUser();
  assertPermission(user, "manage_content");

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("contact_messages")
    .select("*")
    .order("created_at", { ascending: false });

  return data ?? [];
}

export async function updateContactMessageStatus(id: string, status: "read" | "replied" | "archived") {
  const user = await requireAdminUser();
  assertPermission(user, "manage_content");

  const supabase = createAdminClient();
  await supabase.from("contact_messages").update({ status }).eq("id", id);
  return { ok: true as const };
}
