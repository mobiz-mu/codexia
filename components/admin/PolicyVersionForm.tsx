"use client";

import { useActionState } from "react";
import { createPolicyVersion, type PolicyVersionFormState } from "@/lib/actions/admin/pages";

export function PolicyVersionForm({
  pageId,
  latestBodyEn,
  latestBodyFr,
}: {
  pageId: string;
  latestBodyEn?: string;
  latestBodyFr?: string;
}) {
  const [state, formAction, pending] = useActionState(createPolicyVersion, { status: "idle" } as PolicyVersionFormState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="pageId" value={pageId} />
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-ink">Body (EN) — Markdown-lite (## headings, - lists)</label>
        <textarea
          name="bodyEn"
          defaultValue={latestBodyEn}
          rows={10}
          required
          className="rounded-lg border border-border px-3 py-2 font-mono text-xs"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-ink">Body (FR)</label>
        <textarea
          name="bodyFr"
          defaultValue={latestBodyFr}
          rows={10}
          required
          className="rounded-lg border border-border px-3 py-2 font-mono text-xs"
        />
      </div>
      {state.status === "error" && (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}
      {state.status === "success" && <p className="text-sm text-green-700">New version published.</p>}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-full bg-action px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Publishing..." : "Publish New Version"}
      </button>
    </form>
  );
}
