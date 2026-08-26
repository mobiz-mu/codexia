"use client";

import { useActionState } from "react";
import { sendReadinessTestEmail, type TestEmailState } from "@/lib/actions/admin/settings";
import type { EmailReadiness, ReadinessStatus } from "@/lib/email/readiness";

/**
 * Whether this deployment can actually send email, answered by the
 * deployment itself.
 *
 * Status is never colour alone — each row carries a word as well as a tint,
 * so it survives greyscale and a screen reader.
 */

const STATUS_STYLE: Record<ReadinessStatus, string> = {
  pass: "bg-emerald-50 text-emerald-700 border-emerald-200",
  warn: "bg-amber-50 text-amber-800 border-amber-200",
  fail: "bg-red-50 text-red-700 border-red-200",
};

const STATUS_LABEL: Record<ReadinessStatus, string> = {
  pass: "OK",
  warn: "Check",
  fail: "Blocked",
};

export function EmailReadinessPanel({ readiness }: { readiness: EmailReadiness }) {
  const [state, formAction, pending] = useActionState(sendReadinessTestEmail, {
    status: "idle",
  } as TestEmailState);

  const failing = readiness.checks.filter((c) => c.status === "fail").length;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold text-ink">Email delivery</h2>
        <span
          className={`rounded-md border px-2 py-0.5 text-xs font-semibold ${
            readiness.ready ? STATUS_STYLE.pass : STATUS_STYLE.fail
          }`}
        >
          {readiness.ready ? "Ready to send" : `${failing} blocking issue${failing === 1 ? "" : "s"}`}
        </span>
      </div>

      <p className="text-xs text-muted">
        Checked against the environment this page is running in, not a local file. No credential value is ever shown
        here, and nothing on this panel sends anything until you ask it to.
      </p>

      <ul className="flex flex-col gap-2">
        {readiness.checks.map((check) => (
          <li key={check.key} className="flex flex-col gap-1 rounded-lg border border-border p-3 sm:flex-row sm:gap-3">
            <span
              className={`inline-flex h-fit w-fit shrink-0 rounded-md border px-2 py-0.5 text-xs font-semibold ${
                STATUS_STYLE[check.status]
              }`}
            >
              {STATUS_LABEL[check.status]}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-ink">{check.label}</span>
              <span className="block break-words text-xs text-muted">{check.detail}</span>
            </span>
          </li>
        ))}
      </ul>

      <form action={formAction} className="flex flex-col gap-2 rounded-lg border border-border p-3">
        <label htmlFor="readiness-test-to" className="text-sm font-medium text-ink">
          Send one test email
        </label>
        <p className="text-xs text-muted">
          Goes only to the address you type. Customers are never used as test recipients, and the result is written to
          the email log like any other send.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id="readiness-test-to"
            name="to"
            type="email"
            required
            placeholder="you@example.com"
            className="flex-1 rounded-lg border border-border px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={pending || !readiness.ready}
            className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "Sending…" : "Send test"}
          </button>
        </div>
        {!readiness.ready && (
          <p className="text-xs text-muted">
            Disabled while a check is blocked — a send now would only add another failure to the log.
          </p>
        )}
        {state.status !== "idle" && state.message && (
          <p
            role="status"
            aria-live="polite"
            className={`text-xs font-medium ${state.status === "sent" ? "text-emerald-700" : "text-red-700"}`}
          >
            {state.message}
          </p>
        )}
      </form>
    </section>
  );
}
