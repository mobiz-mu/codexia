"use client";

import { useMemo, useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  INSPECTION_RESULTS,
  INSPECTION_RESULT_LABELS,
  INSPECTION_SECTION_LABELS,
  INSPECTION_SECTIONS,
  checklistBySection,
  isSafetyCriticalKey,
  type InspectionResult,
} from "@/lib/fleet/inspection-checklist";
import { defectLines, summariseChecklist, type ItemAnswer } from "@/lib/inspections/presentation";
import { bulkPassUnansweredItems, setInspectionItemResult } from "@/lib/actions/admin/inspections";
import { cn } from "@/lib/utils/cn";

/**
 * The inspection sheet itself.
 *
 * Rows are generated from the canonical catalogue — there is deliberately no
 * second checklist array in this file, so the 40 items, their order and their
 * sections can only ever come from one place.
 *
 * Answers are stored optimistically and reconciled by a router refresh, so an
 * operator working down forty rows is never waiting on a round trip; the
 * server remains the authority for the derived result.
 */

const RESULT_STYLES: Record<InspectionResult, { on: string; glyph: string }> = {
  pass: { on: "bg-ops-success text-white border-ops-success", glyph: "✓" },
  attention: { on: "bg-ops-warning text-white border-ops-warning", glyph: "!" },
  fail: { on: "bg-ops-danger text-white border-ops-danger", glyph: "✕" },
  na: { on: "bg-ops-ink-3 text-white border-ops-ink-3", glyph: "–" },
};

export type ChecklistItemState = {
  id: string;
  item_key: string;
  result: InspectionResult | null;
  remarks: string | null;
};

export function InspectionChecklist({
  inspectionId,
  items,
  editable,
}: {
  inspectionId: string;
  items: ChecklistItemState[];
  editable: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [bulkPending, setBulkPending] = useState(false);

  const [optimistic, applyOptimistic] = useOptimistic(
    items,
    (state: ChecklistItemState[], patch: { itemKey: string; result?: InspectionResult | null; remarks?: string }) =>
      state.map((row) =>
        row.item_key === patch.itemKey
          ? {
              ...row,
              result: patch.result !== undefined ? patch.result : row.result,
              remarks: patch.remarks !== undefined ? patch.remarks : row.remarks,
            }
          : row
      )
  );

  const byKey = useMemo(() => new Map(optimistic.map((i) => [i.item_key, i])), [optimistic]);
  const answers: ItemAnswer[] = optimistic.map((i) => ({
    item_key: i.item_key,
    result: i.result,
    remarks: i.remarks,
  }));
  const summary = summariseChecklist(answers);
  const defects = defectLines(answers);

  function save(itemKey: string, result: InspectionResult | null, remarks: string | null) {
    setError(null);
    setBusyKey(itemKey);
    startTransition(async () => {
      applyOptimistic({ itemKey, result });
      const fd = new FormData();
      fd.set("itemKey", itemKey);
      fd.set("result", result ?? "");
      if (remarks) fd.set("remarks", remarks);
      const res = await setInspectionItemResult(inspectionId, fd);
      setBusyKey(null);
      if (!res.ok) setError(res.error ?? "Could not save that answer.");
      router.refresh();
    });
  }

  function saveRemarks(itemKey: string, remarks: string) {
    const current = byKey.get(itemKey);
    if ((current?.remarks ?? "") === remarks) return;
    setError(null);
    startTransition(async () => {
      applyOptimistic({ itemKey, remarks });
      const fd = new FormData();
      fd.set("itemKey", itemKey);
      fd.set("result", current?.result ?? "");
      fd.set("remarks", remarks);
      const res = await setInspectionItemResult(inspectionId, fd);
      if (!res.ok) setError(res.error ?? "Could not save those remarks.");
      router.refresh();
    });
  }

  function markUnansweredPass() {
    if (
      !confirm(
        `Mark the ${summary.unanswered} unanswered item(s) as Pass? Items already marked Attention, Fail or N/A are left exactly as they are.`
      )
    ) {
      return;
    }
    setError(null);
    setBulkPending(true);
    startTransition(async () => {
      const res = await bulkPassUnansweredItems(inspectionId);
      setBulkPending(false);
      if (!res.ok) setError(res.error ?? "Could not mark the remaining items.");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {/* --- progress + safety ------------------------------------------ */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-sm border border-ops-line bg-ops-panel-2 px-3 py-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="text-[13px] font-bold tabular-nums text-ops-ink">{summary.progressLabel}</span>
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold uppercase tracking-wide">
            <Count label="Pass" value={summary.pass} tone="text-ops-success" />
            <Count label="Attention" value={summary.attention} tone="text-ops-warning" />
            <Count label="Fail" value={summary.fail} tone="text-ops-danger" />
            <Count label="N/A" value={summary.na} tone="text-ops-ink-3" />
            <Count label="Unanswered" value={summary.unanswered} tone="text-ops-ink-2" />
          </span>
        </div>
        {editable && summary.unanswered > 0 ? (
          <button
            type="button"
            onClick={markUnansweredPass}
            disabled={bulkPending}
            className="rounded-sm border border-ops-header bg-ops-header px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.06em] text-white hover:bg-ops-header-2 disabled:opacity-50"
          >
            {bulkPending ? "Marking…" : `Mark ${summary.unanswered} unanswered as pass`}
          </button>
        ) : null}
      </div>

      {summary.safetyFailures.length > 0 ? (
        <div
          role="alert"
          className="flex flex-wrap items-start gap-2 rounded-sm border-l-[3px] border-ops-danger bg-ops-danger/10 px-3 py-2"
        >
          <span aria-hidden="true" className="text-[13px] font-bold text-ops-danger">
            ✕
          </span>
          <div className="min-w-0">
            <p className="text-[12px] font-bold uppercase tracking-[0.06em] text-ops-danger">
              Vehicle safety failure
            </p>
            <p className="mt-0.5 text-[12px] text-ops-ink-2">
              {summary.safetyFailures.length} safety-critical{" "}
              {summary.safetyFailures.length === 1 ? "check has" : "checks have"} failed. The vehicle may be unsafe to
              rent — use{" "}
              <strong className="text-ops-ink">Mark vehicle unavailable</strong> below if it should come off the road.
              Nothing has been blocked automatically.
            </p>
          </div>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-[12px] font-medium text-ops-danger">
          {error}
        </p>
      ) : null}

      {/* --- the sheet --------------------------------------------------- */}
      {checklistBySection().map((group) => (
        <section key={group.section} className="overflow-hidden rounded-sm border border-ops-line">
          <h3 className="bg-ops-header px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-white">
            {group.label}
          </h3>
          <div className="w-full overflow-x-auto">
            <table className="w-full border-collapse text-[13px]" style={{ minWidth: "46rem" }}>
              <thead className="bg-ops-panel-3">
                <tr>
                  <th scope="col" className="w-[38%] px-2.5 py-1 text-left text-[10px] font-bold uppercase tracking-wide text-ops-ink-2">
                    Inspection item
                  </th>
                  <th scope="col" className="w-[15rem] px-2.5 py-1 text-left text-[10px] font-bold uppercase tracking-wide text-ops-ink-2">
                    Result
                  </th>
                  <th scope="col" className="px-2.5 py-1 text-left text-[10px] font-bold uppercase tracking-wide text-ops-ink-2">
                    Remarks
                  </th>
                </tr>
              </thead>
              <tbody>
                {group.items.map((definition, index) => {
                  const row = byKey.get(definition.key);
                  const critical = isSafetyCriticalKey(definition.key);
                  const failed = row?.result === "fail";
                  return (
                    <tr
                      key={definition.key}
                      className={cn(
                        "border-t border-ops-line/60",
                        index % 2 === 1 && "bg-ops-panel-2/60",
                        failed && critical && "bg-ops-danger/10"
                      )}
                    >
                      <th scope="row" className="px-2.5 py-1.5 text-left align-middle font-normal text-ops-ink">
                        <span className="flex items-start gap-1.5">
                          <span className="min-w-0">{definition.label}</span>
                          {critical ? (
                            <span
                              className="mt-px shrink-0 rounded-[2px] border border-ops-danger/40 px-1 text-[9px] font-bold uppercase tracking-wide text-ops-danger"
                              title="Safety-critical: a failure here may make the vehicle unsafe to rent"
                            >
                              Safety
                            </span>
                          ) : null}
                        </span>
                      </th>
                      <td className="px-2.5 py-1.5 align-middle">
                        <fieldset className="flex flex-wrap gap-1">
                          {/* The item label IS the group's accessible name, so a
                              screen reader announces which check is being set. */}
                          <legend className="sr-only">
                            {definition.label}
                            {critical ? " (safety-critical)" : ""}
                          </legend>
                          {INSPECTION_RESULTS.map((value) => {
                            const selected = row?.result === value;
                            return (
                              <label
                                key={value}
                                className={cn(
                                  "inline-flex cursor-pointer items-center gap-1 rounded-sm border text-[11px] font-semibold",
                                  // Comfortable to tap on a tablet in a yard,
                                  // tight enough to keep the sheet dense on a
                                  // desktop where the whole list is scanned.
                                  "min-h-[34px] px-2 py-1 sm:min-h-0 sm:px-1.5 sm:py-0.5",
                                  "focus-within:ring-2 focus-within:ring-ops-accent",
                                  selected
                                    ? RESULT_STYLES[value].on
                                    : "border-ops-line bg-white text-ops-ink-2 hover:border-ops-accent",
                                  !editable && "cursor-default opacity-70"
                                )}
                              >
                                <input
                                  type="radio"
                                  className="sr-only"
                                  name={`result-${definition.key}`}
                                  value={value}
                                  checked={selected}
                                  disabled={!editable || busyKey === definition.key}
                                  onChange={() => save(definition.key, value, row?.remarks ?? null)}
                                />
                                <span aria-hidden="true">{RESULT_STYLES[value].glyph}</span>
                                <span>{INSPECTION_RESULT_LABELS[value]}</span>
                              </label>
                            );
                          })}
                          {/* An operator who mis-clicks needs a way back to
                              "not yet answered" — without this the four radios
                              are one-way and a wrong answer can only be
                              replaced, never withdrawn. Shown only once the
                              item actually has an answer. */}
                          {editable && row?.result ? (
                            <button
                              type="button"
                              onClick={() => save(definition.key, null, row?.remarks ?? null)}
                              disabled={busyKey === definition.key}
                              aria-label={`Clear the answer for ${definition.label}`}
                              title="Clear this answer"
                              className="inline-flex min-h-[34px] items-center rounded-sm border border-dashed border-ops-line px-2 text-[11px] font-semibold text-ops-ink-3 hover:border-ops-accent hover:text-ops-header disabled:opacity-50 sm:min-h-0 sm:py-0.5"
                            >
                              Clear
                            </button>
                          ) : null}
                        </fieldset>
                      </td>
                      <td className="px-2.5 py-1.5 align-middle">
                        <input
                          type="text"
                          aria-label={`Remarks for ${definition.label}`}
                          defaultValue={row?.remarks ?? ""}
                          disabled={!editable}
                          onBlur={(e) => editable && saveRemarks(definition.key, e.currentTarget.value.trim())}
                          placeholder="—"
                          className="w-full rounded-sm border border-ops-line bg-white px-2 py-0.5 text-[12px] text-ops-ink outline-none focus:border-ops-accent focus:ring-1 focus:ring-ops-accent disabled:bg-ops-panel-2"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      {/* --- defects ----------------------------------------------------- */}
      <section className="overflow-hidden rounded-sm border border-ops-line">
        <h3 className="bg-ops-header px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-white">
          Defects / repairs required
        </h3>
        <div className="p-3">
          {defects.length === 0 ? (
            <p className="text-[12px] text-ops-ink-3">
              No defects recorded. Items marked Attention or Fail are listed here automatically.
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {defects.map((defect) => (
                <li
                  key={defect.itemKey}
                  className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 border-b border-ops-line/60 pb-1 last:border-b-0 last:pb-0"
                >
                  <span
                    className={cn(
                      "rounded-[2px] px-1 py-px text-[10px] font-bold uppercase tracking-wide text-white",
                      defect.result === "fail" ? "bg-ops-danger" : "bg-ops-warning"
                    )}
                  >
                    {defect.result === "fail" ? "Fail" : "Attention"}
                  </span>
                  <span className="text-[13px] font-semibold text-ops-ink">{defect.label}</span>
                  <span className="text-[11px] uppercase tracking-wide text-ops-ink-3">
                    {INSPECTION_SECTION_LABELS[
                      defect.section as (typeof INSPECTION_SECTIONS)[number]
                    ] ?? defect.section}
                  </span>
                  {defect.safetyCritical ? (
                    <span className="rounded-[2px] border border-ops-danger/40 px-1 text-[9px] font-bold uppercase tracking-wide text-ops-danger">
                      Safety
                    </span>
                  ) : null}
                  {defect.remarks ? (
                    <span className="w-full text-[12px] text-ops-ink-2">{defect.remarks}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

function Count({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <span className={cn("tabular-nums", value > 0 ? tone : "text-ops-ink-3")}>
      {label} {value}
    </span>
  );
}
