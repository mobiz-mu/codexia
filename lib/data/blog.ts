import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

type BlogPostRow = Database["public"]["Tables"]["blog_posts"]["Row"];
type BlogCategoryRow = Database["public"]["Tables"]["blog_categories"]["Row"];

export type BlogPostWithCategory = BlogPostRow & { blog_categories: BlogCategoryRow | null };

export async function getPublishedPosts(limit?: number): Promise<BlogPostWithCategory[]> {
  const supabase = await createClient();
  let query = supabase
    .from("blog_posts")
    .select("*, blog_categories(*)")
    .order("publish_at", { ascending: false });

  if (limit) query = query.limit(limit);

  const { data, error } = await query;

  if (error) {
    console.error("getPublishedPosts failed", error.message);
    return [];
  }
  return (data ?? []) as unknown as BlogPostWithCategory[];
}

export async function getPostBySlug(slug: string): Promise<BlogPostWithCategory | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("blog_posts")
    .select("*, blog_categories(*)")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    console.error("getPostBySlug failed", error.message);
    return null;
  }
  return data as unknown as BlogPostWithCategory | null;
}
