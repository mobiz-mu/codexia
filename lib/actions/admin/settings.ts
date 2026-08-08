"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminUser } from "@/lib/auth/get-current-admin-user";
import { isEurCentsSetting } from "@/lib/config/eur-cents-settings";

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

  const invalidKeys: string[] = [];
  const updates = (settings ?? []).map((setting) => {
    const raw = formData.get(setting.key);
    let value: unknown;
    if (setting.value_type === "boolean") {
      value = raw === "true";
    } else if (setting.value_type === "number" && isEurCentsSetting(setting.key)) {
      const eur = Number.parseFloat(String(raw ?? ""));
      if (!Number.isFinite(eur) || eur < 0) {
        invalidKeys.push(setting.key);
        value = 0;
      } else {
        value = Math.round(eur * 100);
      }
    } else if (setting.value_type === "number") {
      value = Number(raw ?? 0);
    } else {
      value = String(raw ?? "");
    }
    return { key: setting.key, value };
  });

  if (invalidKeys.length > 0) {
    return { status: "error", error: `Invalid EUR amount for: ${invalidKeys.join(", ")}` };
  }

  const results = await Promise.all(
    updates.map(({ key, value }) =>
      supabase.from("site_settings").update({ value, updated_by: user.id }).eq("key", key),
    ),
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) {
    console.error("updateSettings failed", failed.error.message);
    return { status: "error", error: "Failed to save some settings." };
  }

  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: "settings_updated",
    entity: "site_settings",
    entity_id: null,
    diff: { keys: (settings ?? []).map((s) => s.key) },
  });

  return { status: "success" };
}
