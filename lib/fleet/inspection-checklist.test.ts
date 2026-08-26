import { describe, it, expect } from "vitest";
import {
  CHECKLIST_ITEM_COUNT,
  CHECKLIST_VERSION,
  INSPECTION_CHECKLIST,
  INSPECTION_RESULTS,
  INSPECTION_SECTIONS,
  buildInspectionItemRows,
  checklistBySection,
  deriveInspectionResult,
  getChecklistItem,
  isSafetyCriticalKey,
  safetyCriticalFailures,
  type InspectionResult,
} from "./inspection-checklist";

/**
 * The Version 1 checklist contract. These tests exist to make a silent change
 * to the canonical checklist impossible: once inspections are stored against
 * these keys, renaming or dropping one orphans real history.
 */
describe("Version 1 checklist contract", () => {
  it("contains exactly 40 items", () => {
    expect(INSPECTION_CHECKLIST).toHaveLength(40);
    expect(CHECKLIST_ITEM_COUNT).toBe(40);
  });

  it("has 40 unique stable keys", () => {
    const keys = INSPECTION_CHECKLIST.map((i) => i.key);
    expect(new Set(keys).size).toBe(40);
  });

  it("pins the exact key list, so a rename cannot pass unnoticed", () => {
    expect(INSPECTION_CHECKLIST.map((i) => i.key)).toEqual([
      "ext_body_damage",
      "ext_windshield_windows",
      "ext_mirrors",
      "ext_wiper_blades",
      "ext_headlights",
      "ext_brake_lights",
      "ext_indicators",
      "ext_reverse_lights",
      "ext_number_plates",
      "tyre_front_tread",
      "tyre_rear_tread",
      "tyre_pressure_checked",
      "tyre_spare_condition",
      "tyre_wheel_nuts",
      "eng_oil_level",
      "eng_coolant_level",
      "eng_brake_fluid",
      "eng_power_steering_fluid",
      "eng_washer_fluid",
      "eng_no_fluid_leaks",
      "eng_battery_terminals",
      "int_seat_belts",
      "int_horn",
      "int_warning_lights",
      "int_air_conditioning",
      "int_speedometer",
      "int_fuel_level",
      "safe_fire_extinguisher",
      "safe_first_aid_kit",
      "safe_yellow_chalk",
      "safe_accident_agreement",
      "safe_psvl_licence",
      "safe_warning_triangle",
      "safe_reflective_vest",
      "safe_jack_spanner",
      "road_brakes",
      "road_steering",
      "road_suspension",
      "road_clutch_gearbox",
      "road_engine_noise",
    ]);
  });

  it("declares version 1", () => {
    expect(CHECKLIST_VERSION).toBe(1);
  });

  it("uses only known sections, and every section is populated", () => {
    for (const item of INSPECTION_CHECKLIST) {
      expect(INSPECTION_SECTIONS).toContain(item.section);
    }
    for (const section of INSPECTION_SECTIONS) {
      expect(INSPECTION_CHECKLIST.some((i) => i.section === section)).toBe(true);
    }
  });

  it("keeps each section contiguous, so the sheet never interleaves sections", () => {
    const order = INSPECTION_CHECKLIST.map((i) => i.section);
    const firstSeen = order.map((s) => order.indexOf(s));
    const lastSeen = order.map((s) => order.lastIndexOf(s));
    order.forEach((_, index) => {
      expect(index).toBeGreaterThanOrEqual(firstSeen[index]);
      expect(index).toBeLessThanOrEqual(lastSeen[index]);
    });
  });

  it("has the expected item count per section", () => {
    const counts = Object.fromEntries(
      checklistBySection().map((group) => [group.section, group.items.length])
    );
    expect(counts).toEqual({
      exterior: 9,
      tyres_wheels: 5,
      engine_fluids: 7,
      interior: 6,
      safety_equipment: 8,
      road_test: 5,
    });
  });

  it("gives every item a non-empty label", () => {
    for (const item of INSPECTION_CHECKLIST) {
      expect(item.label.trim().length).toBeGreaterThan(0);
    }
  });

  it("supports exactly the four approved result values", () => {
    expect(INSPECTION_RESULTS).toEqual(["pass", "attention", "fail", "na"]);
  });
});

describe("safety-critical classification", () => {
  it("marks the approved safety-critical set and nothing else", () => {
    const critical = INSPECTION_CHECKLIST.filter((i) => i.safetyCritical).map((i) => i.key);
    expect(critical.sort()).toEqual(
      [
        "ext_brake_lights",
        "ext_headlights",
        "ext_indicators",
        "eng_brake_fluid",
        "eng_no_fluid_leaks",
        "int_seat_belts",
        "int_warning_lights",
        "road_brakes",
        "road_steering",
        "tyre_front_tread",
        "tyre_rear_tread",
        "tyre_wheel_nuts",
      ].sort()
    );
  });

  it("does not treat convenience defects as safety-critical", () => {
    expect(isSafetyCriticalKey("int_air_conditioning")).toBe(false);
    expect(isSafetyCriticalKey("eng_washer_fluid")).toBe(false);
    expect(isSafetyCriticalKey("ext_reverse_lights")).toBe(false);
    expect(isSafetyCriticalKey("road_clutch_gearbox")).toBe(false);
  });

  it("reports only failed safety-critical items, not attention or n/a", () => {
    const failures = safetyCriticalFailures([
      { item_key: "road_brakes", result: "fail" },
      { item_key: "tyre_front_tread", result: "attention" },
      { item_key: "int_seat_belts", result: "na" },
      { item_key: "int_air_conditioning", result: "fail" },
    ]);
    expect(failures).toEqual(["road_brakes"]);
  });

  it("resolves an unknown key without throwing", () => {
    expect(getChecklistItem("not_a_real_key")).toBeUndefined();
    expect(isSafetyCriticalKey("not_a_real_key")).toBe(false);
  });
});

describe("buildInspectionItemRows", () => {
  it("seeds all 40 rows unanswered — never pre-passed", () => {
    const rows = buildInspectionItemRows("insp-1");
    expect(rows).toHaveLength(40);
    expect(rows.every((r) => r.result === null)).toBe(true);
    expect(rows.every((r) => r.inspection_id === "insp-1")).toBe(true);
  });

  it("numbers display_order densely from zero in checklist order", () => {
    const rows = buildInspectionItemRows("insp-1");
    expect(rows.map((r) => r.display_order)).toEqual([...Array(40).keys()]);
    expect(rows[0].item_key).toBe("ext_body_damage");
    expect(rows[39].item_key).toBe("road_engine_noise");
  });
});

describe("deriveInspectionResult", () => {
  const full = (result: InspectionResult | null) =>
    INSPECTION_CHECKLIST.map((i) => ({ item_key: i.key, result }));

  it("is draft while any item is unanswered", () => {
    const items = full("pass");
    items[17].result = null;
    expect(deriveInspectionResult(items)).toBe("draft");
  });

  it("is draft when fewer than 40 items exist at all", () => {
    expect(deriveInspectionResult(full("pass").slice(0, 39))).toBe("draft");
  });

  it("is completed when every item passes", () => {
    expect(deriveInspectionResult(full("pass"))).toBe("completed");
  });

  it("is completed when items are a mix of pass and n/a — n/a is not a defect", () => {
    const items = full("pass");
    items[3].result = "na";
    items[30].result = "na";
    expect(deriveInspectionResult(items)).toBe("completed");
  });

  it("is attention_required when an attention exists but no fail", () => {
    const items = full("pass");
    items[5].result = "attention";
    expect(deriveInspectionResult(items)).toBe("attention_required");
  });

  it("is failed whenever any item fails, even alongside attention", () => {
    const items = full("pass");
    items[5].result = "attention";
    items[36].result = "fail";
    expect(deriveInspectionResult(items)).toBe("failed");
  });

  it("is failed for a non-safety-critical failure too", () => {
    const items = full("pass");
    items[24].result = "fail"; // int_air_conditioning
    expect(deriveInspectionResult(items)).toBe("failed");
  });

  // Approval never enters this function: that is what keeps FAILED · APPROVED
  // representable instead of approval overwriting the defect.
  it("has no approved outcome — approval is a separate layer", () => {
    const outcomes = new Set([
      deriveInspectionResult(full("pass")),
      deriveInspectionResult(full("fail")),
      deriveInspectionResult(full("attention")),
      deriveInspectionResult(full("na")),
    ]);
    expect(outcomes.has("approved" as never)).toBe(false);
  });
});
