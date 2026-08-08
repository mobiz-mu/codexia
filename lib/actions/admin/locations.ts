"use server";

import { z } from "zod";
import { updateTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminUser } from "@/lib/auth/get-current-admin-user";

function assertPermission(user: { permissions: Set<string> }, permission: string) {
  if (!user.permissions.has(permission)) {
    throw new Error(`Missing required permission: ${permission}`);
  }
}

export async function listLocationsAdmin() {
  const user = await requireAdminUser();
  assertPermission(user, "manage_content");

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("locations")
    .select("id, name_en, delivery_fee_cents, delivery_fee_currency, active, display_order")
    .order("display_order", { ascending: true });

  return data ?? [];
}

export async function getLocationAdmin(id: string) {
  const user = await requireAdminUser();
  assertPermission(user, "manage_content");

  const supabase = createAdminClient();
  const { data } = await supabase.from("locations").select("*").eq("id", id).maybeSingle();
  return data;
}

const locationSchema = z.object({
  nameEn: z.string().trim().min(1).max(100),
  nameFr: z.string().trim().min(1).max(100),
  deliveryFeeCents: z.coerce.number().int().min(0),
  displayOrder: z.coerce.number().int().min(0),
  active: z.coerce.boolean().default(false),
  // Explicit, one-way confirmation gate for migrating a legacy MUR delivery
  // fee to EUR — never a currency picker, and never trusted from any other
  // submitted field. Only present (and only ever true) on the edit form for
  // a location whose delivery_fee_currency isn't EUR yet.
  confirmEurRepricing: z.coerce.boolean().default(false),
});

export type LocationFormState = { status: "idle" | "success" | "error"; error?: string };

export async function updateLocation(
  id: string,
  _prev: LocationFormState,
  formData: FormData
): Promise<LocationFormState> {
  const user = await requireAdminUser();
  assertPermission(user, "manage_content");

  const parsed = locationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", error: "Please check the form for errors." };

  const supabase = createAdminClient();

  // delivery_fee_currency is never taken from the submitted form — only
  // ever set here when the admin explicitly checked the repricing
  // confirmation box, so a tampered/replayed request can't silently change
  // (or preserve the wrong) currency for this row.
  const currencyUpdate = parsed.data.confirmEurRepricing ? { delivery_fee_currency: "EUR" as const } : {};

  const { error } = await supabase
    .from("locations")
    .update({
      name_en: parsed.data.nameEn,
      name_fr: parsed.data.nameFr,
      delivery_fee_cents: parsed.data.deliveryFeeCents,
      display_order: parsed.data.displayOrder,
      active: parsed.data.active,
      ...currencyUpdate,
    })
    .eq("id", id);

  if (error) {
    console.error("updateLocation failed", error.message);
    return { status: "error", error: "Failed to update location." };
  }

  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: "location_updated",
    entity: "locations",
    entity_id: id,
  });

  updateTag("locations");

  return { status: "success" };
}
