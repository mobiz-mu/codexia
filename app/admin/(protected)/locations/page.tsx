import type { Metadata } from "next";
import Link from "next/link";
import { listLocationsAdmin } from "@/lib/actions/admin/locations";
import { formatMoney } from "@/lib/pricing/format";
import { StatusPill } from "@/components/admin/StatusPill";

export const metadata: Metadata = { title: "Locations" };

export default async function AdminLocationsPage() {
  const locations = await listLocationsAdmin();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Locations</h1>
        <p className="text-sm text-muted">Pickup/drop-off points and their delivery fees.</p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-background">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Delivery Fee</th>
              <th className="px-4 py-2">Currency</th>
              <th className="px-4 py-2">Order</th>
              <th className="px-4 py-2">Active</th>
            </tr>
          </thead>
          <tbody>
            {locations.map((l) => (
              <tr key={l.id} className="border-b border-border transition-colors last:border-0 hover:bg-surface">
                <td className="px-4 py-2">
                  <Link href={`/admin/locations/${l.id}`} className="font-medium text-primary-dark hover:underline">
                    {l.name_en}
                  </Link>
                </td>
                <td className="px-4 py-2 font-medium text-action-dark">
                  {formatMoney(l.delivery_fee_cents, l.delivery_fee_currency, "en")}
                </td>
                <td className="px-4 py-2">
                  {l.delivery_fee_currency === "EUR" ? (
                    <span className="rounded-full bg-action-tint px-2.5 py-1 text-xs font-semibold text-action-dark">
                      EUR
                    </span>
                  ) : (
                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                      {l.delivery_fee_currency} — legacy
                    </span>
                  )}
                </td>
                <td className="px-4 py-2">{l.display_order}</td>
                <td className="px-4 py-2">
                  <StatusPill active={l.active} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
