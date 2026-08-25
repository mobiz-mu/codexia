import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getComplianceDossier } from "@/lib/actions/admin/compliance";
import {
  COMPLIANCE_STATUS_LABELS,
  computeComplianceStatus,
  type ComplianceStatus,
} from "@/lib/compliance/status";
import { formatMoney } from "@/lib/pricing/format";
import { missingDocumentTypes, sortByUrgency } from "@/lib/fleet/compliance-dossier";
import { OpsPanel } from "@/components/admin/ops/OpsPanel";
import { OpsTable, OpsTbody, OpsTd, OpsTh, OpsThead, OpsTr, OpsEmptyRow } from "@/components/admin/ops/OpsTable";
import { VehicleIdentity } from "@/components/admin/ops/VehicleIdentity";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = { title: "Vehicle compliance" };

/**
 * Document types a vehicle is expected to hold. Types not in this list still
 * render (via `other` + custom_type) — this drives the "Missing" rows, so a
 * document that was never entered is visible rather than simply absent.
 */
const EXPECTED_TYPES: { key: string; label: string }[] = [
  { key: "insurance", label: "Insurance" },
  { key: "road_tax", label: "Road tax" },
  { key: "fitness", label: "Fitness / roadworthiness" },
  { key: "psvl", label: "PSVL" },
];

const STATUS_STYLE: Record<ComplianceStatus, string> = {
  expired: "bg-ops-booked text-white",
  expires_today: "bg-ops-booked text-white",
  urgent: "bg-ops-maint text-white",
  warning: "bg-ops-conflict text-ops-ink",
  valid: "bg-ops-agency text-white",
};

const STATUS_GLYPH: Record<ComplianceStatus, string> = {
  expired: "✕",
  expires_today: "!",
  urgent: "!",
  warning: "•",
  valid: "✓",
};

function typeLabel(documentType: string, customType: string | null) {
  if (documentType === "other") return customType || "Other";
  return EXPECTED_TYPES.find((t) => t.key === documentType)?.label ?? documentType.replace(/_/g, " ");
}

export default async function VehicleCompliancePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const dossier = await getComplianceDossier(id);
  if (!dossier.vehicle) notFound();

  const v = dossier.vehicle;

  // Current documents, worst status first, then the expected types that have
  // no record at all so a gap is as visible as an expiry.
  const rows = sortByUrgency(
    dossier.current.map((c) => ({ record: c, expiryDate: c.expiry_date }))
  ).map(({ record }) => {
    const { status, daysRemaining } = computeComplianceStatus(record.expiry_date);
    return { record, status, daysRemaining };
  });

  const missingKeys = missingDocumentTypes(
    dossier.current.map((c) => ({
      id: c.id,
      documentType: c.document_type,
      customType: c.custom_type,
      expiryDate: c.expiry_date,
    }))
  );
  const missing = EXPECTED_TYPES.filter((t) => missingKeys.includes(t.key));

  return (
    <div className="flex flex-col gap-3">
      <OpsPanel title="Vehicle compliance" subtitle="Every document held for this vehicle">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <VehicleIdentity
            size="lg"
            vehicle={{
              id: v.id,
              name: v.name,
              subtitle: `${v.brand} ${v.model}`,
              transmission: v.transmission,
              registration: v.internal_registration_ref,
              isStaffCar: v.is_staff_car,
            }}
          />
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/admin/compliance/new?vehicle=${v.id}`}
              className="rounded-sm bg-ops-header px-3 py-1.5 text-[12px] font-bold uppercase tracking-[0.06em] text-white hover:bg-ops-header-2"
            >
              Add document
            </Link>
            <Link
              href="/admin/compliance"
              className="rounded-sm border border-ops-line px-3 py-1.5 text-[12px] font-semibold text-ops-ink-2 hover:border-ops-accent"
            >
              All vehicles
            </Link>
          </div>
        </div>
      </OpsPanel>

      <OpsPanel title="Current documents" flush>
        <OpsTable minWidth="60rem">
          <OpsThead>
            <OpsTr>
              <OpsTh width="14rem">Document</OpsTh>
              <OpsTh>Reference</OpsTh>
              <OpsTh>Provider</OpsTh>
              <OpsTh width="8rem">Issued</OpsTh>
              <OpsTh width="8rem">Expires</OpsTh>
              <OpsTh width="11rem">Status</OpsTh>
              <OpsTh align="right" width="8rem">
                Cost
              </OpsTh>
              <OpsTh align="right" width="6rem">
                Actions
              </OpsTh>
            </OpsTr>
          </OpsThead>
          <OpsTbody>
            {rows.length === 0 && missing.length === 0 ? (
              <OpsEmptyRow colSpan={8}>No documents recorded for this vehicle.</OpsEmptyRow>
            ) : null}

            {rows.map((r, i) => (
              <OpsTr key={r.record.id} zebra={i} highlight={r.status === "expired"}>
                <OpsTd className="font-semibold text-ops-ink">
                  {typeLabel(r.record.document_type, r.record.custom_type)}
                </OpsTd>
                <OpsTd className="font-mono text-[12px]">{r.record.reference_number ?? "—"}</OpsTd>
                <OpsTd className="truncate">{r.record.provider ?? "—"}</OpsTd>
                <OpsTd numeric>{r.record.issued_date ?? "—"}</OpsTd>
                <OpsTd numeric className="font-semibold text-ops-ink">
                  {r.record.expiry_date}
                </OpsTd>
                <OpsTd>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.04em]",
                      STATUS_STYLE[r.status]
                    )}
                  >
                    <span aria-hidden="true">{STATUS_GLYPH[r.status]}</span>
                    {COMPLIANCE_STATUS_LABELS[r.status]}
                  </span>
                  <span className="ml-1 text-[11px] text-ops-ink-3">
                    {r.daysRemaining < 0
                      ? `${Math.abs(r.daysRemaining)}d overdue`
                      : r.daysRemaining === 0
                        ? "today"
                        : `${r.daysRemaining}d left`}
                  </span>
                </OpsTd>
                <OpsTd align="right" numeric>
                  {/* Compliance fees are paid locally, in rupees. */}
                  {r.record.cost_cents ? formatMoney(r.record.cost_cents, "MUR", "en") : "—"}
                </OpsTd>
                <OpsTd align="right">
                  <Link
                    href={`/admin/compliance/${r.record.id}?from=vehicle`}
                    className="rounded-sm border border-ops-line px-1.5 py-0.5 text-[11px] font-semibold text-ops-ink-2 hover:border-ops-accent hover:text-ops-header"
                  >
                    Open
                  </Link>
                </OpsTd>
              </OpsTr>
            ))}

            {missing.map((t, i) => (
              // A document that was never entered is a compliance gap, not an
              // empty cell — it gets a row of its own.
              <OpsTr key={t.key} zebra={rows.length + i}>
                <OpsTd className="font-semibold text-ops-ink">{t.label}</OpsTd>
                <OpsTd colSpan={4} className="text-ops-ink-3">
                  No record held
                </OpsTd>
                <OpsTd>
                  <span className="inline-flex items-center gap-1 rounded-sm border border-ops-line bg-ops-panel-2 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.04em] text-ops-ink-2">
                    <span aria-hidden="true">○</span> Missing
                  </span>
                </OpsTd>
                <OpsTd align="right">—</OpsTd>
                <OpsTd align="right">
                  <Link
                    href={`/admin/compliance/new?vehicle=${v.id}&type=${t.key}`}
                    className="rounded-sm border border-ops-line px-1.5 py-0.5 text-[11px] font-semibold text-ops-header hover:border-ops-accent"
                  >
                    Add
                  </Link>
                </OpsTd>
              </OpsTr>
            ))}
          </OpsTbody>
        </OpsTable>
      </OpsPanel>

      {dossier.history.length > 0 ? (
        <OpsPanel title="Renewal history" subtitle="Superseded records, kept for audit" flush>
          <OpsTable minWidth="48rem">
            <OpsThead>
              <OpsTr>
                <OpsTh width="14rem">Document</OpsTh>
                <OpsTh>Reference</OpsTh>
                <OpsTh width="8rem">Issued</OpsTh>
                <OpsTh width="8rem">Expired</OpsTh>
                <OpsTh align="right" width="8rem">
                  Cost
                </OpsTh>
              </OpsTr>
            </OpsThead>
            <OpsTbody>
              {dossier.history.map((h, i) => (
                <OpsTr key={h.id} zebra={i}>
                  <OpsTd>{typeLabel(h.document_type, h.custom_type)}</OpsTd>
                  <OpsTd className="font-mono text-[12px]">{h.reference_number ?? "—"}</OpsTd>
                  <OpsTd numeric>{h.issued_date ?? "—"}</OpsTd>
                  <OpsTd numeric>{h.expiry_date}</OpsTd>
                  <OpsTd align="right" numeric>
                    {h.cost_cents ? formatMoney(h.cost_cents, "MUR", "en") : "—"}
                  </OpsTd>
                </OpsTr>
              ))}
            </OpsTbody>
          </OpsTable>
        </OpsPanel>
      ) : null}
    </div>
  );
}
