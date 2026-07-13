import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCategoryAdmin, updateCategory } from "@/lib/actions/admin/categories";
import { CategoryForm } from "@/components/admin/CategoryForm";

export const metadata: Metadata = { title: "Edit Category" };

export default async function EditCategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const category = await getCategoryAdmin(id);
  if (!category) notFound();

  const boundUpdate = updateCategory.bind(null, id);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-ink">{category.name_en}</h1>
      <div className="max-w-xl rounded-xl border border-border bg-background p-6">
        <CategoryForm action={boundUpdate} initial={category} submitLabel="Save Changes" />
      </div>
    </div>
  );
}
