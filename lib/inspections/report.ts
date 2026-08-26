import {
  CHECKLIST_VERSION,
  INSPECTION_SECTION_LABELS,
  checklistBySection,
  getChecklistItem,
  isSafetyCriticalKey,
  type InspectionResult,
  type InspectionSection,
} from "@/lib/fleet/inspection-checklist";
import { RESULT_BADGES, defectLines, summariseChecklist, type DerivedResult } from "@/lib/inspections/presentation";
import { parseFollowUpKey } from "@/lib/inspections/follow-up";

/**
 * The canonical report model for a weekly inspection.
 *
 * The PDF renders THIS — it does not re-read or re-interpret inspection data.
 * Rows come from the canonical 40-item catalogue rather than from whatever
 * happens to be stored, so a sheet always prints the full checklist in its
 * canonical order even if a row were missing; and identity comes from the
 * stored snapshot, never from the live vehicle, because the printed sheet is
 * evidence of what was inspected on the day.
 */

export const REPORT_RESULT_LABELS: Record<InspectionResult | "unanswered", string> = {
  pass: "PASS",
  attention: "ATTENTION",
  fail: "FAIL",
  na: "N/A",
  unanswered: "UNANSWERED",
};

export type ReportRow = {
  itemKey: string;
  label: string;
  result: InspectionResult | "unanswered";
  resultLabel: string;
  remarks: string | null;
  safetyCritical: boolean;
};

export type ReportSection = {
  section: InspectionSection;
  title: string;
  rows: ReportRow[];
};

export type ReportFollowUp = {
  reference: string;
  date: string;
  type: string;
  itemLabels: string[];
};

export type InspectionReport = {
  title: string;
  /** Human-readable reference derived from the id — inspections have no separate number. */
  reference: string;
  company: string;
  registration: string;
  makeModel: string;
  driverName: string;
  weekEnding: string;
  inspectionDate: string;
  odometerLabel: string;
  inspectorName: string;
  checklistVersion: number;

  sections: ReportSection[];
  counts: { pass: number; attention: number; fail: number; na: number; unanswered: number };

  isDraft: boolean;
  resultLabel: string;
  approvalLabel: string;
  approvedBy: string | null;
  approvedAt: string | null;
  approvalRemarks: string | null;

  driverAcknowledgedOn: string | null;
  inspectorAcknowledgedOn: string | null;

  safetyFailures: { itemKey: string; label: string }[];
  defects: { label: string; resultLabel: string; remarks: string | null; safetyCritical: boolean }[];
  defectsNotes: string | null;
  followUps: ReportFollowUp[];
  downtime: { startAt: string; endAt: string; released: boolean } | null;
};

export type InspectionReportInput = {
  id: string;
  company_name?: string | null;
  vehicle_registration?: string | null;
  vehicle_make_model?: string | null;
  driver_name?: string | null;
  week_ending: string;
  inspection_date: string;
  odometer_km: number;
  inspector_name?: string | null;
  checklist_version?: number | null;
  result: DerivedResult;
  defects_notes?: string | null;
  approved_at?: string | null;
  approval_remarks?: string | null;
  approver_name?: string | null;
  driver_acknowledged_on?: string | null;
  inspector_acknowledged_on?: string | null;
};

/** `ff109729-…` becomes `WVI-FF109729`, which an operator can quote on a phone. */
export function inspectionReference(id: string): string {
  return `WVI-${id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

export function buildInspectionReport(input: {
  inspection: InspectionReportInput;
  items: { item_key: string; result: InspectionResult | null; remarks: string | null }[];
  followUps?: {
    id: string;
    maintenance_date: string;
    maintenance_type: string;
    source_inspection_followup_key?: string | null;
  }[];
  downtime?: { startAt: string; endAt: string; released: boolean } | null;
}): InspectionReport {
  const { inspection, items } = input;
  const answers = new Map(items.map((i) => [i.item_key, i]));

  // Driven by the canonical catalogue, never by the stored rows, so the sheet
  // always prints all 40 in canonical order.
  const sections: ReportSection[] = checklistBySection().map((group) => ({
    section: group.section,
    title: INSPECTION_SECTION_LABELS[group.section].toUpperCase(),
    rows: group.items.map((definition) => {
      const stored = answers.get(definition.key);
      const result = stored?.result ?? "unanswered";
      return {
        itemKey: definition.key,
        label: definition.label,
        result,
        resultLabel: REPORT_RESULT_LABELS[result],
        remarks: stored?.remarks ?? null,
        safetyCritical: definition.safetyCritical === true,
      };
    }),
  }));

  const answerList = items.map((i) => ({ item_key: i.item_key, result: i.result, remarks: i.remarks }));
  const summary = summariseChecklist(answerList);

  // Counts are taken from the rows actually PRINTED, not from the stored
  // subset. If a row were missing from storage the sheet still shows it as
  // UNANSWERED, and the totals under the checklist have to agree with the
  // forty lines above them or the document contradicts itself.
  const printedRows = sections.flatMap((section) => section.rows);
  const countOf = (result: string) => printedRows.filter((row) => row.result === result).length;

  return {
    title: "WEEKLY VEHICLE INSPECTION CHECKLIST",
    reference: inspectionReference(inspection.id),
    company: inspection.company_name?.trim() || "—",
    registration: inspection.vehicle_registration?.trim() || "—",
    makeModel: inspection.vehicle_make_model?.trim() || "—",
    driverName: inspection.driver_name?.trim() || "—",
    weekEnding: inspection.week_ending,
    inspectionDate: inspection.inspection_date,
    odometerLabel: `${inspection.odometer_km.toLocaleString("en-GB")} km`,
    inspectorName: inspection.inspector_name?.trim() || "—",
    checklistVersion: inspection.checklist_version ?? CHECKLIST_VERSION,

    sections,
    counts: {
      pass: countOf("pass"),
      attention: countOf("attention"),
      fail: countOf("fail"),
      na: countOf("na"),
      unanswered: countOf("unanswered"),
    },

    isDraft: inspection.result === "draft",
    resultLabel: (RESULT_BADGES[inspection.result]?.label ?? inspection.result).toUpperCase(),
    // Deliberately its own field. Approval never rewrites the result, so a
    // reviewed failure prints FAILED alongside APPROVED.
    approvalLabel: inspection.approved_at ? "APPROVED" : "NOT APPROVED",
    approvedBy: inspection.approver_name?.trim() || null,
    approvedAt: inspection.approved_at ?? null,
    approvalRemarks: inspection.approval_remarks?.trim() || null,

    driverAcknowledgedOn: inspection.driver_acknowledged_on ?? null,
    inspectorAcknowledgedOn: inspection.inspector_acknowledged_on ?? null,

    // Safety classification comes from the catalogue, never from label text.
    safetyFailures: summary.safetyFailures.map((key) => ({
      itemKey: key,
      label: getChecklistItem(key)?.label ?? key,
    })),
    defects: defectLines(answerList).map((d) => ({
      label: d.label,
      resultLabel: REPORT_RESULT_LABELS[d.result],
      remarks: d.remarks,
      safetyCritical: d.safetyCritical,
    })),
    defectsNotes: inspection.defects_notes?.trim() || null,
    followUps: (input.followUps ?? []).map((f) => ({
      reference: `MTN-${f.id.replace(/-/g, "").slice(0, 8).toUpperCase()}`,
      date: f.maintenance_date,
      type: f.maintenance_type.replace(/_/g, " "),
      itemLabels: parseFollowUpKey(f.source_inspection_followup_key).map(
        (k) => getChecklistItem(k)?.label ?? k
      ),
    })),
    downtime: input.downtime ?? null,
  };
}

export { isSafetyCriticalKey };
