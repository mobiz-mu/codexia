"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  deleteIncidentAttachment,
  getIncidentAttachmentSignedUrl,
  uploadIncidentAttachment,
} from "@/lib/actions/admin/incidents";
import { ATTACHMENT_CATEGORIES, ATTACHMENT_CATEGORY_LABELS, type AttachmentCategory } from "@/lib/incidents/schema";

type Attachment = {
  id: string;
  category: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  storage_path: string;
  created_at: string;
};

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function IncidentAttachmentsPanel({ incidentId, attachments }: { incidentId: string; attachments: Attachment[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleUpload(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await uploadIncidentAttachment(incidentId, formData);
      if (!result.ok) setError(result.error ?? "Failed to upload file.");
      else {
        if (fileInputRef.current) fileInputRef.current.value = "";
        router.refresh();
      }
    });
  }

  function handleView(storagePath: string) {
    setError(null);
    startTransition(async () => {
      const url = await getIncidentAttachmentSignedUrl(storagePath);
      if (url) window.open(url, "_blank", "noopener,noreferrer");
      else setError("Failed to create download link.");
    });
  }

  function handleDelete(attachmentId: string) {
    if (!confirm("Delete this attachment? This cannot be undone.")) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteIncidentAttachment(attachmentId);
      if (!result.ok) setError(result.error ?? "Failed to delete attachment.");
      else router.refresh();
    });
  }

  const grouped = ATTACHMENT_CATEGORIES.map((category) => ({
    category,
    items: attachments.filter((a) => a.category === category),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="flex flex-col gap-4">
      {attachments.length === 0 && <p className="text-sm text-muted">No documents attached yet.</p>}
      {grouped.map(({ category, items }) => (
        <div key={category} className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            {ATTACHMENT_CATEGORY_LABELS[category as AttachmentCategory]}
          </p>
          {items.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium text-ink">{a.file_name}</p>
                <p className="text-xs text-muted">{formatSize(a.size_bytes)}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => handleView(a.storage_path)}
                  className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:border-primary hover:text-primary-dark disabled:pointer-events-none disabled:opacity-60"
                >
                  View
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => handleDelete(a.id)}
                  className="rounded-full border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:pointer-events-none disabled:opacity-60"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      ))}

      <form action={handleUpload} className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <select name="category" required className="rounded-lg border border-border px-3 py-2 text-sm">
          {ATTACHMENT_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {ATTACHMENT_CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
        <input
          ref={fileInputRef}
          type="file"
          name="document"
          accept="application/pdf,image/jpeg,image/png,image/webp"
          required
          className="text-sm"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-action px-4 py-1.5 text-xs font-semibold text-ink shadow-sm transition-all hover:-translate-y-0.5 hover:bg-action-dark hover:shadow-md disabled:pointer-events-none disabled:opacity-60"
        >
          {pending ? "Uploading..." : "Upload"}
        </button>
      </form>
      {error && (
        <p className="text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
