import type { Metadata } from "next";
import Link from "next/link";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminUser } from "@/lib/auth/get-current-admin-user";
import { NewInspectionForm } from "@/components/admin/inspections/NewInspectionForm";
import { OpsPanel } from "@/components/admin/ops/OpsPanel";
import { todayInMauritius } from "@/lib/inspections/schema";
import { SITE_DEFAULTS } from "@/lib/config/site";

export const metadata: Metadata = { title: "New Weekly Inspection" };

export default async function NewInspectionPage({
  searchParams,
}: {
  searchParams: Promise<{ vehicleId?: string }>;
}) {
  const { vehicleId } = await searchParams;
  const user = await requireAdminUser();

  // Vehicle identity for the picker comes from one bounded query.
  const supabase = createAdminClient();
  const { data: vehicles } = await supabase
    .from("vehicles")
    .select("id, name, brand, model, transmission, internal_registration_ref")
    .is("deleted_at", null)
    .order("name", { ascending: true })
    .limit(500);

  return (
    <div className="flex flex-col gap-3">
      <OpsPanel
        title="New weekly inspection"
        subtitle="Mauritius operational week — Monday to Sunday"
        actions={
          <Link
            href="/admin/inspections"
            className="rounded-sm bg-white px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.06em] text-ops-header hover:bg-ops-panel-2"
          >
            Back to list
          </Link>
        }
      >
        <NewInspectionForm
          vehicles={vehicles ?? []}
          today={todayInMauritius()}
          defaultVehicleId={vehicleId}
          defaultCompanyName={SITE_DEFAULTS.companyName}
          inspectorName={user.fullName ?? ""}
        />
      </OpsPanel>
    </div>
  );
}
