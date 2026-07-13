"use client";

import { useState, useTransition } from "react";
import { resendBookingEmail } from "@/lib/actions/admin/bookings";

export function ResendEmailButtons({ bookingId }: { bookingId: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function resend(type: "received" | "confirmed") {
    setMessage(null);
    startTransition(async () => {
      const result = await resendBookingEmail(bookingId, type);
      setMessage(result.ok ? "Email sent." : result.error);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => resend("received")}
          className="rounded-full border border-border px-4 py-2 text-sm font-medium text-ink disabled:opacity-60"
        >
          Resend Email 1 (Received)
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => resend("confirmed")}
          className="rounded-full border border-border px-4 py-2 text-sm font-medium text-ink disabled:opacity-60"
        >
          Resend Email 2 (Confirmed)
        </button>
      </div>
      {message && <p className="text-sm text-muted">{message}</p>}
    </div>
  );
}
