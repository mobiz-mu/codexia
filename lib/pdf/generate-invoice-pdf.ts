import "server-only";
import { renderToBuffer } from "@react-pdf/renderer";
import { InvoiceDocument, type InvoicePdfData } from "./InvoiceDocument";
import { createAdminClient } from "@/lib/supabase/admin";

export async function generateAndStoreInvoicePdf(invoiceId: string, data: InvoicePdfData): Promise<string | null> {
  const buffer = await renderToBuffer(InvoiceDocument({ data }));

  const supabase = createAdminClient();
  const path = `${invoiceId}/${data.number}.pdf`;

  const { error } = await supabase.storage.from("invoices").upload(path, buffer, {
    contentType: "application/pdf",
    upsert: true,
  });

  if (error) {
    console.error("generateAndStoreInvoicePdf upload failed", error.message);
    return null;
  }

  await supabase.from("invoices").update({ storage_path: path }).eq("id", invoiceId);

  return path;
}
