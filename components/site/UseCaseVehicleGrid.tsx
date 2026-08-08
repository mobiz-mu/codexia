import { VehicleCard } from "@/components/site/VehicleCard";
import { Link } from "@/i18n/navigation";
import type { VehicleWithImages } from "@/lib/data/vehicles";

export function UseCaseVehicleGrid({
  vehicles,
  locale,
  emptyLabel,
  viewFleetLabel,
}: {
  vehicles: VehicleWithImages[];
  locale: string;
  emptyLabel: string;
  viewFleetLabel: string;
}) {
  return (
    <div className="mt-12">
      {vehicles.length === 0 ? (
        <p className="rounded-xl border border-border bg-surface p-6 text-sm text-muted">
          {emptyLabel}{" "}
          <Link href="/fleet" className="font-medium text-primary-dark hover:underline">
            {viewFleetLabel}
          </Link>
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {vehicles.map((vehicle, index) => (
            <VehicleCard key={vehicle.id} vehicle={vehicle} locale={locale} priority={index === 0} />
          ))}
        </div>
      )}
    </div>
  );
}
