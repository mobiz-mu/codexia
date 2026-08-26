import { describe, it, expect } from "vitest";
import { INSPECTION_CHECKLIST, type InspectionResult } from "@/lib/fleet/inspection-checklist";
import { buildInspectionReport, inspectionReference, type InspectionReportInput } from "./report";

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

const build = (
  inspection: Partial<InspectionReportInput> = {},
  itemList = items("pass"),
  extra: Partial<Parameters<typeof buildInspectionReport>[0]> = {}
) => buildInspectionReport({ inspection: { ...BASE, ...inspection }, items: itemList, ...extra });

describe("report structure", () => {
  it("carries the required title", () => {
    expect(build().title).toBe("WEEKLY VEHICLE INSPECTION CHECKLIST");
  });

  it("renders exactly 40 items", () => {
    const rows = build().sections.flatMap((s) => s.rows);
    expect(rows).toHaveLength(40);
    expect(new Set(rows.map((r) => r.itemKey)).size).toBe(40);
  });

  it("keeps the canonical section order", () => {
    expect(build().sections.map((s) => s.title)).toEqual([
      "EXTERIOR",
      "TYRES & WHEELS",
      "ENGINE & FLUIDS",
      "INTERIOR",
      "SAFETY EQUIPMENT",
      "ROAD TEST",
    ]);
  });

  it("keeps the canonical item order inside a section", () => {
    const exterior = build().sections[0];
    expect(exterior.rows.map((r) => r.itemKey).slice(0, 3)).toEqual([
      "ext_body_damage",
      "ext_windshield_windows",
      "ext_mirrors",
    ]);
  });

  // The catalogue is the source, not the stored rows.
  it("prints all 40 even when a stored row is missing", () => {
    const partial = items("pass").slice(0, 30);
    const report = build({}, partial);
    expect(report.sections.flatMap((s) => s.rows)).toHaveLength(40);
    expect(report.counts.unanswered).toBe(10);
  });

  it("builds a human-readable reference from the id", () => {
    expect(inspectionReference(BASE.id)).toBe("WVI-FF109729");
    expect(build().reference).toBe("WVI-FF109729");
  });
});

describe("historical identity", () => {
  // Non-negotiable: the sheet is evidence of what was inspected that day.
  it("uses the stored snapshot, not any live vehicle name", () => {
    const report = build({ vehicle_registration: "OLD 999", vehicle_make_model: "Suzuki Celerio" });
    expect(report.registration).toBe("OLD 999");
    expect(report.makeModel).toBe("Suzuki Celerio");
  });

  it("degrades to a dash rather than inventing identity", () => {
    const report = build({ vehicle_registration: null, vehicle_make_model: null, company_name: null });
    expect(report.registration).toBe("—");
    expect(report.makeModel).toBe("—");
    expect(report.company).toBe("—");
  });

  it("formats the odometer with units", () => {
    expect(build({ odometer_km: 51000 }).odometerLabel).toBe("51,000 km");
  });
});

describe("result rendering", () => {
  const resultFor = (key: string, list: ReturnType<typeof items>) =>
    build({}, list)
      .sections.flatMap((s) => s.rows)
      .find((r) => r.itemKey === key)!;

  it("renders PASS", () => {
    expect(resultFor("ext_mirrors", items("pass")).resultLabel).toBe("PASS");
  });

  it("renders ATTENTION", () => {
    const list = items("pass");
    list.find((i) => i.item_key === "ext_mirrors")!.result = "attention";
    expect(resultFor("ext_mirrors", list).resultLabel).toBe("ATTENTION");
  });

  it("renders FAIL", () => {
    const list = items("pass");
    list.find((i) => i.item_key === "road_brakes")!.result = "fail";
    expect(resultFor("road_brakes", list).resultLabel).toBe("FAIL");
  });

  it("renders N/A", () => {
    const list = items("pass");
    list.find((i) => i.item_key === "eng_washer_fluid")!.result = "na";
    expect(resultFor("eng_washer_fluid", list).resultLabel).toBe("N/A");
  });

  it("renders UNANSWERED for a draft row", () => {
    const list = items(null);
    expect(resultFor("ext_mirrors", list).resultLabel).toBe("UNANSWERED");
  });

  it("counts every result independently", () => {
    const list = items("pass");
    list[0].result = "attention";
    list[1].result = "fail";
    list[2].result = "na";
    list[3].result = null;
    expect(build({}, list).counts).toEqual({ pass: 36, attention: 1, fail: 1, na: 1, unanswered: 1 });
  });

  it("carries item remarks through to the row", () => {
    const list = items("pass");
    const target = list.find((i) => i.item_key === "ext_mirrors")!;
    target.result = "attention";
    target.remarks = "Nearside mirror loose";
    expect(resultFor("ext_mirrors", list).remarks).toBe("Nearside mirror loose");
  });
});

describe("safety failures", () => {
  it("lists failed safety-critical checks from the catalogue, not from labels", () => {
    const list = items("pass");
    list.find((i) => i.item_key === "road_brakes")!.result = "fail";
    list.find((i) => i.item_key === "int_air_conditioning")!.result = "fail";
    const report = build({ result: "failed" }, list);
    expect(report.safetyFailures.map((f) => f.itemKey)).toEqual(["road_brakes"]);
    expect(report.safetyFailures[0].label).toBe("Brakes operating correctly");
  });

  it("has no safety failures on a clean inspection", () => {
    expect(build().safetyFailures).toEqual([]);
  });

  it("does not treat an attention on a safety item as a failure", () => {
    const list = items("pass");
    list.find((i) => i.item_key === "road_brakes")!.result = "attention";
    expect(build({ result: "attention_required" }, list).safetyFailures).toEqual([]);
  });

  it("marks safety-critical rows so the sheet can flag them", () => {
    const rows = build().sections.flatMap((s) => s.rows);
    expect(rows.filter((r) => r.safetyCritical)).toHaveLength(12);
    expect(rows.find((r) => r.itemKey === "int_air_conditioning")!.safetyCritical).toBe(false);
  });
});

describe("defects and follow-ups", () => {
  it("lists attention and fail items with remarks", () => {
    const list = items("pass");
    const brakes = list.find((i) => i.item_key === "road_brakes")!;
    brakes.result = "fail";
    brakes.remarks = "Excessive pedal travel";
    list.find((i) => i.item_key === "ext_mirrors")!.result = "attention";

    const report = build({ result: "failed" }, list);
    expect(report.defects).toHaveLength(2);
    expect(report.defects[0].resultLabel).toBe("FAIL");
    expect(report.defects[0].remarks).toBe("Excessive pedal travel");
    expect(report.defects[0].safetyCritical).toBe(true);
  });

  it("carries the overall defect notes", () => {
    expect(build({ defects_notes: "Booked in for Monday" }).defectsNotes).toBe("Booked in for Monday");
  });

  it("includes maintenance follow-up references resolved to item labels", () => {
    const report = build({}, items("pass"), {
      followUps: [
        {
          id: "525ca560-0711-4f00-ae78-916b723904a9",
          maintenance_date: "2026-09-18",
          maintenance_type: "repair",
          source_inspection_followup_key: "ext_wiper_blades,road_brakes",
        },
      ],
    });
    expect(report.followUps).toHaveLength(1);
    expect(report.followUps[0].reference).toBe("MTN-525CA560");
    expect(report.followUps[0].itemLabels).toEqual([
      "Wiper blades operating correctly",
      "Brakes operating correctly",
    ]);
  });

  it("has no follow-ups when none exist", () => {
    expect(build().followUps).toEqual([]);
  });

  it("includes downtime only when supplied, never reconstructed", () => {
    expect(build().downtime).toBeNull();
    const withDowntime = build({}, items("pass"), {
      downtime: { startAt: "2026-09-21 06:00", endAt: "2026-09-22 06:00", released: false },
    });
    expect(withDowntime.downtime?.released).toBe(false);
  });
});

describe("result and approval stay separate", () => {
  it("reports a clean inspection as PASSED and NOT APPROVED", () => {
    const report = build({ result: "completed" });
    expect(report.resultLabel).toBe("PASSED");
    expect(report.approvalLabel).toBe("NOT APPROVED");
  });

  // The whole reason approval is a separate column.
  it("preserves FAILED alongside APPROVED", () => {
    const list = items("pass");
    list.find((i) => i.item_key === "road_brakes")!.result = "fail";
    const report = build(
      {
        result: "failed",
        approved_at: "2026-09-21T08:00:00Z",
        approver_name: "Fleet Manager",
        approval_remarks: "Reviewed; car withdrawn",
      },
      list
    );
    expect(report.resultLabel).toBe("FAILED");
    expect(report.approvalLabel).toBe("APPROVED");
    expect(report.approvedBy).toBe("Fleet Manager");
    expect(report.approvalRemarks).toBe("Reviewed; car withdrawn");
    // Approval must not have softened the defect or the safety warning.
    expect(report.safetyFailures).toHaveLength(1);
    expect(report.defects).toHaveLength(1);
  });

  it("never merges approval into the result label", () => {
    const report = build({ result: "failed", approved_at: "2026-09-21T08:00:00Z" });
    expect(report.resultLabel).not.toContain("APPROVED");
    expect(report.approvalLabel).not.toContain("FAILED");
  });

  it("carries acknowledgement names and dates", () => {
    const report = build({
      driver_acknowledged_on: "2026-09-18",
      inspector_acknowledged_on: "2026-09-18",
    });
    expect(report.driverName).toBe("R. Beeharry");
    expect(report.driverAcknowledgedOn).toBe("2026-09-18");
    expect(report.inspectorName).toBe("A. Pillay");
    expect(report.inspectorAcknowledgedOn).toBe("2026-09-18");
  });
});

describe("draft treatment", () => {
  it("marks a draft inspection", () => {
    expect(build({ result: "draft" }, items(null)).isDraft).toBe(true);
  });

  it("does not mark a completed inspection as draft", () => {
    expect(build({ result: "completed" }).isDraft).toBe(false);
    expect(build({ result: "failed" }).isDraft).toBe(false);
  });

  it("never shows a draft as approved", () => {
    const report = build({ result: "draft" }, items(null));
    expect(report.approvalLabel).toBe("NOT APPROVED");
    expect(report.resultLabel).toBe("IN PROGRESS");
  });
});
