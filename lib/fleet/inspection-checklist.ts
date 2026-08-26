/**
 * The canonical Weekly Vehicle Inspection checklist — version 1.
 *
 * This is the single definition of what a weekly inspection asks. The
 * database stores one row per item keyed by `key`; the human label, the
 * section it belongs to, its order on the sheet and whether it is
 * safety-critical all live here, in code, and are never duplicated into the
 * UI or the server actions.
 *
 * `key` is a CONTRACT. Rows referencing these strings outlive any label
 * edit, and every reporting question we care about ("which vehicles keep
 * failing tyre checks?") is a query on `item_key`. Renaming a key after
 * records exist would orphan that history, so keys are append-only: to
 * retire an item, publish a new CHECKLIST_VERSION rather than editing a key.
 *
 * The checklist is deliberately NOT user-configurable in this phase.
 */

export const CHECKLIST_VERSION = 1;

export const INSPECTION_SECTIONS = [
  "exterior",
  "tyres_wheels",
  "engine_fluids",
  "interior",
  "safety_equipment",
  "road_test",
] as const;

export type InspectionSection = (typeof INSPECTION_SECTIONS)[number];

export const INSPECTION_SECTION_LABELS: Record<InspectionSection, string> = {
  exterior: "Exterior",
  tyres_wheels: "Tyres & wheels",
  engine_fluids: "Engine & fluids",
  interior: "Interior",
  safety_equipment: "Safety equipment",
  road_test: "Road test",
};

export const INSPECTION_RESULTS = ["pass", "attention", "fail", "na"] as const;
export type InspectionResult = (typeof INSPECTION_RESULTS)[number];

export const INSPECTION_RESULT_LABELS: Record<InspectionResult, string> = {
  pass: "Pass",
  attention: "Attention",
  fail: "Fail",
  na: "N/A",
};

export type ChecklistItem = {
  key: string;
  section: InspectionSection;
  label: string;
  /**
   * A failure here can make the vehicle unsafe to rent, so the UI raises a
   * prominent safety warning and offers to take the car off the road. It
   * NEVER creates downtime on its own — the operator decides.
   */
  safetyCritical?: true;
};

/**
 * Order within this array is the order on the sheet and in the PDF. It is
 * asserted to be deterministic and section-contiguous by the tests.
 */
export const INSPECTION_CHECKLIST: readonly ChecklistItem[] = [
  // --- Exterior -----------------------------------------------------------
  { key: "ext_body_damage", section: "exterior", label: "Body free from major damage" },
  { key: "ext_windshield_windows", section: "exterior", label: "Windshield and windows clean / no cracks" },
  { key: "ext_mirrors", section: "exterior", label: "Mirrors secure and in good condition" },
  { key: "ext_wiper_blades", section: "exterior", label: "Wiper blades operating correctly" },
  { key: "ext_headlights", section: "exterior", label: "Headlights working", safetyCritical: true },
  { key: "ext_brake_lights", section: "exterior", label: "Brake lights working", safetyCritical: true },
  { key: "ext_indicators", section: "exterior", label: "Indicators working", safetyCritical: true },
  { key: "ext_reverse_lights", section: "exterior", label: "Reverse lights working" },
  { key: "ext_number_plates", section: "exterior", label: "Number plates secure and visible" },

  // --- Tyres & wheels -----------------------------------------------------
  { key: "tyre_front_tread", section: "tyres_wheels", label: "Front tyres — good tread", safetyCritical: true },
  { key: "tyre_rear_tread", section: "tyres_wheels", label: "Rear tyres — good tread", safetyCritical: true },
  { key: "tyre_pressure_checked", section: "tyres_wheels", label: "Tyre pressure checked" },
  { key: "tyre_spare_condition", section: "tyres_wheels", label: "Spare tyre in good condition" },
  { key: "tyre_wheel_nuts", section: "tyres_wheels", label: "Wheel nuts secure", safetyCritical: true },

  // --- Engine & fluids ----------------------------------------------------
  { key: "eng_oil_level", section: "engine_fluids", label: "Engine oil level" },
  { key: "eng_coolant_level", section: "engine_fluids", label: "Coolant level" },
  { key: "eng_brake_fluid", section: "engine_fluids", label: "Brake fluid level", safetyCritical: true },
  { key: "eng_power_steering_fluid", section: "engine_fluids", label: "Power steering fluid" },
  { key: "eng_washer_fluid", section: "engine_fluids", label: "Windscreen washer fluid" },
  { key: "eng_no_fluid_leaks", section: "engine_fluids", label: "No visible fluid leaks", safetyCritical: true },
  { key: "eng_battery_terminals", section: "engine_fluids", label: "Battery terminals clean and secure" },

  // --- Interior -----------------------------------------------------------
  { key: "int_seat_belts", section: "interior", label: "Seat belts functioning", safetyCritical: true },
  { key: "int_horn", section: "interior", label: "Horn working" },
  { key: "int_warning_lights", section: "interior", label: "Dashboard warning lights checked", safetyCritical: true },
  { key: "int_air_conditioning", section: "interior", label: "Air conditioning operating" },
  { key: "int_speedometer", section: "interior", label: "Speedometer functioning" },
  { key: "int_fuel_level", section: "interior", label: "Fuel level recorded" },

  // --- Safety equipment ---------------------------------------------------
  // "Present and in date" is recorded here as a visual check only. Compliance
  // remains the authoritative register for document numbers, issue dates,
  // expiry dates and renewal history — there is exactly one expiry engine.
  { key: "safe_fire_extinguisher", section: "safety_equipment", label: "Fire extinguisher present and in date" },
  { key: "safe_first_aid_kit", section: "safety_equipment", label: "First aid kit available" },
  { key: "safe_yellow_chalk", section: "safety_equipment", label: "Yellow chalk" },
  { key: "safe_accident_agreement", section: "safety_equipment", label: "Accident Agreement Facts" },
  { key: "safe_psvl_licence", section: "safety_equipment", label: "PSVL Licence" },
  { key: "safe_warning_triangle", section: "safety_equipment", label: "Warning triangle available" },
  { key: "safe_reflective_vest", section: "safety_equipment", label: "Reflective vest available" },
  { key: "safe_jack_spanner", section: "safety_equipment", label: "Jack and wheel spanner available" },

  // --- Road test ----------------------------------------------------------
  { key: "road_brakes", section: "road_test", label: "Brakes operating correctly", safetyCritical: true },
  { key: "road_steering", section: "road_test", label: "Steering normal", safetyCritical: true },
  { key: "road_suspension", section: "road_test", label: "Suspension normal" },
  { key: "road_clutch_gearbox", section: "road_test", label: "Clutch / gearbox functioning" },
  { key: "road_engine_noise", section: "road_test", label: "No unusual engine noise" },
] as const;

/** Version 1 contract: exactly this many items, asserted by the tests. */
export const CHECKLIST_ITEM_COUNT = 40;

const BY_KEY = new Map(INSPECTION_CHECKLIST.map((item) => [item.key, item]));

export function getChecklistItem(key: string): ChecklistItem | undefined {
  return BY_KEY.get(key);
}

export function isSafetyCriticalKey(key: string): boolean {
  return BY_KEY.get(key)?.safetyCritical === true;
}

/** Items grouped for rendering, in sheet order, without re-sorting at render time. */
export function checklistBySection(): { section: InspectionSection; label: string; items: ChecklistItem[] }[] {
  return INSPECTION_SECTIONS.map((section) => ({
    section,
    label: INSPECTION_SECTION_LABELS[section],
    items: INSPECTION_CHECKLIST.filter((item) => item.section === section),
  }));
}

/**
 * The rows to insert when an inspection is created — all 40, in order, in one
 * bulk insert rather than forty round trips. `display_order` is the index in
 * the canonical array so the sheet renders without needing the code catalogue
 * to sort it back.
 *
 * Every item starts with a NULL result, meaning "not yet answered". Seeding
 * them as `pass` would silently produce a clean inspection nobody performed;
 * bulk-pass is an explicit operator action, never a default.
 */
export function buildInspectionItemRows(inspectionId: string) {
  return INSPECTION_CHECKLIST.map((item, index) => ({
    inspection_id: inspectionId,
    section: item.section,
    item_key: item.key,
    display_order: index,
    result: null as InspectionResult | null,
  }));
}

/**
 * The inspection's operational result, derived from its items and never set
 * by the UI. Approval is a separate layer precisely so this value survives
 * sign-off: an approved inspection that failed still reads `failed`.
 */
export type DerivedInspectionResult = "draft" | "completed" | "attention_required" | "failed";

export function deriveInspectionResult(
  items: { result: InspectionResult | null }[]
): DerivedInspectionResult {
  // Guard against a partially seeded inspection as well as unanswered items:
  // fewer than the full checklist means the sheet is not finished.
  if (items.length < CHECKLIST_ITEM_COUNT) return "draft";
  if (items.some((i) => i.result === null)) return "draft";

  if (items.some((i) => i.result === "fail")) return "failed";
  if (items.some((i) => i.result === "attention")) return "attention_required";

  // Everything answered as pass or n/a. N/A never counts as a defect.
  return "completed";
}

/** Failed items whose failure means the vehicle may be unsafe to rent. */
export function safetyCriticalFailures(
  items: { item_key: string; result: InspectionResult | null }[]
): string[] {
  return items.filter((i) => i.result === "fail" && isSafetyCriticalKey(i.item_key)).map((i) => i.item_key);
}
