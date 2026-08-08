"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminUser } from "@/lib/auth/get-current-admin-user";

function assertPermission(user: { permissions: Set<string> }, permission: string) {
  if (!user.permissions.has(permission)) {
    throw new Error(`Missing required permission: ${permission}`);
  }
}

export async function listFaqAdmin() {
  const user = await requireAdminUser();
  assertPermission(user, "manage_content");

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("faq_categories")
    .select(
      "id, name_en, faq_entries(id, question_en, question_fr, answer_en, answer_fr, active, display_order)"
    )
    .order("display_order", { ascending: true });

  return (data ?? []) as unknown as {
    id: string;
    name_en: string;
    faq_entries: {
      id: string;
      question_en: string;
      question_fr: string;
      answer_en: string;
      answer_fr: string;
      active: boolean;
      display_order: number;
    }[];
  }[];
}

const entrySchema = z.object({
  categoryId: z.uuid(),
  questionEn: z.string().trim().min(1).max(300),
  questionFr: z.string().trim().min(1).max(300),
  answerEn: z.string().trim().min(1).max(2000),
  answerFr: z.string().trim().min(1).max(2000),
});

export type FaqFormState = { status: "idle" | "success" | "error"; error?: string };

export async function createFaqEntry(_prev: FaqFormState, formData: FormData): Promise<FaqFormState> {
  const user = await requireAdminUser();
  assertPermission(user, "manage_content");

  const parsed = entrySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", error: "Please check the form for errors." };

  const supabase = createAdminClient();
  const { error } = await supabase.from("faq_entries").insert({
    category_id: parsed.data.categoryId,
    question_en: parsed.data.questionEn,
    question_fr: parsed.data.questionFr,
    answer_en: parsed.data.answerEn,
    answer_fr: parsed.data.answerFr,
  });

  if (error) return { status: "error", error: "Failed to create FAQ entry." };
  return { status: "success" };
}

export async function toggleFaqEntryActive(id: string, active: boolean) {
  await requireAdminUser();
  const supabase = createAdminClient();
  await supabase.from("faq_entries").update({ active }).eq("id", id);
  return { ok: true as const };
}

export async function deleteFaqEntry(id: string) {
  await requireAdminUser();
  const supabase = createAdminClient();
  await supabase.from("faq_entries").delete().eq("id", id);
  return { ok: true as const };
}
