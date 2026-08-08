import { unstable_cache } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createPublicClient } from "@/lib/supabase/public";
import type { Database } from "@/lib/supabase/types";

type BlogPostRow = Database["public"]["Tables"]["blog_posts"]["Row"];
type BlogCategoryRow = Database["public"]["Tables"]["blog_categories"]["Row"];

export type BlogPostWithCategory = BlogPostRow & { blog_categories: BlogCategoryRow | null };

// Public, admin-managed, rarely-changing content — cached across requests.
export const getPublishedPosts = unstable_cache(
  async (limit?: number): Promise<BlogPostWithCategory[]> => {
    const supabase = createPublicClient();
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
  },
  ["published-posts"],
  { revalidate: 60, tags: ["blog"] }
);

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
