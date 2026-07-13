import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminUser } from "@/lib/auth/get-current-admin-user";
import { createVehicle } from "@/lib/actions/admin/vehicles";
import { VehicleForm } from "@/components/admin/VehicleForm";

export const metadata: Metadata = { title: "Add Vehicle" };

export default async function NewVehiclePage() {
  await requireAdminUser();
  const supabase = createAdminClient();
  const { data: categories } = await supabase.from("vehicle_categories").select("id, name_en").order("display_order");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-ink">Add Vehicle</h1>
      <div className="max-w-2xl rounded-xl border border-border bg-background p-6">
        <VehicleForm action={createVehicle} categories={categories ?? []} submitLabel="Create Vehicle" />
      </div>
    </div>
  );
}
