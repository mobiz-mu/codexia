import { getChecklistItem } from "@/lib/fleet/inspection-checklist";

/**
 * The stable identity of "this exact inspection follow-up".
 *
 * A maintenance job raised from an inspection is identified by WHICH DEFECTS
 * it covers, and nothing else. The key is therefore derived only from
 * canonical `item_key` values — never from the human description.
 *
 * The description was the previous guard and is the wrong identity for three
 * reasons: it embeds display labels, which are presentation and could be
 * translated; it embeds per-item remarks, which an operator can edit at any
 * time, so the same selection would silently stop matching itself; and its
 * formatting is a rendering decision that could change without any change in
 * meaning.
 *
 * Canonicalisation makes the key order-independent and duplicate-tolerant, so
 * [brakes, wipers], [wipers, brakes] and [brakes, brakes, wipers] are all one
 * follow-up, while [brakes] and [wipers] remain two legitimately different
 * jobs on the same inspection.
 */

export const FOLLOW_UP_KEY_SEPARATOR = ",";

/**
 * @returns the canonical key, or null when there is nothing to key on. Stored
 *          in vehicle_maintenance_records.source_inspection_followup_key and
 *          made unique per inspection by a partial index in migration 0035.
 */
export function inspectionFollowUpKey(itemKeys: readonly string[]): string | null {
  const canonical = [...new Set(itemKeys.map((key) => key.trim()).filter((key) => key.length > 0))].sort();
  if (canonical.length === 0) return null;
  return canonical.join(FOLLOW_UP_KEY_SEPARATOR);
}

/** The item keys a stored follow-up key refers back to. */
export function parseFollowUpKey(key: string | null | undefined): string[] {
  if (!key) return [];
  return key.split(FOLLOW_UP_KEY_SEPARATOR).filter(Boolean);
}

/**
 * Whether every key in a stored follow-up is still part of the canonical
 * checklist. Used for reporting rather than validation — a key referencing a
 * retired item stays readable, it simply no longer resolves to a label.
 */
export function followUpKeyIsResolvable(key: string | null | undefined): boolean {
  const keys = parseFollowUpKey(key);
  return keys.length > 0 && keys.every((k) => getChecklistItem(k) !== undefined);
}
