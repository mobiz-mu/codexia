import type { Metadata } from "next";
import Link from "next/link";
import { listVehiclesAdmin } from "@/lib/actions/admin/vehicles";
import { formatMoney } from "@/lib/pricing/format";
import { VehicleRowActions } from "@/components/admin/VehicleRowActions";
import { StatusPill } from "@/components/admin/StatusPill";

export const metadata: Metadata = { title: "Vehicles" };

export default async function AdminVehiclesPage() {
  const vehicles = await listVehiclesAdmin();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">Vehicles</h1>
        <Link
          href="/admin/vehicles/new"
          className="rounded-full bg-action px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-action-dark hover:shadow-md"
        >
          Add Vehicle
        </Link>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-background">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Category</th>
              <th className="px-4 py-2">Price / day</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Demo</th>
              <th className="px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {vehicles.map((v) => (
              <tr key={v.id} className="border-b border-border transition-colors last:border-0 hover:bg-surface">
                <td className="px-4 py-2">
                  <Link href={`/admin/vehicles/${v.id}`} className="font-medium text-primary-dark hover:underline">
                    {v.name}
                  </Link>
                </td>
                <td className="px-4 py-2">{v.vehicle_categories?.name_en ?? "—"}</td>
                <td className="px-4 py-2 font-medium text-action-dark">
                  {formatMoney(v.daily_price_cents, v.currency, "en")}
                </td>
                <td className="px-4 py-2">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${
                      v.status === "active" ? "bg-action-tint text-action-dark" : "bg-surface text-muted"
                    }`}
                  >
                    {v.status}
                  </span>
                </td>
                <td className="px-4 py-2">
                  <StatusPill active={v.is_demo} />
                </td>
                <td className="px-4 py-2">
                  <VehicleRowActions vehicleId={v.id} />
                </td>
              </tr>
            ))}
            {vehicles.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted">
                  No vehicles yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
