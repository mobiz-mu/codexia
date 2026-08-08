import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import type { Database } from "@/lib/supabase/types";

type FaqCategoryRow = Database["public"]["Tables"]["faq_categories"]["Row"];
type FaqEntryRow = Database["public"]["Tables"]["faq_entries"]["Row"];

export type FaqCategoryWithEntries = FaqCategoryRow & { faq_entries: FaqEntryRow[] };

// Public, admin-managed, rarely-changing content — cached across requests.
export const getFaqCategoriesWithEntries = unstable_cache(
  async (): Promise<FaqCategoryWithEntries[]> => {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("faq_categories")
      .select("*, faq_entries(*)")
      .order("display_order", { ascending: true });

    if (error) {
      console.error("getFaqCategoriesWithEntries failed", error.message);
      return [];
    }
    return (data ?? []) as unknown as FaqCategoryWithEntries[];
  },
  ["faq-categories"],
  { revalidate: 60, tags: ["faq"] }
);
