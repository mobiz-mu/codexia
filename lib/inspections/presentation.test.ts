import { describe, it, expect } from "vitest";
import { INSPECTION_CHECKLIST, type InspectionResult } from "@/lib/fleet/inspection-checklist";
import {
  RESULT_BADGES,
  approvalBadge,
  defectLines,
  followUpCandidates,
  isInspectionEditable,
  snapshotIdentity,
  summariseChecklist,
  type ItemAnswer,
} from "./presentation";

const full = (result: InspectionResult | null): ItemAnswer[] =>
  INSPECTION_CHECKLIST.map((i) => ({ item_key: i.key, result, remarks: null }));

describe("summariseChecklist", () => {
  it("reports a brand-new sheet as entirely unanswered", () => {
    const s = summariseChecklist(full(null));
    expect(s.unanswered).toBe(40);
    expect(s.answered).toBe(0);
    expect(s.progressLabel).toBe("0 / 40 checked");
    expect(s.complete).toBe(false);
  });

  it("counts progress as answers arrive", () => {
    const items = full(null);
    for (let i = 0; i < 37; i += 1) items[i].result = "pass";
    const s = summariseChecklist(items);
    expect(s.progressLabel).toBe("37 / 40 checked");
    expect(s.unanswered).toBe(3);
    expect(s.complete).toBe(false);
  });

  it("is complete only when every item is answered", () => {
    const s = summariseChecklist(full("pass"));
    expect(s.progressLabel).toBe("40 / 40 checked");
    expect(s.complete).toBe(true);
  });

  it("counts each result independently", () => {
    const items = full("pass");
    items[0].result = "attention";
    items[1].result = "fail";
    items[2].result = "na";
    items[3].result = null;
    const s = summariseChecklist(items);
    expect(s.pass).toBe(36);
    expect(s.attention).toBe(1);
    expect(s.fail).toBe(1);
    expect(s.na).toBe(1);
    expect(s.unanswered).toBe(1);
  });

  it("treats a short sheet as incomplete rather than finished", () => {
    const s = summariseChecklist(full("pass").slice(0, 39));
    expect(s.progressLabel).toBe("39 / 40 checked");
    expect(s.complete).toBe(false);
  });

  it("surfaces only safety-critical failures", () => {
    const items = full("pass");
    items.find((i) => i.item_key === "road_brakes")!.result = "fail";
    items.find((i) => i.item_key === "int_air_conditioning")!.result = "fail";
    items.find((i) => i.item_key === "tyre_front_tread")!.result = "attention";
    const s = summariseChecklist(items);
    expect(s.safetyFailures).toEqual(["road_brakes"]);
  });
});

describe("result and approval badges", () => {
  it("never labels any result as approved", () => {
    for (const badge of Object.values(RESULT_BADGES)) {
      expect(badge.label.toLowerCase()).not.toContain("approved");
    }
  });

  it("carries a glyph as well as colour for every result", () => {
    for (const badge of Object.values(RESULT_BADGES)) {
      expect(badge.glyph.length).toBeGreaterThan(0);
      expect(badge.label.length).toBeGreaterThan(0);
    }
  });

  it("uses semantic feedback tokens, not planning-board status tokens", () => {
    const classes = Object.values(RESULT_BADGES)
      .map((b) => b.className)
      .concat(approvalBadge("2026-09-21").className, approvalBadge(null).className)
      .join(" ");
    for (const boardToken of ["ops-booked", "ops-agency", "ops-web", "ops-quote", "ops-stopsell", "ops-maint"]) {
      expect(classes).not.toContain(boardToken);
    }
  });

  // The reason approval is a separate column at all.
  it("renders FAILED and APPROVED as two independent badges", () => {
    const result = RESULT_BADGES.failed;
    const approval = approvalBadge("2026-09-21T08:00:00Z");
    expect(result.label).toBe("Failed");
    expect(approval.label).toBe("Approved");
    expect(result.label).not.toBe(approval.label);
  });

  it("says not approved when there is no timestamp", () => {
    expect(approvalBadge(null).label).toBe("Not approved");
    expect(approvalBadge(undefined).label).toBe("Not approved");
  });
});

describe("defectLines", () => {
  it("lists only attention and fail items", () => {
    const items = full("pass");
    items[0].result = "attention";
    items[1].result = "fail";
    items[2].result = "na";
    const lines = defectLines(items);
    expect(lines).toHaveLength(2);
    expect(lines.map((l) => l.result).sort()).toEqual(["attention", "fail"]);
  });

  it("puts failures before attention items", () => {
    const items = full("pass");
    items.find((i) => i.item_key === "ext_body_damage")!.result = "attention";
    items.find((i) => i.item_key === "road_brakes")!.result = "fail";
    const lines = defectLines(items);
    expect(lines[0].itemKey).toBe("road_brakes");
    expect(lines[1].itemKey).toBe("ext_body_damage");
  });

  it("resolves the human label and safety flag from the catalogue", () => {
    const items = full("pass");
    items.find((i) => i.item_key === "tyre_front_tread")!.result = "fail";
    const [line] = defectLines(items);
    expect(line.label).toBe("Front tyres — good tread");
    expect(line.section).toBe("tyres_wheels");
    expect(line.safetyCritical).toBe(true);
  });

  it("carries item remarks through to the defect list", () => {
    const items = full("pass");
    const target = items.find((i) => i.item_key === "ext_mirrors")!;
    target.result = "attention";
    target.remarks = "Nearside mirror loose";
    expect(defectLines(items)[0].remarks).toBe("Nearside mirror loose");
  });

  it("returns nothing for a clean sheet", () => {
    expect(defectLines(full("pass"))).toEqual([]);
    expect(followUpCandidates(full("pass"))).toEqual([]);
  });

  it("offers exactly the defects as follow-up candidates", () => {
    const items = full("pass");
    items[4].result = "fail";
    items[5].result = "attention";
    expect(followUpCandidates(items)).toHaveLength(2);
  });
});

describe("editability and snapshot", () => {
  it("locks an approved inspection", () => {
    expect(isInspectionEditable({ approved_at: "2026-09-21T08:00:00Z" })).toBe(false);
  });

  it("leaves an unapproved inspection editable", () => {
    expect(isInspectionEditable({ approved_at: null })).toBe(true);
    expect(isInspectionEditable({})).toBe(true);
  });

  it("builds a readable identity from the historical snapshot", () => {
    expect(
      snapshotIdentity({ vehicle_make_model: "Suzuki Swift", vehicle_registration: "ABC123" })
    ).toBe("Suzuki Swift · ABC123");
  });

  it("degrades gracefully when the snapshot is empty", () => {
    expect(snapshotIdentity({})).toBe("—");
    expect(snapshotIdentity({ vehicle_make_model: "Suzuki Swift" })).toBe("Suzuki Swift");
  });
});
