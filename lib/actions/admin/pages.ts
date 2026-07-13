"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminUser } from "@/lib/auth/get-current-admin-user";

function assertPermission(user: { permissions: Set<string> }, permission: string) {
  if (!user.permissions.has(permission)) {
    throw new Error(`Missing required permission: ${permission}`);
  }
}

export async function listPolicyPagesAdmin() {
  const user = await requireAdminUser();
  assertPermission(user, "manage_content");

  const supabase = createAdminClient();
  const { data } = await supabase.from("policy_pages").select("*").order("title_en", { ascending: true });
  return data ?? [];
}

export async function getPolicyPageAdmin(slug: string) {
  const user = await requireAdminUser();
  assertPermission(user, "manage_content");

  const supabase = createAdminClient();
  const { data: page } = await supabase.from("policy_pages").select("*").eq("slug", slug).maybeSingle();
  if (!page) return null;

  const { data: versions } = await supabase
    .from("policy_versions")
    .select("*")
    .eq("policy_page_id", page.id)
    .order("version", { ascending: false });

  return { page, versions: versions ?? [] };
}

const versionSchema = z.object({
  pageId: z.uuid(),
  bodyEn: z.string().trim().min(1).max(20000),
  bodyFr: z.string().trim().min(1).max(20000),
});

export type PolicyVersionFormState = { status: "idle" | "success" | "error"; error?: string };

export async function createPolicyVersion(
  _prev: PolicyVersionFormState,
  formData: FormData
): Promise<PolicyVersionFormState> {
  const user = await requireAdminUser();
  assertPermission(user, "manage_content");

  const parsed = versionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", error: "Please check the form for errors." };

  const supabase = createAdminClient();
  const { data: latest } = await supabase
    .from("policy_versions")
    .select("version")
    .eq("policy_page_id", parsed.data.pageId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = (latest?.version ?? 0) + 1;

  const { error } = await supabase.from("policy_versions").insert({
    policy_page_id: parsed.data.pageId,
    version: nextVersion,
    body_en: parsed.data.bodyEn,
    body_fr: parsed.data.bodyFr,
  });

  if (error) {
    console.error("createPolicyVersion failed", error.message);
    return { status: "error", error: "Failed to publish new version." };
  }

  return { status: "success" };
}
