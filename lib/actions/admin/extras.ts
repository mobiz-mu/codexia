"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminUser } from "@/lib/auth/get-current-admin-user";

function assertPermission(user: { permissions: Set<string> }, permission: string) {
  if (!user.permissions.has(permission)) {
    throw new Error(`Missing required permission: ${permission}`);
  }
}

export async function listExtrasAdmin() {
  const user = await requireAdminUser();
  assertPermission(user, "manage_vehicles");

  const supabase = createAdminClient();
  const { data } = await supabase.from("extras").select("*").order("display_order", { ascending: true });
  return data ?? [];
}

export async function getExtraAdmin(id: string) {
  const user = await requireAdminUser();
  assertPermission(user, "manage_vehicles");

  const supabase = createAdminClient();
  const { data } = await supabase.from("extras").select("*").eq("id", id).maybeSingle();
  return data;
}

const extraSchema = z.object({
  nameEn: z.string().trim().min(1).max(100),
  nameFr: z.string().trim().min(1).max(100),
  priceCents: z.coerce.number().int().min(0),
  pricingMode: z.enum(["per_day", "flat"]),
  displayOrder: z.coerce.number().int().min(0),
  // Unchecked checkboxes are omitted from FormData entirely, not sent as
  // "false" — .default(false) covers the key being absent.
  active: z.coerce.boolean().default(false),
  // Explicit, one-way confirmation gate for migrating a legacy MUR extra to
  // EUR — never a currency picker. Only present (and only ever true) on the
  // edit form for an extra that isn't EUR-priced yet.
  confirmEurRepricing: z.coerce.boolean().default(false),
});

export type ExtraFormState = { status: "idle" | "success" | "error"; error?: string };

export async function createExtra(_prev: ExtraFormState, formData: FormData): Promise<ExtraFormState> {
  const user = await requireAdminUser();
  assertPermission(user, "manage_vehicles");

  const parsed = extraSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", error: "Please check the form for errors." };

  const supabase = createAdminClient();
  const { error } = await supabase.from("extras").insert({
    name_en: parsed.data.nameEn,
    name_fr: parsed.data.nameFr,
    price_cents: parsed.data.priceCents,
    currency: "EUR",
    pricing_mode: parsed.data.pricingMode,
    display_order: parsed.data.displayOrder,
    active: parsed.data.active,
  });

  if (error) {
    console.error("createExtra failed", error.message);
    return { status: "error", error: "Failed to create extra." };
  }

  return { status: "success" };
}

export async function updateExtra(id: string, _prev: ExtraFormState, formData: FormData): Promise<ExtraFormState> {
  const user = await requireAdminUser();
  assertPermission(user, "manage_vehicles");

  const parsed = extraSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", error: "Please check the form for errors." };

  const supabase = createAdminClient();

  // currency is never taken from the submitted form — only ever set here
  // when the admin explicitly checked the repricing-confirmation box, so a
  // tampered/replayed request can't silently flip (or preserve the wrong)
  // currency for this row.
  const currencyUpdate = parsed.data.confirmEurRepricing ? { currency: "EUR" as const } : {};

  const { error } = await supabase
    .from("extras")
    .update({
      name_en: parsed.data.nameEn,
      name_fr: parsed.data.nameFr,
      price_cents: parsed.data.priceCents,
      pricing_mode: parsed.data.pricingMode,
      display_order: parsed.data.displayOrder,
      active: parsed.data.active,
      ...currencyUpdate,
    })
    .eq("id", id);

  if (error) {
    console.error("updateExtra failed", error.message);
    return { status: "error", error: "Failed to update extra." };
  }

  return { status: "success" };
}

export async function deleteExtra(id: string) {
  const user = await requireAdminUser();
  assertPermission(user, "manage_vehicles");

  const supabase = createAdminClient();
  await supabase.from("extras").delete().eq("id", id);
  return { ok: true as const };
}
