"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminUser } from "@/lib/auth/get-current-admin-user";

function assertPermission(user: { permissions: Set<string> }, permission: string) {
  if (!user.permissions.has(permission)) {
    throw new Error(`Missing required permission: ${permission}`);
  }
}

export async function listSettingsAdmin() {
  const user = await requireAdminUser();
  assertPermission(user, "manage_settings");

  const supabase = createAdminClient();
  const { data } = await supabase.from("site_settings").select("*").order("key", { ascending: true });
  return data ?? [];
}

export type SettingsFormState = { status: "idle" | "success" | "error"; error?: string };

export async function updateSettings(_prev: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
  const user = await requireAdminUser();
  assertPermission(user, "manage_settings");

  const supabase = createAdminClient();
  const { data: settings } = await supabase.from("site_settings").select("key, value_type");

  const updates = (settings ?? []).map((setting) => {
    const raw = formData.get(setting.key);
    let value: unknown;
    if (setting.value_type === "boolean") {
      value = raw === "true";
    } else if (setting.value_type === "number") {
      value = Number(raw ?? 0);
    } else {
      value = String(raw ?? "");
    }
    return supabase
      .from("site_settings")
      .update({ value, updated_by: user.id })
      .eq("key", setting.key);
  });

  const results = await Promise.all(updates);
  const failed = results.find((r) => r.error);
  if (failed?.error) {
    console.error("updateSettings failed", failed.error.message);
    return { status: "error", error: "Failed to save some settings." };
  }

  return { status: "success" };
}
