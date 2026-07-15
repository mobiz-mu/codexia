import type { Metadata } from "next";
import Link from "next/link";
import { listPolicyPagesAdmin } from "@/lib/actions/admin/pages";

export const metadata: Metadata = { title: "Pages" };

export default async function AdminPagesListPage() {
  const pages = await listPolicyPagesAdmin();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-ink">Policy Pages</h1>
      <div className="overflow-x-auto rounded-xl border border-border bg-background">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-2">Title</th>
              <th className="px-4 py-2">Slug</th>
            </tr>
          </thead>
          <tbody>
            {pages.map((p) => (
              <tr key={p.id} className="border-b border-border transition-colors last:border-0 hover:bg-surface">
                <td className="px-4 py-2">
                  <Link href={`/admin/pages/${p.slug}`} className="font-medium text-primary-dark hover:underline">
                    {p.title_en}
                  </Link>
                </td>
                <td className="px-4 py-2 text-muted">{p.slug}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
