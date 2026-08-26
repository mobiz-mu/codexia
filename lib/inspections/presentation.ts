import {
  CHECKLIST_ITEM_COUNT,
  INSPECTION_CHECKLIST,
  getChecklistItem,
  isSafetyCriticalKey,
  type InspectionResult,
} from "@/lib/fleet/inspection-checklist";

/**
 * Presentation rules for weekly inspections, kept out of the components so
 * they can be tested without rendering and so the list, the detail dossier
 * and (later) the PDF all describe an inspection identically.
 *
 * Nothing here decides anything: the server derives the result and this only
 * chooses how to say it. Every badge carries a text label and a glyph, never
 * colour alone.
 */

export type DerivedResult = "draft" | "completed" | "attention_required" | "failed";

export type ResultBadge = {
  label: string;
  glyph: string;
  /** Token classes only — semantic feedback tokens, never board-status ones. */
  className: string;
  description: string;
};

export const RESULT_BADGES: Record<DerivedResult, ResultBadge> = {
  draft: {
    label: "In progress",
    glyph: "…",
    className: "bg-ops-panel-3 text-ops-ink-2 border border-ops-line",
    description: "Not every checklist item has been answered yet",
  },
  completed: {
    label: "Passed",
    glyph: "✓",
    className: "bg-ops-success/15 text-ops-success border border-ops-success/40",
    description: "Every item answered with no defects",
  },
  attention_required: {
    label: "Attention required",
    glyph: "!",
    className: "bg-ops-warning/15 text-ops-warning border border-ops-warning/40",
    description: "Follow-up needed, vehicle may stay in service",
  },
  failed: {
    label: "Failed",
    glyph: "✕",
    className: "bg-ops-danger/15 text-ops-danger border border-ops-danger/40",
    description: "One or more defects require action",
  },
};

/**
 * Approval is rendered as its OWN badge, never merged into the result, so a
 * reviewed failure reads "Failed · Approved" rather than turning green.
 */
export function approvalBadge(approvedAt: string | null | undefined): ResultBadge {
  return approvedAt
    ? {
        label: "Approved",
        glyph: "✓",
        className: "bg-ops-info/15 text-ops-info border border-ops-info/40",
        description: "Signed off by a fleet manager",
      }
    : {
        label: "Not approved",
        glyph: "–",
        className: "bg-ops-panel-3 text-ops-ink-3 border border-ops-line",
        description: "Awaiting fleet manager review",
      };
}

export type ItemAnswer = { item_key: string; result: InspectionResult | null; remarks?: string | null };

export type ChecklistSummary = {
  pass: number;
  attention: number;
  fail: number;
  na: number;
  unanswered: number;
  answered: number;
  total: number;
  /** e.g. "37 / 40 checked" */
  progressLabel: string;
  complete: boolean;
  safetyFailures: string[];
};

export function summariseChecklist(items: ItemAnswer[]): ChecklistSummary {
  const count = (r: InspectionResult) => items.filter((i) => i.result === r).length;
  const pass = count("pass");
  const attention = count("attention");
  const fail = count("fail");
  const na = count("na");
  const unanswered = items.filter((i) => i.result === null).length;
  const answered = items.length - unanswered;
  // Missing rows count as unfinished too, not merely unanswered ones.
  const expected = Math.max(items.length, CHECKLIST_ITEM_COUNT);

  return {
    pass,
    attention,
    fail,
    na,
    unanswered,
    answered,
    total: items.length,
    progressLabel: `${answered} / ${expected} checked`,
    complete: answered === expected && unanswered === 0,
    safetyFailures: items.filter((i) => i.result === "fail" && isSafetyCriticalKey(i.item_key)).map((i) => i.item_key),
  };
}

export type DefectLine = {
  itemKey: string;
  label: string;
  section: string;
  result: "attention" | "fail";
  remarks: string | null;
  safetyCritical: boolean;
};

/**
 * The Defects / Repairs Required list: every attention and fail item in
 * canonical sheet order, with failures first so the worst reads at the top.
 */
export function defectLines(items: ItemAnswer[]): DefectLine[] {
  const order = new Map(INSPECTION_CHECKLIST.map((item, index) => [item.key, index]));

  return items
    .filter((i) => i.result === "attention" || i.result === "fail")
    .map((i) => {
      const definition = getChecklistItem(i.item_key);
      return {
        itemKey: i.item_key,
        label: definition?.label ?? i.item_key,
        section: definition?.section ?? "",
        result: i.result as "attention" | "fail",
        remarks: i.remarks ?? null,
        safetyCritical: isSafetyCriticalKey(i.item_key),
      };
    })
    .sort((a, b) => {
      if (a.result !== b.result) return a.result === "fail" ? -1 : 1;
      return (order.get(a.itemKey) ?? 0) - (order.get(b.itemKey) ?? 0);
    });
}

/** Items a maintenance follow-up may be raised from. */
export function followUpCandidates(items: ItemAnswer[]): DefectLine[] {
  return defectLines(items);
}

/**
 * Whether the sheet is still editable.
 *
 * Approval freezes an inspection: it is evidence carrying a signature, and
 * changing an answer underneath one would make the approval describe
 * something that no longer exists. The server enforces this too.
 */
export function isInspectionEditable(inspection: { approved_at?: string | null }): boolean {
  return !inspection.approved_at;
}

/** Compact one-line vehicle identity from the historical snapshot. */
export function snapshotIdentity(inspection: {
  vehicle_registration?: string | null;
  vehicle_make_model?: string | null;
}): string {
  return [inspection.vehicle_make_model, inspection.vehicle_registration].filter(Boolean).join(" · ") || "—";
}
