"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { saveEmailTemplate, deleteEmailTemplateOverride, type TemplateFormState } from "@/lib/actions/admin/email-templates";

export function EmailTemplateEditor({
  templateKey,
  label,
  variables,
  locale,
  existing,
}: {
  templateKey: string;
  label: string;
  variables: readonly string[];
  locale: "en" | "fr";
  existing?: { subject: string; body: string };
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(saveEmailTemplate, { status: "idle" } as TemplateFormState);
  const [deleting, setDeleting] = useState(false);

  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-semibold text-ink">
          {label} <span className="text-xs uppercase text-muted">({locale})</span>
        </h3>
        {existing && (
          <button
            type="button"
            disabled={deleting}
            onClick={() => {
              setDeleting(true);
              deleteEmailTemplateOverride(templateKey, locale).then(() => {
                setDeleting(false);
                router.refresh();
              });
            }}
            className="text-xs text-red-600 disabled:opacity-60"
          >
            Revert to default
          </button>
        )}
      </div>
      <p className="mb-2 text-xs text-muted">
        Variables: {variables.map((v) => `{{${v}}}`).join(", ")}
      </p>
      <form action={formAction} className="flex flex-col gap-2">
        <input type="hidden" name="key" value={templateKey} />
        <input type="hidden" name="locale" value={locale} />
        <input
          type="text"
          name="subject"
          defaultValue={existing?.subject}
          placeholder={existing ? undefined : "Using shipped default — enter a subject to override"}
          required
          className="rounded-lg border border-border px-3 py-2 text-sm"
        />
        <textarea
          name="body"
          defaultValue={existing?.body}
          placeholder={existing ? undefined : "Using shipped default — enter a body to override"}
          rows={4}
          required
          className="rounded-lg border border-border px-3 py-2 text-sm"
        />
        {state.status === "error" && (
          <p className="text-sm text-red-600" role="alert">
            {state.error}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="self-start rounded-full bg-action px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {pending ? "Saving..." : "Save Override"}
        </button>
      </form>
    </div>
  );
}
