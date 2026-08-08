"use client";

import { useActionState } from "react";
import { useLocale } from "next-intl";
import { subscribeToNewsletter, type NewsletterFormState } from "@/lib/actions/newsletter";

const initialState: NewsletterFormState = { status: "idle" };

export function NewsletterForm({
  labels,
  variant = "dark",
}: {
  labels: { heading: string; placeholder: string; submit: string; success: string; error: string };
  variant?: "dark" | "light";
}) {
  const locale = useLocale();
  const [state, formAction, pending] = useActionState(subscribeToNewsletter, initialState);
  const isDark = variant === "dark";

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="locale" value={locale} />
      <label
        htmlFor="newsletter-email"
        className={`text-sm font-semibold ${isDark ? "text-white/60" : "text-muted"}`}
      >
        {labels.heading}
      </label>
      <div className="flex gap-2">
        <input
          id="newsletter-email"
          name="email"
          type="email"
          required
          placeholder={labels.placeholder}
          className={
            isDark
              ? "w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-primary"
              : "w-full rounded-lg border border-border px-3 py-2 text-sm text-ink focus:border-primary"
          }
        />
        <button
          type="submit"
          disabled={pending}
          className="shrink-0 rounded-lg bg-action px-4 py-2 text-sm font-semibold text-ink hover:bg-action-dark disabled:opacity-60"
        >
          {labels.submit}
        </button>
      </div>
      {state.status === "success" && (
        <p className={`text-xs ${isDark ? "text-white/70" : "text-muted"}`} role="status">
          {labels.success}
        </p>
      )}
      {state.status === "error" && (
        <p className="text-xs text-red-400" role="alert">
          {labels.error}
        </p>
      )}
    </form>
  );
}
