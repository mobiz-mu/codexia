"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  deleteMaintenanceAttachment,
  getMaintenanceAttachmentSignedUrl,
  uploadMaintenanceAttachment,
} from "@/lib/actions/admin/maintenance";

type Attachment = {
  id: string;
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

export function MaintenanceAttachmentsPanel({
  recordId,
  attachments,
}: {
  recordId: string;
  attachments: Attachment[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleUpload(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await uploadMaintenanceAttachment(recordId, formData);
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
      const url = await getMaintenanceAttachmentSignedUrl(storagePath);
      if (url) window.open(url, "_blank", "noopener,noreferrer");
      else setError("Failed to create download link.");
    });
  }

  function handleDelete(attachmentId: string) {
    if (!confirm("Delete this attachment? This cannot be undone.")) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteMaintenanceAttachment(attachmentId);
      if (!result.ok) setError(result.error ?? "Failed to delete attachment.");
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {attachments.length === 0 && <p className="text-[13px] text-ops-ink-3">No documents attached yet.</p>}
      {attachments.map((a) => (
        <div
          key={a.id}
          className="flex items-center justify-between gap-2 rounded-sm border border-ops-line bg-ops-panel-2 px-2 py-1.5 text-[13px]"
        >
          <div className="min-w-0">
            <p className="truncate font-semibold text-ops-ink">{a.file_name}</p>
            <p className="text-[11px] text-ops-ink-3">{formatSize(a.size_bytes)}</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => handleView(a.storage_path)}
              className="rounded-sm border border-ops-line px-1.5 py-0.5 text-[11px] font-semibold text-ops-ink-2 hover:border-ops-accent hover:text-ops-header disabled:pointer-events-none disabled:opacity-50"
            >
              View
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => handleDelete(a.id)}
              className="rounded-sm border border-ops-line px-1.5 py-0.5 text-[11px] font-semibold text-ops-danger hover:border-ops-danger hover:bg-ops-danger hover:text-white disabled:pointer-events-none disabled:opacity-50"
            >
              Delete
            </button>
          </div>
        </div>
      ))}

      <form action={handleUpload} className="flex flex-wrap items-center gap-2 border-t border-ops-line pt-2.5">
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
          className="rounded-sm bg-ops-header px-3 py-1 text-[11px] font-bold uppercase tracking-[0.06em] text-white hover:bg-ops-header-2 disabled:pointer-events-none disabled:opacity-50"
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
