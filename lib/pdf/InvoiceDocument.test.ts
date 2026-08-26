import { describe, it, expect } from "vitest";
import { inflateSync } from "node:zlib";
import { renderToBuffer } from "@react-pdf/renderer";
import { InvoiceDocument, type InvoicePdfData } from "./InvoiceDocument";

/**
 * The invoice PDF had no test at all, which meant the only proof it produced
 * a valid document was that nobody had complained — and production has never
 * held an invoice, so nobody could have.
 *
 * Same approach as the weekly inspection sheet: render REAL bytes and assert
 * the document's structure. A byte snapshot would break on any harmless
 * layout change while saying nothing about whether the file opens.
 */

const BASE: InvoicePdfData = {
  number: "INV-2026-0001",
  issueDate: "2026-09-14",
  dueDate: "2026-09-28",
  status: "sent",
  bookingReference: "CDX-2026-000111949",
  customerName: "R. Beeharry",
  customerEmail: "r.beeharry@example.com",
  customerAddress: "12 Royal Road, Grand Baie, Mauritius",
  items: [
    { description: "Suzuki Swift — 4 days", quantity: 4, unitPriceFormatted: "€17.00", totalFormatted: "€68.00" },
    { description: "Child seat", quantity: 4, unitPriceFormatted: "€5.00", totalFormatted: "€20.00" },
    { description: "Airport delivery", quantity: 1, unitPriceFormatted: "€15.00", totalFormatted: "€15.00" },
  ],
  subtotalFormatted: "€103.00",
  taxFormatted: "€0.00",
  discountFormatted: "€0.00",
  totalFormatted: "€103.00",
  paidFormatted: "€100.00",
  balanceFormatted: "€3.00",
  terms: "Payment due within 14 days.",
  notes: "Thank you for renting with Codexia.",
};

const render = (data: Partial<InvoicePdfData> = {}) => renderToBuffer(InvoiceDocument({ data: { ...BASE, ...data } }));

/** Page count without a PDF parser: /Type /Page objects, excluding /Pages. */
function countPages(buffer: Buffer): number {
  return (buffer.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;
}

/**
 * The text a viewer would show. react-pdf writes text-showing operands as hex
 * strings inside TJ arrays, so decoding them proves the document carries real
 * selectable text rather than a rasterised image.
 */
function extractText(buffer: Buffer): string {
  const raw = buffer.toString("latin1");
  let content = "";
  const streams = /stream\r?\n([\s\S]*?)endstream/g;
  let match: RegExpExecArray | null;
  while ((match = streams.exec(raw)) !== null) {
    try {
      content += inflateSync(Buffer.from(match[1], "latin1")).toString("latin1");
    } catch {
      /* not a flate stream */
    }
  }
  return [...content.matchAll(/<([0-9A-Fa-f]+)>/g)]
    .map(([, hex]) => {
      let out = "";
      for (let i = 0; i + 1 < hex.length; i += 2) out += String.fromCharCode(Number.parseInt(hex.slice(i, i + 2), 16));
      return out;
    })
    .join("");
}

describe("the invoice PDF is a real, valid PDF", () => {
  it("starts with the PDF signature and ends with EOF", async () => {
    const pdf = await render();
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(pdf.toString("latin1").trimEnd().endsWith("%%EOF")).toBe(true);
    expect(pdf.byteLength).toBeGreaterThan(1000);
  });

  it("declares a cross-reference table and a catalog", async () => {
    const raw = (await render()).toString("latin1");
    expect(raw).toContain("/Type /Catalog");
    expect(raw).toMatch(/\btrailer\b/);
    expect(raw).toMatch(/\bxref\b|\/Type\s*\/XRef/);
  });

  it("uses A4 page geometry", async () => {
    const raw = (await render()).toString("latin1");
    const box = /\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/.exec(raw);
    expect(box).not.toBeNull();
    // A4 at 72dpi is 595.28 x 841.89 pt.
    expect(Number(box![1])).toBeCloseTo(595.28, 0);
    expect(Number(box![2])).toBeCloseTo(841.89, 0);
  });

  it("uses standard Helvetica rather than an embedded subset", async () => {
    // No Font.register anywhere in the project, so nothing may depend on a
    // web font being reachable at render time.
    const raw = (await render()).toString("latin1");
    expect(raw).toContain("/Helvetica");
    expect(raw).not.toContain("/FontFile");
  });
});

describe("the invoice PDF says what it should", () => {
  it("prints the invoice number, dates and customer", async () => {
    const text = extractText(await render());
    expect(text).toContain("INV-2026-0001");
    expect(text).toContain("2026-09-14");
    expect(text).toContain("R. Beeharry");
    expect(text).toContain("r.beeharry@example.com");
  });

  it("prints every line item, so the text is selectable and searchable", async () => {
    const text = extractText(await render());
    expect(text).toContain("Child seat");
    expect(text).toContain("Airport delivery");
  });

  it("prints the totals block", async () => {
    const text = extractText(await render());
    for (const amount of ["103.00", "100.00", "3.00"]) expect(text).toContain(amount);
  });

  it("carries the booking reference that ties it to the rental", async () => {
    expect(extractText(await render())).toContain("CDX-2026-000111949");
  });

  it("carries document metadata for the viewer title bar", async () => {
    const raw = (await render()).toString("latin1");
    expect(raw).toMatch(/\/Producer|\/Creator/);
  });
});

describe("currency is rendered, never recomputed", () => {
  /**
   * The document receives pre-formatted strings and prints them verbatim.
   * That is deliberate: formatMoney at the call site is the single place that
   * decides EUR vs MUR, so the PDF cannot disagree with the screen.
   */
  it("prints EUR exactly as formatted upstream", async () => {
    const text = extractText(await render());
    expect(text).toContain("103.00");
    expect(text).not.toContain("Rs ");
  });

  it("prints MUR exactly as formatted upstream, without converting", async () => {
    const text = extractText(
      await render({
        items: [{ description: "Tyre change", quantity: 1, unitPriceFormatted: "Rs 1,499.77", totalFormatted: "Rs 1,499.77" }],
        subtotalFormatted: "Rs 1,499.77",
        totalFormatted: "Rs 1,499.77",
        paidFormatted: "Rs 0.00",
        balanceFormatted: "Rs 1,499.77",
      })
    );
    expect(text).toContain("1,499.77");
    // No euro sign smuggled in by the template itself.
    expect(text).not.toContain("103.00");
  });
});

describe("the invoice PDF degrades rather than throwing", () => {
  it("renders with no optional fields at all", async () => {
    const pdf = await render({ bookingReference: null, customerAddress: null, terms: null, notes: null });
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  it("renders an invoice with no line items", async () => {
    const pdf = await render({ items: [] });
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  it("paginates rather than clipping a long itemised invoice", async () => {
    const many = Array.from({ length: 60 }, (_, n) => ({
      description: `Line item number ${n + 1} with a reasonably long description`,
      quantity: 1,
      unitPriceFormatted: "€10.00",
      totalFormatted: "€10.00",
    }));
    const pdf = await render({ items: many });
    expect(countPages(pdf)).toBeGreaterThan(1);
    // The last item must survive onto a later page rather than being cut off.
    expect(extractText(pdf)).toContain("Line item number 60");
  });

  it("survives a very long description without throwing", async () => {
    const pdf = await render({
      items: [
        {
          description: "Extended rental ".repeat(40).trim(),
          quantity: 1,
          unitPriceFormatted: "€10.00",
          totalFormatted: "€10.00",
        },
      ],
    });
    expect(pdf.byteLength).toBeGreaterThan(1000);
  });
});
