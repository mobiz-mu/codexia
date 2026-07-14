export default function VehicleDetailLoading() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="h-4 w-64 animate-pulse rounded bg-surface" />

      <div className="mt-6 grid grid-cols-1 gap-10 lg:grid-cols-2">
        <div>
          <div className="aspect-[4/3] w-full animate-pulse rounded-xl bg-surface" />
          <div className="mt-3 grid grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="aspect-square animate-pulse rounded-lg bg-surface" />
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div>
            <div className="h-8 w-1/2 animate-pulse rounded bg-surface" />
            <div className="mt-2 h-4 w-1/3 animate-pulse rounded bg-surface" />
          </div>
          <div className="h-8 w-40 animate-pulse rounded bg-surface" />
          <div className="flex gap-3">
            <div className="h-12 flex-1 animate-pulse rounded-full bg-surface" />
            <div className="h-12 flex-1 animate-pulse rounded-full bg-surface" />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-4 animate-pulse rounded bg-surface" />
            ))}
          </div>
          <div className="h-32 animate-pulse rounded-xl bg-surface" />
        </div>
      </div>
    </section>
  );
}
