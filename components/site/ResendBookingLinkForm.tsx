"use client";

import { useActionState } from "react";
import { resendBookingLink, type ResendLinkState } from "@/lib/actions/my-booking";

const initialState: ResendLinkState = { status: "idle" };

export function ResendBookingLinkForm({
  labels,
}: {
  labels: { emailLabel: string; submit: string; sent: string };
}) {
  const [state, formAction, pending] = useActionState(resendBookingLink, initialState);

  if (state.status === "sent") {
    return (
      <p className="rounded-lg bg-surface p-4 text-sm text-ink" role="status">
        {labels.sent}
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3 sm:flex-row">
      <label htmlFor="resend-email" className="sr-only">
        {labels.emailLabel}
      </label>
      <input
        id="resend-email"
        name="email"
        type="email"
        required
        placeholder={labels.emailLabel}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-ink transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
      />
      <button
        type="submit"
        disabled={pending}
        className="shrink-0 rounded-full bg-action px-6 py-2 text-sm font-semibold text-ink shadow-sm transition-all hover:-translate-y-0.5 hover:bg-action-dark hover:shadow-md disabled:pointer-events-none disabled:opacity-60"
      >
        {labels.submit}
      </button>
    </form>
  );
}
