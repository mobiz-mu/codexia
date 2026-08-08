import { VehicleCardSkeleton } from "@/components/site/VehicleCard";

export default function FleetLoading() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="h-9 w-56 animate-pulse rounded bg-surface" />
      <div className="mt-3 h-5 w-80 max-w-full animate-pulse rounded bg-surface" />
      <div className="mt-4 h-7 w-full max-w-2xl animate-pulse rounded bg-surface" />
      <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <VehicleCardSkeleton key={i} />
        ))}
      </div>
    </section>
  );
}
