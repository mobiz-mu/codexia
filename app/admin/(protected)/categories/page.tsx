import type { Metadata } from "next";
import Link from "next/link";
import { listCategoriesAdmin } from "@/lib/actions/admin/categories";
import { StatusPill } from "@/components/admin/StatusPill";

export const metadata: Metadata = { title: "Categories" };

export default async function AdminCategoriesPage() {
  const categories = await listCategoriesAdmin();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">Categories</h1>
        <Link
          href="/admin/categories/new"
          className="rounded-full bg-action px-4 py-2 text-sm font-semibold text-ink shadow-sm transition-all hover:-translate-y-0.5 hover:bg-action-dark hover:shadow-md"
        >
          Add Category
        </Link>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-background">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-2">Name (EN)</th>
              <th className="px-4 py-2">Name (FR)</th>
              <th className="px-4 py-2">Order</th>
              <th className="px-4 py-2">Active</th>
              <th className="px-4 py-2">Featured</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c.id} className="border-b border-border transition-colors last:border-0 hover:bg-surface">
                <td className="px-4 py-2">
                  <Link href={`/admin/categories/${c.id}`} className="font-medium text-primary-dark hover:underline">
                    {c.name_en}
                  </Link>
                </td>
                <td className="px-4 py-2">{c.name_fr}</td>
                <td className="px-4 py-2">{c.display_order}</td>
                <td className="px-4 py-2">
                  <StatusPill active={c.active} />
                </td>
                <td className="px-4 py-2">
                  <StatusPill active={c.featured} labels={["Featured", "—"]} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
