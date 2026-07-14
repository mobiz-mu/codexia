import type { Metadata } from "next";
import Link from "next/link";
import { listBannersAdmin } from "@/lib/actions/admin/banners";

export const metadata: Metadata = { title: "Hero Banners" };

export default async function AdminBannersPage() {
  const banners = await listBannersAdmin();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">Hero Banners</h1>
        <Link href="/admin/banners/new" className="rounded-full bg-action px-4 py-2 text-sm font-semibold text-white">
          Add Banner
        </Link>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-background">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-2">Heading</th>
              <th className="px-4 py-2">Order</th>
              <th className="px-4 py-2">Active</th>
            </tr>
          </thead>
          <tbody>
            {banners.map((b) => (
              <tr key={b.id} className="border-b border-border last:border-0">
                <td className="px-4 py-2">
                  <Link href={`/admin/banners/${b.id}`} className="font-medium text-action-dark">
                    {b.heading_en ?? "(no heading)"}
                  </Link>
                </td>
                <td className="px-4 py-2">{b.display_order}</td>
                <td className="px-4 py-2">{b.active ? "Yes" : "No"}</td>
              </tr>
            ))}
            {banners.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-muted">
                  No banners yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
