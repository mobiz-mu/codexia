"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminUser } from "@/lib/auth/get-current-admin-user";

function assertPermission(user: { permissions: Set<string> }, permission: string) {
  if (!user.permissions.has(permission)) {
    throw new Error(`Missing required permission: ${permission}`);
  }
}

export async function listBannersAdmin() {
  const user = await requireAdminUser();
  assertPermission(user, "manage_content");
  const supabase = createAdminClient();
  const { data } = await supabase.from("hero_banners").select("*").order("display_order", { ascending: true });
  return data ?? [];
}

export async function getBannerAdmin(id: string) {
  const user = await requireAdminUser();
  assertPermission(user, "manage_content");
  const supabase = createAdminClient();
  const { data } = await supabase.from("hero_banners").select("*").eq("id", id).maybeSingle();
  return data;
}

const bannerSchema = z.object({
  headingEn: z.string().trim().max(200).optional().or(z.literal("")),
  headingFr: z.string().trim().max(200).optional().or(z.literal("")),
  textEn: z.string().trim().max(500).optional().or(z.literal("")),
  textFr: z.string().trim().max(500).optional().or(z.literal("")),
  buttonLabelEn: z.string().trim().max(100).optional().or(z.literal("")),
  buttonLabelFr: z.string().trim().max(100).optional().or(z.literal("")),
  buttonHref: z.string().trim().max(300).optional().or(z.literal("")),
  displayOrder: z.coerce.number().int().min(0),
  active: z.coerce.boolean(),
  scheduleStart: z.string().optional().or(z.literal("")),
  scheduleEnd: z.string().optional().or(z.literal("")),
});

export type BannerFormState = { status: "idle" | "success" | "error"; error?: string };

export async function createBanner(_prev: BannerFormState, formData: FormData): Promise<BannerFormState> {
  const user = await requireAdminUser();
  assertPermission(user, "manage_content");

  const file = formData.get("desktopImage") as File | null;
  if (!file || file.size === 0) return { status: "error", error: "A desktop image is required." };

  const parsed = bannerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", error: "Please check the form for errors." };

  const supabase = createAdminClient();
  const ext = file.name.split(".").pop();
  const path = `${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage.from("banners").upload(path, file, { contentType: file.type });
  if (uploadError) return { status: "error", error: "Image upload failed." };

  const { error } = await supabase.from("hero_banners").insert({
    desktop_image_path: path,
    heading_en: parsed.data.headingEn || null,
    heading_fr: parsed.data.headingFr || null,
    text_en: parsed.data.textEn || null,
    text_fr: parsed.data.textFr || null,
    button_label_en: parsed.data.buttonLabelEn || null,
    button_label_fr: parsed.data.buttonLabelFr || null,
    button_href: parsed.data.buttonHref || null,
    display_order: parsed.data.displayOrder,
    active: parsed.data.active,
    schedule_start: parsed.data.scheduleStart || null,
    schedule_end: parsed.data.scheduleEnd || null,
  });

  if (error) {
    console.error("createBanner failed", error.message);
    return { status: "error", error: "Failed to create banner." };
  }

  return { status: "success" };
}

export async function updateBanner(id: string, _prev: BannerFormState, formData: FormData): Promise<BannerFormState> {
  const user = await requireAdminUser();
  assertPermission(user, "manage_content");

  const parsed = bannerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", error: "Please check the form for errors." };

  const supabase = createAdminClient();

  const file = formData.get("desktopImage") as File | null;
  let imagePath: string | undefined;
  if (file && file.size > 0) {
    const ext = file.name.split(".").pop();
    const path = `${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("banners").upload(path, file, { contentType: file.type });
    if (uploadError) return { status: "error", error: "Image upload failed." };
    imagePath = path;
  }

  const { error } = await supabase
    .from("hero_banners")
    .update({
      ...(imagePath ? { desktop_image_path: imagePath } : {}),
      heading_en: parsed.data.headingEn || null,
      heading_fr: parsed.data.headingFr || null,
      text_en: parsed.data.textEn || null,
      text_fr: parsed.data.textFr || null,
      button_label_en: parsed.data.buttonLabelEn || null,
      button_label_fr: parsed.data.buttonLabelFr || null,
      button_href: parsed.data.buttonHref || null,
      display_order: parsed.data.displayOrder,
      active: parsed.data.active,
      schedule_start: parsed.data.scheduleStart || null,
      schedule_end: parsed.data.scheduleEnd || null,
    })
    .eq("id", id);

  if (error) {
    console.error("updateBanner failed", error.message);
    return { status: "error", error: "Failed to update banner." };
  }

  return { status: "success" };
}
