import type { Metadata } from "next";
import { listBlocks, listVehicleOptions } from "@/lib/actions/admin/availability";
import { CreateBlockForm } from "@/components/admin/CreateBlockForm";
import { DeleteBlockButton } from "@/components/admin/DeleteBlockButton";

export const metadata: Metadata = { title: "Availability" };

export default async function AdminAvailabilityPage() {
  const [blocks, vehicles] = await Promise.all([listBlocks(), listVehicleOptions()]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-ink">Availability Blocks</h1>
      <CreateBlockForm vehicles={vehicles} />

      <div className="overflow-x-auto rounded-xl border border-border bg-background">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-2">Vehicle</th>
              <th className="px-4 py-2">Type</th>
              <th className="px-4 py-2">Period</th>
              <th className="px-4 py-2">Note</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {blocks.map((b) => (
              <tr key={b.id} className="border-b border-border last:border-0">
                <td className="px-4 py-2">{b.vehicles?.name ?? "—"}</td>
                <td className="px-4 py-2 capitalize">{b.type}</td>
                <td className="px-4 py-2 text-xs">{b.period}</td>
                <td className="px-4 py-2">{b.note ?? "—"}</td>
                <td className="px-4 py-2">
                  <DeleteBlockButton blockId={b.id} />
                </td>
              </tr>
            ))}
            {blocks.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted">
                  No blocks yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
