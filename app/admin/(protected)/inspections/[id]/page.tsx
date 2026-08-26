import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getInspectionAdmin } from "@/lib/actions/admin/inspections";
import { requireAdminUser } from "@/lib/auth/get-current-admin-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { InspectionChecklist } from "@/components/admin/inspections/InspectionChecklist";
import {
  InspectionApprovalBadge,
  InspectionResultBadge,
} from "@/components/admin/inspections/InspectionBadges";
import { InspectionAttachmentsPanel } from "@/components/admin/inspections/InspectionAttachmentsPanel";
import { InspectionDeleteButton } from "@/components/admin/inspections/InspectionDeleteButton";
import {
  CompleteInspectionPanel,
  InspectionApprovalPanel,
  InspectionDowntimePanel,
  InspectionFollowUpPanel,
} from "@/components/admin/inspections/InspectionWorkflowPanels";
import { OpsPanel, OpsSection } from "@/components/admin/ops/OpsPanel";
import { VehicleIdentity } from "@/components/admin/ops/VehicleIdentity";
import {
  RESULT_BADGES,
  followUpCandidates,
  isInspectionEditable,
  summariseChecklist,
  type DerivedResult,
} from "@/lib/inspections/presentation";

export const metadata: Metadata = { title: "Weekly Inspection" };

type InspectionVehicle = {
  name: string;
  brand: string | null;
  model: string | null;
  transmission: "manual" | "automatic" | null;
  internal_registration_ref: string | null;
};

/** Reads a `[start,end)` tstzrange literal into two Mauritius-local strings. */
function readBlockPeriod(period: string): { startAt: string; endAt: string } | null {
  const match = /\[([^,]+),([^)]+)\)/.exec(period);
  if (!match) return null;
  const clean = (raw: string) => raw.trim().replace(/^"|"$/g, "");
  const format = (raw: string) => {
    const at = new Date(clean(raw).replace(" ", "T"));
    if (Number.isNaN(at.getTime())) return clean(raw);
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: "Indian/Mauritius",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(at);
  };
  return { startAt: format(match[1]), endAt: format(match[2]) };
}

export default async function InspectionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAdminUser();

  const { record, items, attachments, followUps, counts, safetyFailures } = await getInspectionAdmin(id);
  if (!record) notFound();

  const r = record as unknown as {
    id: string;
    vehicle_id: string;
    vehicles?: InspectionVehicle | null;
    approver?: { full_name: string | null } | null;
    week_ending: string;
    inspection_date: string;
    odometer_km: number;
    checklist_version: number;
    company_name: string | null;
    vehicle_registration: string | null;
    vehicle_make_model: string | null;
    driver_name: string | null;
    driver_acknowledged_on: string | null;
    inspector_name: string | null;
    inspector_acknowledged_on: string | null;
    approved_at: string | null;
    approval_remarks: string | null;
    result: DerivedResult;
    defects_notes: string | null;
    availability_block_id: string | null;
  };

  const editable = isInspectionEditable(r);
  const canApprove = user.permissions.has("approve_inspections");
  const summary = summariseChecklist(items.map((i) => ({ item_key: i.item_key, result: i.result, remarks: i.remarks })));
  const candidates = followUpCandidates(
    items.map((i) => ({ item_key: i.item_key, result: i.result, remarks: i.remarks }))
  );

  // One extra bounded read for the linked block, only when there is one.
  let block: { id: string; type: string; startAt: string; endAt: string } | null = null;
  if (r.availability_block_id) {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("vehicle_blocks")
      .select("id, type, period")
      .eq("id", r.availability_block_id)
      .maybeSingle();
    if (data) {
      const period = readBlockPeriod(data.period as unknown as string);
      block = { id: data.id, type: data.type, startAt: period?.startAt ?? "—", endAt: period?.endAt ?? "—" };
    }
  }

  const v = r.vehicles ?? null;

  return (
    <div className="flex flex-col gap-3">
      {/* --- identity header ------------------------------------------- */}
      <OpsPanel
        title="Weekly vehicle inspection"
        subtitle={`Week ending ${r.week_ending} · Inspected ${r.inspection_date} · Checklist v${r.checklist_version}`}
        actions={
          <>
            {editable && r.result === "draft" ? (
              <InspectionDeleteButton inspectionId={r.id} redirectTo="/admin/inspections" />
            ) : null}
            <Link
              href="/admin/inspections"
              className="rounded-sm bg-white px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.06em] text-ops-header hover:bg-ops-panel-2"
            >
              Back to list
            </Link>
          </>
        }
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-wrap items-start gap-4">
            {v ? (
              <VehicleIdentity
                size="lg"
                vehicle={{
                  id: r.vehicle_id,
                  name: v.name,
                  subtitle: [v.brand, v.model].filter(Boolean).join(" ") || null,
                  transmission: v.transmission,
                  registration: v.internal_registration_ref,
                }}
              />
            ) : (
              <p className="text-[13px] text-ops-ink-3">Vehicle no longer on the fleet.</p>
            )}
            <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-0.5 text-[12px]">
              <Field label="Company" value={r.company_name} />
              {/* The snapshot, not the live vehicle: what this sheet was signed against. */}
              <Field label="Registration (as inspected)" value={r.vehicle_registration} mono />
              <Field label="Make / model (as inspected)" value={r.vehicle_make_model} />
              <Field label="Odometer" value={`${r.odometer_km.toLocaleString()} km`} mono />
              <Field label="Driver" value={r.driver_name} />
              <Field label="Inspector" value={r.inspector_name} />
            </dl>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <span className="flex flex-wrap items-center gap-1">
              <InspectionResultBadge result={r.result} />
              <InspectionApprovalBadge approvedAt={r.approved_at} />
            </span>
            {v ? (
              <Link
                href={`/admin/vehicles/${r.vehicle_id}`}
                className="text-[11px] font-semibold text-ops-header hover:underline"
              >
                Open vehicle record →
              </Link>
            ) : null}
          </div>
        </div>

        {!editable ? (
          <p className="mt-3 rounded-sm border-l-[3px] border-ops-info bg-ops-panel-2 px-2.5 py-1.5 text-[12px] text-ops-ink-2">
            This inspection was approved on{" "}
            <strong className="text-ops-ink">{formatStamp(r.approved_at)}</strong>
            {r.approver?.full_name ? (
              <>
                {" "}
                by <strong className="text-ops-ink">{r.approver.full_name}</strong>
              </>
            ) : null}
            . It is a historical record and can no longer be edited.
          </p>
        ) : null}
      </OpsPanel>

      {/* --- the sheet -------------------------------------------------- */}
      <OpsPanel title="Checklist" subtitle={`${summary.progressLabel} · Checklist version ${r.checklist_version}`} flush>
        <div className="p-3">
          <InspectionChecklist
            inspectionId={r.id}
            items={items.map((i) => ({
              id: i.id,
              item_key: i.item_key,
              result: i.result,
              remarks: i.remarks,
            }))}
            editable={editable}
          />
        </div>
      </OpsPanel>

      {r.defects_notes ? (
        <OpsPanel title="Overall remarks">
          <p className="whitespace-pre-wrap text-[13px] text-ops-ink-2">{r.defects_notes}</p>
        </OpsPanel>
      ) : null}

      {/* --- workflow --------------------------------------------------- */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className="flex flex-col gap-3 lg:col-span-2">
          {editable ? (
            <OpsPanel title="Complete inspection" subtitle="Records the derived result; does not approve">
              <CompleteInspectionPanel inspectionId={r.id} unanswered={summary.unanswered} />
            </OpsPanel>
          ) : null}

          <OpsPanel
            title="Maintenance follow-up"
            subtitle={
              followUps.length > 0
                ? `${followUps.length} job${followUps.length === 1 ? "" : "s"} raised from this inspection`
                : "Raise a job from the recorded defects"
            }
          >
            <InspectionFollowUpPanel
              inspectionId={r.id}
              candidates={candidates}
              followUps={followUps as never[]}
              editable={editable}
            />
          </OpsPanel>

          <OpsPanel
            title="Vehicle availability"
            subtitle={block ? "This inspection is holding the vehicle off the road" : "No downtime raised"}
          >
            <InspectionDowntimePanel inspectionId={r.id} block={block} editable={editable} />
          </OpsPanel>
        </div>

        <div className="flex flex-col gap-3">
          <OpsPanel title="Acknowledgements" subtitle="Typed acknowledgement — not a signature">
            <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-[12px]">
              <Field label="Driver" value={r.driver_name} />
              <Field label="Driver acknowledged" value={r.driver_acknowledged_on} mono />
              <Field label="Inspector" value={r.inspector_name} />
              <Field label="Inspector acknowledged" value={r.inspector_acknowledged_on} mono />
            </dl>
            <p className="mt-2 text-[11px] text-ops-ink-3">
              These are recorded names and dates, not digital signatures.
            </p>
          </OpsPanel>

          <OpsPanel title="Fleet manager approval" subtitle={r.approved_at ? "Signed off" : "Awaiting review"}>
            {r.approved_at ? (
              <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-[12px]">
                <Field label="Result at approval" value={RESULT_BADGES[r.result]?.label ?? r.result} />
                <Field label="Approved by" value={r.approver?.full_name ?? "—"} />
                <Field label="Approved at" value={formatStamp(r.approved_at)} mono />
                <Field label="Remarks" value={r.approval_remarks} />
              </dl>
            ) : (
              <InspectionApprovalPanel
                inspectionId={r.id}
                resultLabel={RESULT_BADGES[r.result]?.label ?? r.result}
                canApprove={canApprove}
              />
            )}
          </OpsPanel>

          <OpsPanel title="Evidence" subtitle="Photos and documents">
            <InspectionAttachmentsPanel
              inspectionId={r.id}
              attachments={attachments as never[]}
              items={items.map((i) => ({ id: i.id, item_key: i.item_key }))}
              editable={editable}
            />
          </OpsPanel>

          <OpsPanel title="Counts" flush>
            <OpsSection>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[12px]">
                <Field label="Pass" value={String(counts.pass)} mono />
                <Field label="Attention" value={String(counts.attention)} mono />
                <Field label="Fail" value={String(counts.fail)} mono />
                <Field label="N/A" value={String(counts.na)} mono />
                <Field label="Unanswered" value={String(counts.unanswered)} mono />
                <Field label="Safety failures" value={String(safetyFailures.length)} mono />
              </dl>
            </OpsSection>
          </OpsPanel>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, mono = false }: { label: string; value: string | null; mono?: boolean }) {
  return (
    <>
      <dt className="text-[10px] font-bold uppercase tracking-wide text-ops-ink-3">{label}</dt>
      <dd className={mono ? "tabular-nums text-ops-ink" : "text-ops-ink"}>{value || "—"}</dd>
    </>
  );
}

function formatStamp(at: string | null): string {
  if (!at) return "—";
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return at;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Indian/Mauritius",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}
