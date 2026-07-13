import type { Metadata } from "next";
import { createCategory } from "@/lib/actions/admin/categories";
import { CategoryForm } from "@/components/admin/CategoryForm";

export const metadata: Metadata = { title: "Add Category" };

export default function NewCategoryPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-ink">Add Category</h1>
      <div className="max-w-xl rounded-xl border border-border bg-background p-6">
        <CategoryForm action={createCategory} submitLabel="Create Category" />
      </div>
    </div>
  );
}
