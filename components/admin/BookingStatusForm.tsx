"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateBookingStatus } from "@/lib/actions/admin/bookings";
import { BOOKING_STATUS_TRANSITIONS, BOOKING_STATUS_LABELS, type BookingStatus } from "@/lib/booking/status-machine";

export function BookingStatusForm({ bookingId, currentStatus }: { bookingId: string; currentStatus: BookingStatus }) {
  const router = useRouter();
  const [newStatus, setNewStatus] = useState<BookingStatus | "">("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const options = BOOKING_STATUS_TRANSITIONS[currentStatus] ?? [];

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newStatus) return;
    setError(null);
    startTransition(async () => {
      const result = await updateBookingStatus(bookingId, newStatus, note);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setNewStatus("");
      setNote("");
      router.refresh();
    });
  }

  if (options.length === 0) {
    return <p className="text-sm text-muted">No further transitions available from this status.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <select
        value={newStatus}
        onChange={(e) => setNewStatus(e.target.value as BookingStatus)}
        className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-ink transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
      >
        <option value="">Change status to...</option>
        {options.map((status) => (
          <option key={status} value={status}>
            {BOOKING_STATUS_LABELS[status]}
          </option>
        ))}
      </select>
      <textarea
        placeholder="Internal note (optional)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-ink transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
      />
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert" aria-live="assertive">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={!newStatus || pending}
        className="self-start rounded-full bg-action px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-action-dark hover:shadow-md disabled:pointer-events-none disabled:translate-y-0 disabled:opacity-60 disabled:shadow-none"
      >
        {pending ? "Updating..." : "Update Status"}
      </button>
    </form>
  );
}
