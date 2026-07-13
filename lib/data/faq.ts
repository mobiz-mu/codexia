import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

type FaqCategoryRow = Database["public"]["Tables"]["faq_categories"]["Row"];
type FaqEntryRow = Database["public"]["Tables"]["faq_entries"]["Row"];

export type FaqCategoryWithEntries = FaqCategoryRow & { faq_entries: FaqEntryRow[] };

export async function getFaqCategoriesWithEntries(): Promise<FaqCategoryWithEntries[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("faq_categories")
    .select("*, faq_entries(*)")
    .order("display_order", { ascending: true });

  if (error) {
    console.error("getFaqCategoriesWithEntries failed", error.message);
    return [];
  }
  return (data ?? []) as unknown as FaqCategoryWithEntries[];
}
