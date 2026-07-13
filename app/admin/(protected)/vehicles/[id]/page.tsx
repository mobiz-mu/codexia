import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getVehicleAdmin, updateVehicle } from "@/lib/actions/admin/vehicles";
import { VehicleForm } from "@/components/admin/VehicleForm";
import { VehicleImageManager } from "@/components/admin/VehicleImageManager";

export const metadata: Metadata = { title: "Edit Vehicle" };

export default async function EditVehiclePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { vehicle, images, categories } = await getVehicleAdmin(id);
  if (!vehicle) notFound();

  const boundUpdate = updateVehicle.bind(null, id);

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-bold text-ink">{vehicle.name}</h1>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-background p-6">
          <h2 className="mb-4 font-semibold text-ink">Details</h2>
          <VehicleForm action={boundUpdate} categories={categories} initial={vehicle} submitLabel="Save Changes" />
        </div>

        <div className="rounded-xl border border-border bg-background p-6">
          <h2 className="mb-4 font-semibold text-ink">Images</h2>
          <VehicleImageManager vehicleId={id} images={images} />
        </div>
      </div>
    </div>
  );
}
