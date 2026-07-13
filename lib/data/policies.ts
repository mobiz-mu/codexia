import { createClient } from "@/lib/supabase/server";

export async function getPolicyPages() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("policy_pages").select("*");

  if (error) {
    console.error("getPolicyPages failed", error.message);
    return [];
  }
  return data;
}

export async function getPolicyBySlug(slug: string) {
  const supabase = await createClient();
  const { data: page, error: pageError } = await supabase
    .from("policy_pages")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (pageError || !page) {
    if (pageError) console.error("getPolicyBySlug failed", pageError.message);
    return null;
  }

  const { data: version, error: versionError } = await supabase
    .from("policy_versions")
    .select("*")
    .eq("policy_page_id", page.id)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (versionError) {
    console.error("getPolicyBySlug version lookup failed", versionError.message);
    return null;
  }

  return { page, version };
}
