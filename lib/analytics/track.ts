import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export async function trackVehicleView(vehicleId: string, locale: string) {
  const supabase = createAdminClient();
  await supabase.from("analytics_events").insert({ event: "vehicle_view", vehicle_id: vehicleId, locale });
}
