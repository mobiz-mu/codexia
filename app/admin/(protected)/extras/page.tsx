import type { Metadata } from "next";
import Link from "next/link";
import { listExtrasAdmin } from "@/lib/actions/admin/extras";
import { formatMoney } from "@/lib/pricing/format";
import { StatusPill } from "@/components/admin/StatusPill";

export const metadata: Metadata = { title: "Extras" };

export default async function AdminExtrasPage() {
  const extras = await listExtrasAdmin();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">Extras</h1>
        <Link
          href="/admin/extras/new"
          className="rounded-full bg-action px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-action-dark hover:shadow-md"
        >
          Add Extra
        </Link>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-background">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-2">Name (EN)</th>
              <th className="px-4 py-2">Name (FR)</th>
              <th className="px-4 py-2">Price</th>
              <th className="px-4 py-2">Mode</th>
              <th className="px-4 py-2">Order</th>
              <th className="px-4 py-2">Active</th>
            </tr>
          </thead>
          <tbody>
            {extras.map((e) => (
              <tr key={e.id} className="border-b border-border transition-colors last:border-0 hover:bg-surface">
                <td className="px-4 py-2">
                  <Link href={`/admin/extras/${e.id}`} className="font-medium text-primary-dark hover:underline">
                    {e.name_en}
                  </Link>
                </td>
                <td className="px-4 py-2">{e.name_fr}</td>
                <td className="px-4 py-2 font-medium text-action-dark">{formatMoney(e.price_cents, e.currency, "en")}</td>
                <td className="px-4 py-2 capitalize">{e.pricing_mode.replace("_", " ")}</td>
                <td className="px-4 py-2">{e.display_order}</td>
                <td className="px-4 py-2">
                  <StatusPill active={e.active} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
