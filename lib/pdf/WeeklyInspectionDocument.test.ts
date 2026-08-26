import { describe, it, expect } from "vitest";
import { inflateSync } from "node:zlib";
import { renderToBuffer } from "@react-pdf/renderer";
import { INSPECTION_CHECKLIST, type InspectionResult } from "@/lib/fleet/inspection-checklist";
import { buildInspectionReport, type InspectionReportInput } from "@/lib/inspections/report";
import { WeeklyInspectionDocument } from "./WeeklyInspectionDocument";

/**
 * These render REAL PDF bytes and assert the document's structure, not a
 * byte-for-byte snapshot — a snapshot would break on any harmless layout
 * change while telling us nothing about whether the file is a valid PDF.
 */

const BASE: InspectionReportInput = {
  id: "ff109729-9220-43b3-9525-996645bb49b9",
  company_name: "Codexia Ltd",
  vehicle_registration: "ABC 123",
  vehicle_make_model: "Suzuki Swift",
  driver_name: "R. Beeharry",
  week_ending: "2026-09-20",
  inspection_date: "2026-09-18",
  odometer_km: 51000,
  inspector_name: "A. Pillay",
  checklist_version: 1,
  result: "completed",
};

const items = (result: InspectionResult | null) =>
  INSPECTION_CHECKLIST.map((i) => ({ item_key: i.key, result, remarks: null as string | null }));

function report(inspection: Partial<InspectionReportInput> = {}, list = items("pass")) {
  return buildInspectionReport({ inspection: { ...BASE, ...inspection }, items: list });
}

async function render(r: ReturnType<typeof report>) {
  return renderToBuffer(WeeklyInspectionDocument({ report: r }));
}

/** Page count without a PDF parser: /Type /Page objects, excluding /Pages. */
function countPages(buffer: Buffer): number {
  const text = buffer.toString("latin1");
  return (text.match(/\/Type\s*\/Page[^s]/g) ?? []).length;
}

/**
 * The text a viewer would show. react-pdf writes text-showing operands as hex
 * strings inside TJ arrays, so decoding them proves the document carries real
 * selectable text rather than a rasterised image of the sheet.
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

describe("PDF output is a real, valid PDF", () => {
  it("starts with the PDF signature and ends with EOF", async () => {
    const pdf = await render(report());
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(pdf.subarray(-1024).toString("latin1")).toContain("%%EOF");
    expect(pdf.length).toBeGreaterThan(3000);
  });

  it("declares a cross-reference table and a catalog", async () => {
    const text = (await render(report())).toString("latin1");
    expect(text).toContain("/Type /Catalog");
    expect(text).toMatch(/trailer|\/Type\s*\/XRef/);
  });

  // The 40-row checklist plus the outcome blocks must not clip onto one page.
  it("paginates rather than clipping the checklist", async () => {
    const pages = countPages(await render(report()));
    expect(pages).toBeGreaterThan(1);
  });

  it("uses A4 page geometry", async () => {
    const text = (await render(report())).toString("latin1");
    // A4 at 72dpi is 595.28 x 841.89pt; react-pdf writes a MediaBox per page.
    expect(text).toMatch(/\/MediaBox\s*\[\s*0\s+0\s+595(\.\d+)?\s+841(\.\d+)?/);
  });

  // Base-14 only: nothing embedded, nothing fetched at generation time. This
  // is what keeps the file safe in macOS Preview as well as Chrome.
  it("uses standard Helvetica rather than an embedded subset", async () => {
    const text = (await render(report())).toString("latin1");
    expect(text).toContain("Helvetica");
    expect(text).not.toContain("/FontFile");
    expect(text).not.toContain("/FontFile2");
    expect(text).not.toContain("/FontFile3");
  });

  it("carries document metadata for the viewer title bar", async () => {
    const text = (await render(report())).toString("latin1");
    expect(text).toMatch(/\/Title/);
  });
});

describe("PDF renders every inspection state", () => {
  it("renders a clean completed inspection", async () => {
    const pdf = await render(report({ result: "completed" }));
    expect(pdf.length).toBeGreaterThan(3000);
  });

  it("renders an attention inspection", async () => {
    const list = items("pass");
    list.find((i) => i.item_key === "ext_mirrors")!.result = "attention";
    list.find((i) => i.item_key === "ext_mirrors")!.remarks = "Nearside mirror loose";
    const pdf = await render(report({ result: "attention_required" }, list));
    expect(pdf.length).toBeGreaterThan(3000);
  });

  it("renders a failed inspection with a safety failure", async () => {
    const list = items("pass");
    list.find((i) => i.item_key === "road_brakes")!.result = "fail";
    const r = report({ result: "failed" }, list);
    expect(r.safetyFailures).toHaveLength(1);
    const pdf = await render(r);
    expect(pdf.length).toBeGreaterThan(3000);
  });

  it("renders FAILED · APPROVED without losing either", async () => {
    const list = items("pass");
    list.find((i) => i.item_key === "road_brakes")!.result = "fail";
    const r = report(
      {
        result: "failed",
        approved_at: "2026-09-21T08:00:00Z",
        approver_name: "Fleet Manager",
        approval_remarks: "Reviewed; car withdrawn",
      },
      list
    );
    expect(r.resultLabel).toBe("FAILED");
    expect(r.approvalLabel).toBe("APPROVED");
    const pdf = await render(r);
    expect(pdf.length).toBeGreaterThan(3000);
    expect(countPages(pdf)).toBeGreaterThan(1);
  });

  it("renders a draft with unanswered rows", async () => {
    const r = report({ result: "draft" }, items(null));
    expect(r.isDraft).toBe(true);
    expect(r.counts.unanswered).toBe(40);
    const pdf = await render(r);
    expect(pdf.length).toBeGreaterThan(3000);
  });

  it("renders follow-ups and downtime when present", async () => {
    const list = items("pass");
    list.find((i) => i.item_key === "road_brakes")!.result = "fail";
    const r = buildInspectionReport({
      inspection: { ...BASE, result: "failed" },
      items: list,
      followUps: [
        {
          id: "525ca560-0711-4f00-ae78-916b723904a9",
          maintenance_date: "2026-09-18",
          maintenance_type: "repair",
          source_inspection_followup_key: "road_brakes",
        },
      ],
      downtime: { startAt: "2026-09-21 06:00", endAt: "2026-09-22 06:00", released: false },
    });
    const pdf = await render(r);
    expect(pdf.length).toBeGreaterThan(3000);
  });

  it("survives long remarks without throwing", async () => {
    const list = items("pass");
    const target = list.find((i) => i.item_key === "ext_body_damage")!;
    target.result = "attention";
    target.remarks = "Long remark. ".repeat(40);
    const pdf = await render(report({ result: "attention_required" }, list));
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  it("renders when identity and acknowledgements are missing", async () => {
    const r = report({
      company_name: null,
      vehicle_registration: null,
      vehicle_make_model: null,
      driver_name: null,
      inspector_name: null,
    });
    const pdf = await render(r);
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });
});

/**
 * These read the text a PDF viewer would actually show, decoded out of the
 * generated bytes. They are what prove the document says what it claims —
 * and that it is text, not a picture of text.
 */
describe("the generated PDF says what it should", () => {
  it("prints the required title and every canonical section heading", async () => {
    const text = extractText(await render(report()));
    expect(text).toContain("WEEKLY VEHICLE INSPECTION CHECKLIST");
    for (const heading of [
      "EXTERIOR",
      "TYRES & WHEELS",
      "ENGINE & FLUIDS",
      "INTERIOR",
      "SAFETY EQUIPMENT",
      "ROAD TEST",
    ]) {
      expect(text).toContain(heading);
    }
  });

  it("prints checklist item labels, so the text is selectable and searchable", async () => {
    const text = extractText(await render(report()));
    expect(text).toContain("Brakes operating correctly");
    expect(text).toContain("Fire extinguisher present and in date");
    expect(text).toContain("Jack and wheel spanner available");
  });

  it("prints the historical snapshot identity rather than any live vehicle", async () => {
    const text = extractText(await render(report({ vehicle_registration: "OLD 999" })));
    expect(text).toContain("OLD 999");
  });

  // The non-negotiable one, asserted on the real bytes.
  it("prints FAILED and APPROVED as separate statements", async () => {
    const list = items("pass");
    list.find((i) => i.item_key === "road_brakes")!.result = "fail";
    const text = extractText(
      await render(
        report(
          {
            result: "failed",
            approved_at: "2026-09-21T08:00:00Z",
            approver_name: "Fleet Manager",
            approval_remarks: "Reviewed; car withdrawn",
          },
          list
        )
      )
    );
    expect(text).toContain("INSPECTION RESULT");
    expect(text).toContain("FAILED");
    expect(text).toContain("FLEET MANAGER APPROVAL");
    expect(text).toContain("APPROVED");
    expect(text).toContain("Reviewed; car withdrawn");
    // Approval must not have swallowed the failure or the safety warning.
    expect(text).toContain("VEHICLE SAFETY FAILURE");
  });

  it("prints the safety failure block only when a safety item failed", async () => {
    const clean = extractText(await render(report()));
    expect(clean).not.toContain("VEHICLE SAFETY FAILURE");

    const list = items("pass");
    list.find((i) => i.item_key === "road_brakes")!.result = "fail";
    const failed = extractText(await render(report({ result: "failed" }, list)));
    expect(failed).toContain("VEHICLE SAFETY FAILURE");
  });

  it("marks a draft and prints UNANSWERED rows", async () => {
    const text = extractText(await render(report({ result: "draft" }, items(null))));
    expect(text).toContain("DRAFT");
    expect(text).toContain("UNANSWERED");
    expect(text).not.toContain("FAILED");
  });

  it("prints defects with their remarks", async () => {
    const list = items("pass");
    const brakes = list.find((i) => i.item_key === "road_brakes")!;
    brakes.result = "fail";
    brakes.remarks = "Excessive pedal travel";
    const text = extractText(await render(report({ result: "failed" }, list)));
    expect(text).toContain("DEFECTS / REPAIRS REQUIRED");
    expect(text).toContain("Excessive pedal travel");
  });

  it("labels acknowledgements honestly, never as signatures", async () => {
    const text = extractText(await render(report()));
    expect(text).toContain("DRIVER ACKNOWLEDGEMENT");
    expect(text).toContain("INSPECTOR ACKNOWLEDGEMENT");
    expect(text).toContain("not handwritten");
    expect(text.toLowerCase()).not.toContain("signature of");
  });

  it("keeps maintenance costs off the inspection sheet", async () => {
    const text = extractText(
      await render(
        buildInspectionReport({
          inspection: { ...BASE, result: "failed" },
          items: items("pass"),
          followUps: [
            {
              id: "525ca560-0711-4f00-ae78-916b723904a9",
              maintenance_date: "2026-09-18",
              maintenance_type: "repair",
              source_inspection_followup_key: "road_brakes",
            },
          ],
        })
      )
    );
    expect(text).toContain("MAINTENANCE FOLLOW-UP");
    expect(text).toContain("MTN-525CA560");
    expect(text).not.toContain("Rs ");
  });
});
