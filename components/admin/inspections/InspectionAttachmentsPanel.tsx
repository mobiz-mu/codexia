"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  deleteInspectionAttachment,
  getInspectionAttachmentSignedUrl,
  uploadInspectionAttachment,
} from "@/lib/actions/admin/inspections";
import { getChecklistItem } from "@/lib/fleet/inspection-checklist";

/**
 * Inspection evidence: tyre damage, a windscreen crack, a dashboard warning
 * light, proof that equipment is present.
 *
 * Files live in a private bucket and are opened through a short-lived signed
 * URL — nothing here ever exposes a public link. A photo may optionally be
 * pinned to the checklist item it evidences.
 */

export type InspectionAttachment = {
  id: string;
  inspection_item_id: string | null;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  storage_path: string;
  created_at: string;
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function InspectionAttachmentsPanel({
  inspectionId,
  attachments,
  items,
  editable,
}: {
  inspectionId: string;
  attachments: InspectionAttachment[];
  items: { id: string; item_key: string }[];
  editable: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const itemLabel = (itemId: string | null) => {
    if (!itemId) return "Whole inspection";
    const item = items.find((i) => i.id === itemId);
    if (!item) return "Checklist item";
    return getChecklistItem(item.item_key)?.label ?? item.item_key;
  };

  async function open(storagePath: string) {
    setError(null);
    const res = await getInspectionAttachmentSignedUrl(storagePath);
    if (!res.ok) {
      setError(res.error ?? "Could not open that file.");
      return;
    }
    window.open(res.url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="flex flex-col gap-2">
      {attachments.length === 0 ? (
        <p className="text-[12px] text-ops-ink-3">No evidence attached yet.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {attachments.map((attachment) => (
            <li
              key={attachment.id}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-ops-line/60 pb-1 last:border-b-0 last:pb-0"
            >
              <span className="min-w-0">
                <span className="block truncate text-[12px] font-semibold text-ops-ink">{attachment.file_name}</span>
                <span className="block text-[11px] text-ops-ink-3">
                  {itemLabel(attachment.inspection_item_id)} · {formatSize(attachment.size_bytes)}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => open(attachment.storage_path)}
                  className="rounded-sm border border-ops-line px-1.5 py-0.5 text-[11px] font-semibold text-ops-ink-2 hover:border-ops-accent hover:text-ops-header"
                >
                  View
                </button>
                {editable ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      if (!confirm(`Delete ${attachment.file_name}? This cannot be undone.`)) return;
                      setError(null);
                      start(async () => {
                        const res = await deleteInspectionAttachment(attachment.id);
                        if (!res.ok) setError(res.error ?? "Failed to delete the attachment.");
                        router.refresh();
                      });
                    }}
                    className="rounded-sm border border-ops-line px-1.5 py-0.5 text-[11px] font-semibold text-ops-danger hover:border-ops-danger hover:bg-ops-danger hover:text-white disabled:opacity-50"
                  >
                    Delete
                  </button>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}

      {editable ? (
        <form
          action={(fd) => {
            setError(null);
            start(async () => {
              const res = await uploadInspectionAttachment(inspectionId, fd);
              if (!res.ok) setError(res.error ?? "Failed to upload the file.");
              router.refresh();
            });
          }}
          className="flex flex-col gap-1.5 border-t border-ops-line pt-2"
        >
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-ops-ink-2">Attach to</span>
            <select
              name="inspectionItemId"
              defaultValue=""
              className="rounded-sm border border-ops-line bg-white px-2 py-1 text-[12px] text-ops-ink outline-none focus:border-ops-accent"
            >
              <option value="">Whole inspection</option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {getChecklistItem(item.item_key)?.label ?? item.item_key}
                </option>
              ))}
            </select>
          </label>
          <input
            type="file"
            name="document"
            required
            accept="application/pdf,image/jpeg,image/png,image/webp"
            className="text-[12px] text-ops-ink-2 file:mr-2 file:rounded-sm file:border file:border-ops-line file:bg-ops-panel-2 file:px-2 file:py-0.5 file:text-[11px] file:font-semibold"
          />
          <p className="text-[10px] text-ops-ink-3">PDF, JPEG, PNG or WebP · up to 15 MB · stored privately</p>
          <button
            type="submit"
            disabled={pending}
            className="self-start rounded-sm bg-ops-header px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.06em] text-white hover:bg-ops-header-2 disabled:opacity-50"
          >
            {pending ? "Uploading…" : "Upload"}
          </button>
        </form>
      ) : null}

      {error ? (
        <p role="alert" className="text-[12px] font-medium text-ops-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
