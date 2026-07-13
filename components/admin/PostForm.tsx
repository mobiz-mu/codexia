"use client";

import { useActionState } from "react";
import type { PostFormState } from "@/lib/actions/admin/blog";

export function PostForm({
  action,
  categories,
  initial,
  submitLabel,
}: {
  action: (prev: PostFormState, formData: FormData) => Promise<PostFormState>;
  categories: { id: string; name_en: string }[];
  initial?: Partial<{
    title_en: string | null;
    title_fr: string | null;
    excerpt_en: string | null;
    excerpt_fr: string | null;
    body_en: string | null;
    body_fr: string | null;
    category_id: string | null;
    status: string;
    publish_at: string | null;
  }>;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, { status: "idle" } as PostFormState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-ink">Title (EN)</label>
          <input
            type="text"
            name="titleEn"
            defaultValue={initial?.title_en ?? undefined}
            required
            className="rounded-lg border border-border px-3 py-2 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-ink">Title (FR)</label>
          <input
            type="text"
            name="titleFr"
            defaultValue={initial?.title_fr ?? undefined}
            required
            className="rounded-lg border border-border px-3 py-2 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-ink">Category</label>
          <select
            name="categoryId"
            defaultValue={initial?.category_id ?? ""}
            className="rounded-lg border border-border px-3 py-2 text-sm"
          >
            <option value="">—</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name_en}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-ink">Status</label>
          <select
            name="status"
            defaultValue={initial?.status ?? "draft"}
            className="rounded-lg border border-border px-3 py-2 text-sm"
          >
            <option value="draft">Draft</option>
            <option value="scheduled">Scheduled</option>
            <option value="published">Published</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-ink">Publish At</label>
          <input
            type="datetime-local"
            name="publishAt"
            defaultValue={initial?.publish_at ? initial.publish_at.slice(0, 16) : undefined}
            className="rounded-lg border border-border px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-ink">Excerpt (EN)</label>
        <textarea
          name="excerptEn"
          defaultValue={initial?.excerpt_en ?? undefined}
          rows={2}
          className="rounded-lg border border-border px-3 py-2 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-ink">Excerpt (FR)</label>
        <textarea
          name="excerptFr"
          defaultValue={initial?.excerpt_fr ?? undefined}
          rows={2}
          className="rounded-lg border border-border px-3 py-2 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-ink">Body (EN)</label>
        <textarea
          name="bodyEn"
          defaultValue={initial?.body_en ?? undefined}
          rows={8}
          className="rounded-lg border border-border px-3 py-2 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-ink">Body (FR)</label>
        <textarea
          name="bodyFr"
          defaultValue={initial?.body_fr ?? undefined}
          rows={8}
          className="rounded-lg border border-border px-3 py-2 text-sm"
        />
      </div>

      {state.status === "error" && (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}
      {state.status === "success" && <p className="text-sm text-green-700">Saved.</p>}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Saving..." : submitLabel}
      </button>
    </form>
  );
}
