import type { Metadata } from "next";
import { listFaqAdmin } from "@/lib/actions/admin/faq";
import { CreateFaqEntryForm } from "@/components/admin/CreateFaqEntryForm";
import { FaqEntryRowActions } from "@/components/admin/FaqEntryRowActions";

export const metadata: Metadata = { title: "FAQ" };

export default async function AdminFaqPage() {
  const categories = await listFaqAdmin();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-ink">FAQ</h1>

      <CreateFaqEntryForm categories={categories.map((c) => ({ id: c.id, name_en: c.name_en }))} />

      {categories.map((category) => (
        <div key={category.id}>
          <h2 className="mb-2 text-lg font-semibold text-ink">{category.name_en}</h2>
          <div className="flex flex-col gap-2">
            {category.faq_entries.map((entry) => (
              <div key={entry.id} className="rounded-lg border border-border bg-background p-3">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-ink">{entry.question_en}</p>
                  <span className="text-xs text-muted">{entry.active ? "Active" : "Inactive"}</span>
                </div>
                <p className="mt-1 text-sm text-muted">{entry.answer_en}</p>
                <div className="mt-2">
                  <FaqEntryRowActions entryId={entry.id} active={entry.active} />
                </div>
              </div>
            ))}
            {category.faq_entries.length === 0 && <p className="text-sm text-muted">No entries yet.</p>}
          </div>
        </div>
      ))}
    </div>
  );
}
