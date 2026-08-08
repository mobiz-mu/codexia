import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { listBlocks, listVehicleOptions, getAvailabilityBoardData } from "@/lib/actions/admin/availability";
import { CreateBlockForm } from "@/components/admin/CreateBlockForm";
import { DeleteBlockButton } from "@/components/admin/DeleteBlockButton";
import { AvailabilityBoard, AvailabilityBoardLegend } from "@/components/admin/AvailabilityBoard";

export const metadata: Metadata = { title: "Availability" };

const BOARD_WINDOW_DAYS = 60;

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export default async function AdminAvailabilityPage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string }>;
}) {
  const { start } = await searchParams;
  const windowStart = start && !Number.isNaN(Date.parse(start)) ? start : new Date().toISOString().slice(0, 10);

  const [board, blocks, vehicles] = await Promise.all([
    getAvailabilityBoardData(windowStart, BOARD_WINDOW_DAYS),
    listBlocks(),
    listVehicleOptions(),
  ]);

  const prevStart = addDays(new Date(windowStart), -30).toISOString().slice(0, 10);
  const nextStart = addDays(new Date(windowStart), 30).toISOString().slice(0, 10);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-ink">Availability</h1>
          <div className="flex items-center gap-2">
            <Link
              href={`/admin/availability?start=${prevStart}`}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-ink transition-colors hover:border-primary hover:text-primary-dark"
              aria-label="Previous 30 days"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </Link>
            <span className="text-sm font-medium text-muted">
              {new Date(windowStart).toLocaleDateString("en-GB", { month: "long", day: "numeric", year: "numeric" })}
            </span>
            <Link
              href={`/admin/availability?start=${nextStart}`}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-ink transition-colors hover:border-primary hover:text-primary-dark"
              aria-label="Next 30 days"
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
        <p className="mt-1 text-sm text-muted">
          One row per vehicle, {BOARD_WINDOW_DAYS} days at a time — hover a booking for details, or use the arrows
          to browse further ahead.
        </p>
      </div>

      <AvailabilityBoard
        windowStart={windowStart}
        days={BOARD_WINDOW_DAYS}
        vehicles={board.vehicles}
        bookings={board.bookings}
        blocks={board.blocks}
      />
      <AvailabilityBoardLegend />

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-ink">Maintenance / Internal Blocks</h2>
        <CreateBlockForm vehicles={vehicles} />

        <div className="overflow-x-auto rounded-xl border border-border bg-background shadow-sm">
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
    </div>
  );
}
