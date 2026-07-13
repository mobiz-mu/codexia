"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminUser } from "@/lib/auth/get-current-admin-user";

function assertPermission(user: { permissions: Set<string> }, permission: string) {
  if (!user.permissions.has(permission)) {
    throw new Error(`Missing required permission: ${permission}`);
  }
}

export async function listEmailTemplateOverrides() {
  const user = await requireAdminUser();
  assertPermission(user, "manage_content");

  const supabase = createAdminClient();
  const { data } = await supabase.from("email_templates").select("*");
  return data ?? [];
}

const templateSchema = z.object({
  key: z.string().min(1),
  locale: z.enum(["en", "fr"]),
  subject: z.string().trim().min(1).max(300),
  body: z.string().trim().min(1).max(20000),
});

export type TemplateFormState = { status: "idle" | "success" | "error"; error?: string };

export async function saveEmailTemplate(_prev: TemplateFormState, formData: FormData): Promise<TemplateFormState> {
  const user = await requireAdminUser();
  assertPermission(user, "manage_content");

  const parsed = templateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", error: "Please check the form for errors." };

  const supabase = createAdminClient();
  const { error } = await supabase.from("email_templates").upsert(
    {
      key: parsed.data.key,
      locale: parsed.data.locale,
      subject: parsed.data.subject,
      body: parsed.data.body,
      updated_by: user.id,
    },
    { onConflict: "key,locale" }
  );

  if (error) {
    console.error("saveEmailTemplate failed", error.message);
    return { status: "error", error: "Failed to save template." };
  }

  return { status: "success" };
}

export async function deleteEmailTemplateOverride(key: string, locale: "en" | "fr") {
  await requireAdminUser();
  const supabase = createAdminClient();
  await supabase.from("email_templates").delete().eq("key", key).eq("locale", locale);
  return { ok: true as const };
}
