"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminUser } from "@/lib/auth/get-current-admin-user";

function assertPermission(user: { permissions: Set<string> }, permission: string) {
  if (!user.permissions.has(permission)) {
    throw new Error(`Missing required permission: ${permission}`);
  }
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function listCategoriesAdmin() {
  const user = await requireAdminUser();
  assertPermission(user, "manage_vehicles");

  const supabase = createAdminClient();
  const { data } = await supabase.from("vehicle_categories").select("*").order("display_order", { ascending: true });
  return data ?? [];
}

export async function getCategoryAdmin(id: string) {
  const user = await requireAdminUser();
  assertPermission(user, "manage_vehicles");

  const supabase = createAdminClient();
  const { data } = await supabase.from("vehicle_categories").select("*").eq("id", id).maybeSingle();
  return data;
}

const categorySchema = z.object({
  nameEn: z.string().trim().min(1).max(100),
  nameFr: z.string().trim().min(1).max(100),
  descriptionEn: z.string().trim().max(1000).optional().or(z.literal("")),
  descriptionFr: z.string().trim().max(1000).optional().or(z.literal("")),
  displayOrder: z.coerce.number().int().min(0),
  active: z.coerce.boolean(),
  featured: z.coerce.boolean(),
});

export type CategoryFormState = { status: "idle" | "success" | "error"; error?: string };

export async function createCategory(_prev: CategoryFormState, formData: FormData): Promise<CategoryFormState> {
  const user = await requireAdminUser();
  assertPermission(user, "manage_vehicles");

  const parsed = categorySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", error: "Please check the form for errors." };

  const supabase = createAdminClient();
  const slug = `${slugify(parsed.data.nameEn)}-${Date.now().toString(36)}`;

  const { error } = await supabase.from("vehicle_categories").insert({
    slug,
    name_en: parsed.data.nameEn,
    name_fr: parsed.data.nameFr,
    description_en: parsed.data.descriptionEn || null,
    description_fr: parsed.data.descriptionFr || null,
    display_order: parsed.data.displayOrder,
    active: parsed.data.active,
    featured: parsed.data.featured,
  });

  if (error) {
    console.error("createCategory failed", error.message);
    return { status: "error", error: "Failed to create category." };
  }

  return { status: "success" };
}

export async function updateCategory(
  id: string,
  _prev: CategoryFormState,
  formData: FormData
): Promise<CategoryFormState> {
  const user = await requireAdminUser();
  assertPermission(user, "manage_vehicles");

  const parsed = categorySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", error: "Please check the form for errors." };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("vehicle_categories")
    .update({
      name_en: parsed.data.nameEn,
      name_fr: parsed.data.nameFr,
      description_en: parsed.data.descriptionEn || null,
      description_fr: parsed.data.descriptionFr || null,
      display_order: parsed.data.displayOrder,
      active: parsed.data.active,
      featured: parsed.data.featured,
    })
    .eq("id", id);

  if (error) {
    console.error("updateCategory failed", error.message);
    return { status: "error", error: "Failed to update category." };
  }

  return { status: "success" };
}
