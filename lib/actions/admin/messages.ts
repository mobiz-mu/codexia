"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminUser } from "@/lib/auth/get-current-admin-user";

function assertPermission(user: { permissions: Set<string> }, permission: string) {
  if (!user.permissions.has(permission)) {
    throw new Error(`Missing required permission: ${permission}`);
  }
}

const PAGE_SIZE = 20;

const LIST_COLUMNS = "id, name, email, phone, subject, message, status, created_at";

export type ContactMessageRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  subject: string | null;
  message: string;
  status: "new" | "read" | "replied" | "archived";
  created_at: string;
};

export async function listContactMessages(rawFilters: { status?: string; page?: string } = {}) {
  const user = await requireAdminUser();
  assertPermission(user, "manage_content");

  const page = Math.max(1, Number.parseInt(rawFilters.page ?? "1", 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = createAdminClient();
  let query = supabase
    .from("contact_messages")
    .select(LIST_COLUMNS, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (rawFilters.status) {
    query = query.eq("status", rawFilters.status as ContactMessageRow["status"]);
  }

  const { data, error, count } = await query;
  if (error) {
    console.error("listContactMessages failed", error.message);
    return { messages: [] as ContactMessageRow[], total: 0, page, pageSize: PAGE_SIZE };
  }

  return { messages: (data ?? []) as unknown as ContactMessageRow[], total: count ?? 0, page, pageSize: PAGE_SIZE };
}

export async function updateContactMessageStatus(id: string, status: "read" | "replied" | "archived") {
  const user = await requireAdminUser();
  assertPermission(user, "manage_content");

  const supabase = createAdminClient();
  await supabase.from("contact_messages").update({ status }).eq("id", id);
  return { ok: true as const };
}
