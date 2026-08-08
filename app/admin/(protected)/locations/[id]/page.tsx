import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocationAdmin, updateLocation } from "@/lib/actions/admin/locations";
import { LocationForm } from "@/components/admin/LocationForm";

export const metadata: Metadata = { title: "Edit Location" };

export default async function EditLocationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const location = await getLocationAdmin(id);
  if (!location) notFound();

  const boundUpdate = updateLocation.bind(null, id);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-ink">{location.name_en}</h1>
      <div className="max-w-xl rounded-xl border border-border bg-background p-6">
        <LocationForm action={boundUpdate} initial={location} submitLabel="Save Changes" />
      </div>
    </div>
  );
}
