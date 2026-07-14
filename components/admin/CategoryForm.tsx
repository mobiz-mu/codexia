"use client";

import { useActionState } from "react";
import type { CategoryFormState } from "@/lib/actions/admin/categories";

export function CategoryForm({
  action,
  initial,
  submitLabel,
}: {
  action: (prev: CategoryFormState, formData: FormData) => Promise<CategoryFormState>;
  initial?: {
    name_en?: string | null;
    name_fr?: string | null;
    description_en?: string | null;
    description_fr?: string | null;
    display_order?: number;
    active?: boolean;
    featured?: boolean;
  };
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, { status: "idle" } as CategoryFormState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-ink">Name (EN)</label>
          <input
            type="text"
            name="nameEn"
            defaultValue={initial?.name_en ?? undefined}
            required
            className="rounded-lg border border-border px-3 py-2 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-ink">Name (FR)</label>
          <input
            type="text"
            name="nameFr"
            defaultValue={initial?.name_fr ?? undefined}
            required
            className="rounded-lg border border-border px-3 py-2 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-ink">Display Order</label>
          <input
            type="number"
            name="displayOrder"
            defaultValue={initial?.display_order ?? 0}
            className="rounded-lg border border-border px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="flex gap-4">
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" name="active" defaultChecked={initial?.active ?? true} value="true" />
          Active
        </label>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" name="featured" defaultChecked={initial?.featured ?? false} value="true" />
          Featured
        </label>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-ink">Description (EN)</label>
        <textarea
          name="descriptionEn"
          defaultValue={initial?.description_en ?? undefined}
          rows={2}
          className="rounded-lg border border-border px-3 py-2 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-ink">Description (FR)</label>
        <textarea
          name="descriptionFr"
          defaultValue={initial?.description_fr ?? undefined}
          rows={2}
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
        className="self-start rounded-full bg-action px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Saving..." : submitLabel}
      </button>
    </form>
  );
}
