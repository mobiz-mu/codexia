"use client";

import { useActionState } from "react";
import Image from "next/image";
import type { BannerFormState } from "@/lib/actions/admin/banners";
import { publicStorageUrl } from "@/lib/supabase/storage";

export function BannerForm({
  action,
  initial,
  submitLabel,
}: {
  action: (prev: BannerFormState, formData: FormData) => Promise<BannerFormState>;
  initial?: {
    heading_en?: string | null;
    heading_fr?: string | null;
    text_en?: string | null;
    text_fr?: string | null;
    button_label_en?: string | null;
    button_label_fr?: string | null;
    button_href?: string | null;
    display_order?: number;
    active?: boolean;
    schedule_start?: string | null;
    schedule_end?: string | null;
    desktop_image_path?: string | null;
  };
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, { status: "idle" } as BannerFormState);
  const url = publicStorageUrl("banners", initial?.desktop_image_path);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {url && (
        <div className="relative aspect-[21/9] w-full overflow-hidden rounded-lg bg-surface">
          <Image src={url} alt="Banner" fill className="object-cover" />
        </div>
      )}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-ink">Desktop Image {initial ? "(replace)" : ""}</label>
        <input type="file" name="desktopImage" accept="image/*" required={!initial} className="text-sm" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-ink">Heading (EN)</label>
          <input
            type="text"
            name="headingEn"
            defaultValue={initial?.heading_en ?? undefined}
            className="rounded-lg border border-border px-3 py-2 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-ink">Heading (FR)</label>
          <input
            type="text"
            name="headingFr"
            defaultValue={initial?.heading_fr ?? undefined}
            className="rounded-lg border border-border px-3 py-2 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-ink">Text (EN)</label>
          <input
            type="text"
            name="textEn"
            defaultValue={initial?.text_en ?? undefined}
            className="rounded-lg border border-border px-3 py-2 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-ink">Text (FR)</label>
          <input
            type="text"
            name="textFr"
            defaultValue={initial?.text_fr ?? undefined}
            className="rounded-lg border border-border px-3 py-2 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-ink">Button Label (EN)</label>
          <input
            type="text"
            name="buttonLabelEn"
            defaultValue={initial?.button_label_en ?? undefined}
            className="rounded-lg border border-border px-3 py-2 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-ink">Button Label (FR)</label>
          <input
            type="text"
            name="buttonLabelFr"
            defaultValue={initial?.button_label_fr ?? undefined}
            className="rounded-lg border border-border px-3 py-2 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-ink">Button Link</label>
          <input
            type="text"
            name="buttonHref"
            defaultValue={initial?.button_href ?? undefined}
            placeholder="/en/book"
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
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-ink">Schedule Start</label>
          <input
            type="datetime-local"
            name="scheduleStart"
            defaultValue={initial?.schedule_start ? initial.schedule_start.slice(0, 16) : undefined}
            className="rounded-lg border border-border px-3 py-2 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-ink">Schedule End</label>
          <input
            type="datetime-local"
            name="scheduleEnd"
            defaultValue={initial?.schedule_end ? initial.schedule_end.slice(0, 16) : undefined}
            className="rounded-lg border border-border px-3 py-2 text-sm"
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-ink">
        <input type="checkbox" name="active" defaultChecked={initial?.active ?? true} value="true" />
        Active
      </label>

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
