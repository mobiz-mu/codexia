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

export async function listPostsAdmin() {
  const user = await requireAdminUser();
  assertPermission(user, "manage_content");

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("blog_posts")
    .select("*, blog_categories(name_en)")
    .order("created_at", { ascending: false });

  return (data ?? []) as unknown as (Record<string, unknown> & {
    id: string;
    title_en: string;
    status: string;
    publish_at: string | null;
    blog_categories: { name_en: string } | null;
  })[];
}

export async function getPostAdmin(id: string) {
  const user = await requireAdminUser();
  assertPermission(user, "manage_content");

  const supabase = createAdminClient();
  const [{ data: post }, { data: categories }] = await Promise.all([
    supabase.from("blog_posts").select("*").eq("id", id).maybeSingle(),
    supabase.from("blog_categories").select("id, name_en"),
  ]);

  return { post, categories: categories ?? [] };
}

export async function listBlogCategoriesAdmin() {
  await requireAdminUser();
  const supabase = createAdminClient();
  const { data } = await supabase.from("blog_categories").select("id, name_en");
  return data ?? [];
}

const postSchema = z.object({
  titleEn: z.string().trim().min(1).max(200),
  titleFr: z.string().trim().min(1).max(200),
  excerptEn: z.string().trim().max(500).optional().or(z.literal("")),
  excerptFr: z.string().trim().max(500).optional().or(z.literal("")),
  bodyEn: z.string().trim().max(20000).optional().or(z.literal("")),
  bodyFr: z.string().trim().max(20000).optional().or(z.literal("")),
  categoryId: z.uuid().optional().or(z.literal("")),
  status: z.enum(["draft", "scheduled", "published"]),
  publishAt: z.string().optional().or(z.literal("")),
});

export type PostFormState = { status: "idle" | "success" | "error"; error?: string };

export async function createPost(_prev: PostFormState, formData: FormData): Promise<PostFormState> {
  const user = await requireAdminUser();
  assertPermission(user, "manage_content");

  const parsed = postSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", error: "Please check the form for errors." };

  const supabase = createAdminClient();
  const slug = `${slugify(parsed.data.titleEn)}-${Date.now().toString(36)}`;

  const { error } = await supabase.from("blog_posts").insert({
    slug,
    title_en: parsed.data.titleEn,
    title_fr: parsed.data.titleFr,
    excerpt_en: parsed.data.excerptEn || null,
    excerpt_fr: parsed.data.excerptFr || null,
    body_en: parsed.data.bodyEn || null,
    body_fr: parsed.data.bodyFr || null,
    category_id: parsed.data.categoryId || null,
    status: parsed.data.status,
    publish_at: parsed.data.publishAt || null,
    author_id: user.id,
  });

  if (error) {
    console.error("createPost failed", error.message);
    return { status: "error", error: "Failed to create post." };
  }

  return { status: "success" };
}

export async function updatePost(id: string, _prev: PostFormState, formData: FormData): Promise<PostFormState> {
  const user = await requireAdminUser();
  assertPermission(user, "manage_content");

  const parsed = postSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", error: "Please check the form for errors." };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("blog_posts")
    .update({
      title_en: parsed.data.titleEn,
      title_fr: parsed.data.titleFr,
      excerpt_en: parsed.data.excerptEn || null,
      excerpt_fr: parsed.data.excerptFr || null,
      body_en: parsed.data.bodyEn || null,
      body_fr: parsed.data.bodyFr || null,
      category_id: parsed.data.categoryId || null,
      status: parsed.data.status,
      publish_at: parsed.data.publishAt || null,
    })
    .eq("id", id);

  if (error) {
    console.error("updatePost failed", error.message);
    return { status: "error", error: "Failed to update post." };
  }

  return { status: "success" };
}

export async function uploadPostImage(postId: string, formData: FormData) {
  await requireAdminUser();
  const file = formData.get("image") as File | null;
  if (!file || file.size === 0) return { ok: false as const, error: "Please choose an image." };

  const supabase = createAdminClient();
  const ext = file.name.split(".").pop();
  const path = `${postId}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage.from("blog").upload(path, file, { contentType: file.type });
  if (error) return { ok: false as const, error: "Upload failed." };

  await supabase.from("blog_posts").update({ featured_image_path: path }).eq("id", postId);
  return { ok: true as const };
}
