"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  duplicateInvoice,
  getInvoiceSignedUrl,
  getInvoiceWhatsAppLink,
  markInvoiceSent,
  regenerateInvoicePdf,
  sendInvoiceByEmail,
  voidInvoice,
} from "@/lib/actions/admin/invoices";

export function InvoiceActionsPanel({
  invoiceId,
  status,
  storagePath,
}: {
  invoiceId: string;
  status: string;
  storagePath: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function handleGeneratePdf() {
    setMessage(null);
    startTransition(async () => {
      const result = await regenerateInvoicePdf(invoiceId);
      setMessage(result.ok ? "PDF generated." : result.error ?? "Failed to generate PDF.");
      router.refresh();
    });
  }

  function handleDownload() {
    if (!storagePath) {
      setMessage("Generate the PDF first.");
      return;
    }
    setMessage(null);
    startTransition(async () => {
      const url = await getInvoiceSignedUrl(storagePath);
      if (url) window.open(url, "_blank", "noopener,noreferrer");
      else setMessage("Failed to create download link.");
    });
  }

  function handleMarkSent() {
    setMessage(null);
    startTransition(async () => {
      await markInvoiceSent(invoiceId);
      setMessage("Marked as sent.");
      router.refresh();
    });
  }

  function handleSendEmail() {
    setMessage(null);
    startTransition(async () => {
      const result = await sendInvoiceByEmail(invoiceId);
      setMessage(result.ok ? "Invoice emailed to the customer." : result.error ?? "Failed to send email.");
      router.refresh();
    });
  }

  function handleSendWhatsApp() {
    setMessage(null);
    startTransition(async () => {
      const result = await getInvoiceWhatsAppLink(invoiceId);
      if (!result.ok) {
        setMessage(result.error ?? "Failed to prepare WhatsApp message.");
        return;
      }
      window.open(result.whatsappUrl, "_blank", "noopener,noreferrer");
      router.refresh();
    });
  }

  function handleVoid() {
    if (!confirm("Void this invoice? This cannot be undone.")) return;
    setMessage(null);
    startTransition(async () => {
      await voidInvoice(invoiceId);
      router.refresh();
    });
  }

  function handleDuplicate() {
    setMessage(null);
    startTransition(async () => {
      const result = await duplicateInvoice(invoiceId);
      if (result.ok) router.push(`/admin/invoices/${result.invoiceId}`);
      else setMessage(result.error ?? "Failed to duplicate.");
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={handleGeneratePdf}
          className="rounded-full border border-border px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-primary hover:text-primary-dark disabled:pointer-events-none disabled:opacity-60"
        >
          Generate / Refresh PDF
        </button>
        {storagePath && (
          <button
            type="button"
            disabled={pending}
            onClick={handleDownload}
            className="rounded-full border border-border px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-primary hover:text-primary-dark disabled:pointer-events-none disabled:opacity-60"
          >
            Download PDF
          </button>
        )}
        <button
          type="button"
          disabled={pending}
          onClick={handleSendEmail}
          className="rounded-full bg-action px-4 py-2 text-sm font-semibold text-ink shadow-sm transition-all hover:-translate-y-0.5 hover:bg-action-dark hover:shadow-md disabled:pointer-events-none disabled:opacity-60"
        >
          Send by Email
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={handleSendWhatsApp}
          className="rounded-full bg-[#25D366] px-4 py-2 text-sm font-semibold text-ink shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md disabled:pointer-events-none disabled:opacity-60"
        >
          Send by WhatsApp
        </button>
        {status === "draft" && (
          <button
            type="button"
            disabled={pending}
            onClick={handleMarkSent}
            className="rounded-full border border-border px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-primary hover:text-primary-dark disabled:pointer-events-none disabled:opacity-60"
          >
            Mark Sent
          </button>
        )}
        <button
          type="button"
          disabled={pending}
          onClick={handleDuplicate}
          className="rounded-full border border-border px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-primary hover:text-primary-dark disabled:pointer-events-none disabled:opacity-60"
        >
          Duplicate
        </button>
        {status !== "void" && (
          <button
            type="button"
            disabled={pending}
            onClick={handleVoid}
            className="rounded-full border border-red-300 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:pointer-events-none disabled:opacity-60"
          >
            Void
          </button>
        )}
      </div>
      {message && (
        <p className="rounded-lg bg-surface px-3 py-2 text-sm text-ink" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
