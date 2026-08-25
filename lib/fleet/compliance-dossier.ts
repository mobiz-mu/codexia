import {
  COMPLIANCE_STATUS_SORT_ORDER,
  computeComplianceStatus,
  type ComplianceStatus,
} from "@/lib/compliance/status";

/**
 * Grouping rules for the vehicle compliance dossier.
 *
 * Pure so the ordering and the "worst status" rule can be tested directly —
 * both are easy to get subtly wrong, and both are what a fleet manager
 * actually acts on.
 */

export type DossierRecord = {
  id: string;
  documentType: string;
  customType: string | null;
  expiryDate: string;
};

/** Document types a roadworthy rental vehicle is expected to hold. */
export const EXPECTED_DOCUMENT_TYPES = ["insurance", "road_tax", "fitness", "psvl"] as const;

/**
 * A vehicle's headline status is its WORST document.
 *
 * A car with valid insurance and expired road tax is not "valid" — it is not
 * legally rentable, and the fleet list must say so.
 */
export function worstStatus(expiryDates: string[], today?: string | Date): ComplianceStatus | null {
  if (expiryDates.length === 0) return null;
  return expiryDates
    .map((d) => computeComplianceStatus(d, today).status)
    .reduce((a, b) => (COMPLIANCE_STATUS_SORT_ORDER[a] <= COMPLIANCE_STATUS_SORT_ORDER[b] ? a : b));
}

/** Expected types with no current record — a gap is as actionable as an expiry. */
export function missingDocumentTypes(records: DossierRecord[]): string[] {
  const present = new Set(records.map((r) => r.documentType));
  return EXPECTED_DOCUMENT_TYPES.filter((t) => !present.has(t));
}

/** Current documents, worst first, so what needs attention is at the top. */
export function sortByUrgency<T extends { expiryDate: string }>(records: T[], today?: string | Date): T[] {
  return [...records].sort((a, b) => {
    const sa = COMPLIANCE_STATUS_SORT_ORDER[computeComplianceStatus(a.expiryDate, today).status];
    const sb = COMPLIANCE_STATUS_SORT_ORDER[computeComplianceStatus(b.expiryDate, today).status];
    return sa - sb || a.expiryDate.localeCompare(b.expiryDate);
  });
}

/**
 * Split a vehicle's full record set into the current document per type and
 * the superseded ones.
 *
 * "Current" is the latest expiry per document type — a renewed road tax
 * supersedes last year's, which stays visible as history rather than
 * appearing twice with no indication which one counts.
 */
export function splitCurrentAndHistory<T extends DossierRecord>(records: T[]): { current: T[]; history: T[] } {
  const bestByType = new Map<string, T>();
  for (const r of records) {
    const key = r.documentType === "other" ? `other:${r.customType ?? ""}` : r.documentType;
    const existing = bestByType.get(key);
    if (!existing || r.expiryDate > existing.expiryDate) bestByType.set(key, r);
  }
  const currentIds = new Set([...bestByType.values()].map((r) => r.id));
  return {
    current: [...bestByType.values()],
    history: records.filter((r) => !currentIds.has(r.id)),
  };
}
