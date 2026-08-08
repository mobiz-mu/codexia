"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminUser } from "@/lib/auth/get-current-admin-user";
import { generateAndStoreInvoicePdf } from "@/lib/pdf/generate-invoice-pdf";
import { formatMoney } from "@/lib/pricing/format";
import { sendEmail } from "@/lib/email/send";
import InvoiceEmail from "@/emails/InvoiceEmail";
import { getSiteSettings } from "@/lib/config/get-site-settings";
import { buildEmailBrandProps, getSiteUrl } from "@/lib/email/shared-props";

function assertPermission(user: { permissions: Set<string> }, permission: string) {
  if (!user.permissions.has(permission)) {
    throw new Error(`Missing required permission: ${permission}`);
  }
}

export async function listInvoicesAdmin() {
  const user = await requireAdminUser();
  assertPermission(user, "create_invoices");

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("invoices")
    .select("id, number, customer_name, issue_date, due_date, total_cents, paid_cents, currency, status")
    .order("created_at", { ascending: false })
    .limit(100);
  return data ?? [];
}

export async function getInvoiceAdmin(id: string) {
  const user = await requireAdminUser();
  assertPermission(user, "create_invoices");

  const supabase = createAdminClient();
  const [{ data: invoice }, { data: items }, { data: payments }] = await Promise.all([
    supabase.from("invoices").select("*").eq("id", id).maybeSingle(),
    supabase.from("invoice_items").select("*").eq("invoice_id", id).order("display_order", { ascending: true }),
    supabase.from("invoice_payments").select("*").eq("invoice_id", id).order("paid_at", { ascending: false }),
  ]);

  return { invoice, items: items ?? [], payments: payments ?? [] };
}

async function recalculateInvoiceTotals(invoiceId: string) {
  const supabase = createAdminClient();
  const [{ data: items }, { data: invoice }] = await Promise.all([
    supabase.from("invoice_items").select("*").eq("invoice_id", invoiceId),
    supabase.from("invoices").select("paid_cents, status").eq("id", invoiceId).single(),
  ]);

  const subtotalCents = (items ?? []).reduce((sum, item) => sum + item.quantity * item.unit_price_cents, 0);
  const taxCents = (items ?? []).reduce(
    (sum, item) => sum + Math.round(item.quantity * item.unit_price_cents * (item.tax_rate / 100)),
    0
  );
  const discountCents = (items ?? []).reduce((sum, item) => sum + item.discount_cents, 0);
  const totalCents = subtotalCents + taxCents - discountCents;

  const paidCents = invoice?.paid_cents ?? 0;

  let status = invoice?.status ?? "draft";
  if (status !== "void") {
    if (paidCents >= totalCents && totalCents > 0) status = "paid";
    else if (paidCents > 0) status = "partially_paid";
  }

  await supabase
    .from("invoices")
    .update({ subtotal_cents: subtotalCents, tax_cents: taxCents, discount_cents: discountCents, total_cents: totalCents, status })
    .eq("id", invoiceId);
}

const manualInvoiceSchema = z.object({
  customerName: z.string().trim().min(1).max(200),
  customerEmail: z.email(),
  customerAddress: z.string().trim().max(500).optional().or(z.literal("")),
  dueDate: z.string().min(1),
  terms: z.string().trim().max(2000).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export type InvoiceFormState = { status: "idle" | "success" | "error"; error?: string; invoiceId?: string };

export async function createManualInvoice(_prev: InvoiceFormState, formData: FormData): Promise<InvoiceFormState> {
  const user = await requireAdminUser();
  assertPermission(user, "create_invoices");

  const parsed = manualInvoiceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", error: "Please check the form for errors." };

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("invoices")
    .insert({
      customer_name: parsed.data.customerName,
      customer_email: parsed.data.customerEmail,
      customer_address: parsed.data.customerAddress || null,
      due_date: parsed.data.dueDate,
      terms: parsed.data.terms || null,
      notes: parsed.data.notes || null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) {
    console.error("createManualInvoice failed", error.message);
    return { status: "error", error: "Failed to create invoice." };
  }

  return { status: "success", invoiceId: data.id };
}

export async function createInvoiceFromBooking(bookingId: string) {
  const user = await requireAdminUser();
  assertPermission(user, "create_invoices");

  const supabase = createAdminClient();
  const [{ data: booking }, { data: customer }, { data: existing }] = await Promise.all([
    supabase.from("bookings").select("*").eq("id", bookingId).single(),
    supabase.from("booking_customers").select("*").eq("booking_id", bookingId).maybeSingle(),
    supabase.from("invoices").select("id").eq("booking_id", bookingId).maybeSingle(),
  ]);

  if (!booking || !customer) return { ok: false as const, error: "Booking or customer not found." };
  if (existing) return { ok: true as const, invoiceId: existing.id };

  const days = Math.max(1, Math.ceil((new Date(booking.return_at).getTime() - new Date(booking.pickup_at).getTime()) / 86400000));

  const { data: invoice, error } = await supabase
    .from("invoices")
    .insert({
      booking_id: bookingId,
      customer_name: customer.full_name,
      customer_email: customer.email,
      customer_address: customer.address,
      due_date: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      created_by: user.id,
      currency: booking.currency,
    })
    .select("id")
    .single();

  if (error || !invoice) return { ok: false as const, error: "Failed to create invoice." };

  const pricing = booking.pricing as { lineItems?: { key: string; label: string; amountCents: number }[] } | null;
  const items = (pricing?.lineItems ?? []).map((line, i) => ({
    invoice_id: invoice.id,
    description: line.label,
    quantity: 1,
    unit_price_cents: line.amountCents,
    tax_rate: 0,
    discount_cents: 0,
    line_total_cents: line.amountCents,
    display_order: i,
  }));

  if (items.length === 0) {
    items.push({
      invoice_id: invoice.id,
      description: `Vehicle rental (${days} day${days > 1 ? "s" : ""})`,
      quantity: 1,
      unit_price_cents: booking.total_cents,
      tax_rate: 0,
      discount_cents: 0,
      line_total_cents: booking.total_cents,
      display_order: 0,
    });
  }

  await supabase.from("invoice_items").insert(items);
  await recalculateInvoiceTotals(invoice.id);

  return { ok: true as const, invoiceId: invoice.id };
}

export async function createInvoiceFromBookingAndRedirect(bookingId: string) {
  const result = await createInvoiceFromBooking(bookingId);
  if (!result.ok) throw new Error(result.error);
  redirect(`/admin/invoices/${result.invoiceId}`);
}

const itemSchema = z.object({
  description: z.string().trim().min(1).max(300),
  quantity: z.coerce.number().min(0.01),
  unitPriceCents: z.coerce.number().int().min(0),
  taxRate: z.coerce.number().min(0).max(100),
  discountCents: z.coerce.number().int().min(0),
});

export async function addInvoiceItem(invoiceId: string, formData: FormData) {
  const user = await requireAdminUser();
  assertPermission(user, "create_invoices");

  const parsed = itemSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false as const, error: "Please check the item fields." };

  const lineTotal =
    Math.round(parsed.data.quantity * parsed.data.unitPriceCents * (1 + parsed.data.taxRate / 100)) -
    parsed.data.discountCents;

  const supabase = createAdminClient();
  const { error } = await supabase.from("invoice_items").insert({
    invoice_id: invoiceId,
    description: parsed.data.description,
    quantity: parsed.data.quantity,
    unit_price_cents: parsed.data.unitPriceCents,
    tax_rate: parsed.data.taxRate,
    discount_cents: parsed.data.discountCents,
    line_total_cents: lineTotal,
  });

  if (error) return { ok: false as const, error: "Failed to add item." };

  await recalculateInvoiceTotals(invoiceId);
  return { ok: true as const };
}

export async function deleteInvoiceItem(invoiceId: string, itemId: string) {
  const user = await requireAdminUser();
  assertPermission(user, "create_invoices");

  const supabase = createAdminClient();
  await supabase.from("invoice_items").delete().eq("id", itemId);
  await recalculateInvoiceTotals(invoiceId);
  return { ok: true as const };
}

const paymentSchema = z.object({
  amountCents: z.coerce.number().int().min(1),
  method: z.string().trim().min(1).max(50),
  note: z.string().trim().max(500).optional().or(z.literal("")),
});

export async function recordInvoicePayment(invoiceId: string, formData: FormData) {
  const user = await requireAdminUser();
  assertPermission(user, "create_invoices");

  const parsed = paymentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false as const, error: "Please check the payment fields." };

  const supabase = createAdminClient();
  await supabase.from("invoice_payments").insert({
    invoice_id: invoiceId,
    amount_cents: parsed.data.amountCents,
    method: parsed.data.method,
    note: parsed.data.note || null,
    recorded_by: user.id,
  });

  const { data: payments } = await supabase.from("invoice_payments").select("amount_cents").eq("invoice_id", invoiceId);
  const paidCents = (payments ?? []).reduce((sum, p) => sum + p.amount_cents, 0);
  await supabase.from("invoices").update({ paid_cents: paidCents }).eq("id", invoiceId);
  await recalculateInvoiceTotals(invoiceId);

  return { ok: true as const };
}

export async function voidInvoice(id: string) {
  const user = await requireAdminUser();
  assertPermission(user, "create_invoices");
  const supabase = createAdminClient();
  await supabase.from("invoices").update({ status: "void" }).eq("id", id);
  await supabase.from("audit_logs").insert({ actor_id: user.id, action: "invoice_voided", entity: "invoices", entity_id: id });
  return { ok: true as const };
}

export async function duplicateInvoice(id: string) {
  const user = await requireAdminUser();
  assertPermission(user, "create_invoices");

  const supabase = createAdminClient();
  const [{ data: original }, { data: items }] = await Promise.all([
    supabase.from("invoices").select("*").eq("id", id).single(),
    supabase.from("invoice_items").select("*").eq("invoice_id", id),
  ]);
  if (!original) return { ok: false as const, error: "Invoice not found." };

  const { data: created, error } = await supabase
    .from("invoices")
    .insert({
      booking_id: original.booking_id,
      customer_name: original.customer_name,
      customer_email: original.customer_email,
      customer_address: original.customer_address,
      due_date: original.due_date,
      terms: original.terms,
      notes: original.notes,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !created) return { ok: false as const, error: "Failed to duplicate invoice." };

  if (items && items.length > 0) {
    await supabase.from("invoice_items").insert(
      items.map((item) => ({
        invoice_id: created.id,
        description: item.description,
        quantity: item.quantity,
        unit_price_cents: item.unit_price_cents,
        tax_rate: item.tax_rate,
        discount_cents: item.discount_cents,
        line_total_cents: item.line_total_cents,
        display_order: item.display_order,
      }))
    );
    await recalculateInvoiceTotals(created.id);
  }

  return { ok: true as const, invoiceId: created.id };
}

export async function regenerateInvoicePdf(invoiceId: string) {
  const user = await requireAdminUser();
  assertPermission(user, "create_invoices");

  const { invoice, items } = await getInvoiceAdmin(invoiceId);
  if (!invoice) return { ok: false as const, error: "Invoice not found." };

  const currency = invoice.currency;
  const path = await generateAndStoreInvoicePdf(invoiceId, {
    number: invoice.number,
    issueDate: invoice.issue_date,
    dueDate: invoice.due_date,
    status: invoice.status,
    bookingReference: null,
    customerName: invoice.customer_name,
    customerEmail: invoice.customer_email,
    customerAddress: invoice.customer_address,
    items: items.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unitPriceFormatted: formatMoney(item.unit_price_cents, currency, "en"),
      totalFormatted: formatMoney(item.line_total_cents, currency, "en"),
    })),
    subtotalFormatted: formatMoney(invoice.subtotal_cents, currency, "en"),
    taxFormatted: formatMoney(invoice.tax_cents, currency, "en"),
    discountFormatted: formatMoney(invoice.discount_cents, currency, "en"),
    totalFormatted: formatMoney(invoice.total_cents, currency, "en"),
    paidFormatted: formatMoney(invoice.paid_cents, currency, "en"),
    balanceFormatted: formatMoney(invoice.total_cents - invoice.paid_cents, currency, "en"),
    terms: invoice.terms,
    notes: invoice.notes,
  });

  if (!path) return { ok: false as const, error: "Failed to generate PDF." };
  return { ok: true as const, path };
}

export async function getInvoiceSignedUrl(storagePath: string) {
  const user = await requireAdminUser();
  assertPermission(user, "create_invoices");
  const supabase = createAdminClient();
  const { data } = await supabase.storage.from("invoices").createSignedUrl(storagePath, 3600);
  return data?.signedUrl ?? null;
}

async function ensureInvoicePdfPath(invoiceId: string): Promise<string | null> {
  const supabase = createAdminClient();
  const { data: existing } = await supabase.from("invoices").select("storage_path").eq("id", invoiceId).single();
  if (existing?.storage_path) return existing.storage_path;

  const result = await regenerateInvoicePdf(invoiceId);
  return result.ok ? result.path : null;
}

export async function sendInvoiceByEmail(invoiceId: string) {
  const user = await requireAdminUser();
  assertPermission(user, "send_invoices");

  const { invoice } = await getInvoiceAdmin(invoiceId);
  if (!invoice) return { ok: false as const, error: "Invoice not found." };
  if (!invoice.customer_email) return { ok: false as const, error: "This invoice has no customer email." };

  const [path, settings] = await Promise.all([ensureInvoicePdfPath(invoiceId), getSiteSettings()]);
  if (!path) return { ok: false as const, error: "Failed to generate the invoice PDF." };

  const supabase = createAdminClient();
  const { data: signed } = await supabase.storage.from("invoices").createSignedUrl(path, 7 * 24 * 60 * 60);
  if (!signed?.signedUrl) return { ok: false as const, error: "Failed to create a download link." };

  const currency = invoice.currency;
  const siteUrl = getSiteUrl();
  const brand = buildEmailBrandProps(settings, siteUrl, `Hi Codexia, I have a question about invoice ${invoice.number}.`);

  await sendEmail({
    templateKey: "invoice_email",
    to: invoice.customer_email,
    subject: `Invoice ${invoice.number} — ${settings.companyName}`,
    react: InvoiceEmail({
      locale: "en",
      invoiceNumber: invoice.number,
      customerName: invoice.customer_name,
      bookingTotalFormatted: formatMoney(invoice.total_cents, currency, "en"),
      amountPaidFormatted: formatMoney(invoice.paid_cents, currency, "en"),
      balanceFormatted: formatMoney(invoice.total_cents - invoice.paid_cents, currency, "en"),
      downloadUrl: signed.signedUrl,
      ...brand,
    }),
  });

  if (invoice.status === "draft") {
    await supabase.from("invoices").update({ status: "sent" }).eq("id", invoiceId);
  }

  return { ok: true as const };
}

export async function getInvoiceWhatsAppLink(invoiceId: string) {
  const user = await requireAdminUser();
  assertPermission(user, "send_invoices");

  const { invoice } = await getInvoiceAdmin(invoiceId);
  if (!invoice) return { ok: false as const, error: "Invoice not found." };

  const path = await ensureInvoicePdfPath(invoiceId);
  if (!path) return { ok: false as const, error: "Failed to generate the invoice PDF." };

  const supabase = createAdminClient();
  const { data: signed } = await supabase.storage.from("invoices").createSignedUrl(path, 7 * 24 * 60 * 60);
  if (!signed?.signedUrl) return { ok: false as const, error: "Failed to create a download link." };

  const message = `Hi ${invoice.customer_name}, here is your invoice ${invoice.number} from Codexia Ltd: ${signed.signedUrl}`;

  if (invoice.status === "draft") {
    await supabase.from("invoices").update({ status: "sent" }).eq("id", invoiceId);
  }

  return { ok: true as const, whatsappUrl: `https://wa.me/?text=${encodeURIComponent(message)}` };
}

export async function markInvoiceSent(id: string) {
  const user = await requireAdminUser();
  assertPermission(user, "send_invoices");

  const supabase = createAdminClient();
  const { data: invoice } = await supabase.from("invoices").select("status").eq("id", id).single();
  if (invoice?.status === "draft") {
    await supabase.from("invoices").update({ status: "sent" }).eq("id", id);
  }

  await supabase.from("audit_logs").insert({ actor_id: user.id, action: "invoice_sent", entity: "invoices", entity_id: id });
  return { ok: true as const };
}
