import type { Metadata } from "next";
import Link from "next/link";
import { listVehiclesAdmin } from "@/lib/actions/admin/vehicles";
import { formatMoney } from "@/lib/pricing/format";
import { VehicleRowActions } from "@/components/admin/VehicleRowActions";

export const metadata: Metadata = { title: "Vehicles" };

export default async function AdminVehiclesPage() {
  const vehicles = await listVehiclesAdmin();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">Vehicles</h1>
        <Link href="/admin/vehicles/new" className="rounded-full bg-action px-4 py-2 text-sm font-semibold text-white">
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
              <tr key={v.id} className="border-b border-border last:border-0">
                <td className="px-4 py-2">
                  <Link href={`/admin/vehicles/${v.id}`} className="font-medium text-action-dark">
                    {v.name}
                  </Link>
                </td>
                <td className="px-4 py-2">{v.vehicle_categories?.name_en ?? "—"}</td>
                <td className="px-4 py-2">{formatMoney(v.daily_price_cents, v.currency, "en")}</td>
                <td className="px-4 py-2 capitalize">{v.status}</td>
                <td className="px-4 py-2">{v.is_demo ? "Yes" : "No"}</td>
                <td className="px-4 py-2">
                  <VehicleRowActions vehicleId={v.id} />
                </td>
              </tr>
            ))}
            {vehicles.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted">
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
