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
        className="w-full rounded-lg border border-border px-3 py-2 text-sm"
      />
      <button
        type="submit"
        disabled={pending}
        className="shrink-0 rounded-full bg-primary px-6 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-60"
      >
        {labels.submit}
      </button>
    </form>
  );
}
