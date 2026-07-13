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
        className="rounded-lg border border-border px-3 py-2 text-sm"
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
        className="rounded-lg border border-border px-3 py-2 text-sm"
      />
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={!newStatus || pending}
        className="self-start rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Updating..." : "Update Status"}
      </button>
    </form>
  );
}
