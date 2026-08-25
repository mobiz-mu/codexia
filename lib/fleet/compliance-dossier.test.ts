import { describe, it, expect } from "vitest";

import {
  EXPECTED_DOCUMENT_TYPES,
  missingDocumentTypes,
  sortByUrgency,
  splitCurrentAndHistory,
  worstStatus,
  type DossierRecord,
} from "./compliance-dossier";

const TODAY = "2026-09-01";

function rec(over: Partial<DossierRecord> = {}): DossierRecord {
  return { id: "r1", documentType: "insurance", customType: null, expiryDate: "2027-01-01", ...over };
}

describe("worstStatus", () => {
  it("is null when the vehicle holds no documents", () => {
    expect(worstStatus([], TODAY)).toBeNull();
  });

  it("reports valid when every document is comfortably in date", () => {
    expect(worstStatus(["2027-01-01", "2027-06-01"], TODAY)).toBe("valid");
  });

  it("reports the worst, not the most common", () => {
    // Valid insurance does not make a car with expired road tax rentable.
    expect(worstStatus(["2027-01-01", "2027-06-01", "2026-08-01"], TODAY)).toBe("expired");
  });

  it("prefers expired over urgent", () => {
    expect(worstStatus(["2026-08-01", "2026-09-05"], TODAY)).toBe("expired");
  });

  it("prefers urgent over warning", () => {
    const s = worstStatus(["2026-09-03", "2026-09-25"], TODAY);
    expect(["urgent", "expires_today"]).toContain(s);
  });

  it("catches a document expiring today", () => {
    expect(worstStatus(["2026-09-01"], TODAY)).toBe("expires_today");
  });
});

describe("missingDocumentTypes", () => {
  it("lists every expected type when the vehicle has nothing", () => {
    expect(missingDocumentTypes([])).toEqual([...EXPECTED_DOCUMENT_TYPES]);
  });

  it("lists only what is genuinely absent", () => {
    const records = [rec({ documentType: "insurance" }), rec({ id: "r2", documentType: "road_tax" })];
    expect(missingDocumentTypes(records)).toEqual(["fitness", "psvl"]);
  });

  it("returns nothing when the register is complete", () => {
    const records = EXPECTED_DOCUMENT_TYPES.map((t, i) => rec({ id: `r${i}`, documentType: t }));
    expect(missingDocumentTypes(records)).toEqual([]);
  });

  it("does not count an 'other' document towards an expected type", () => {
    const records = [rec({ documentType: "other", customType: "Tyre register" })];
    expect(missingDocumentTypes(records)).toEqual([...EXPECTED_DOCUMENT_TYPES]);
  });
});

describe("sortByUrgency", () => {
  it("puts expired documents first and valid ones last", () => {
    const rows = sortByUrgency(
      [
        { id: "valid", expiryDate: "2027-06-01" },
        { id: "expired", expiryDate: "2026-08-01" },
        { id: "soon", expiryDate: "2026-09-10" },
      ],
      TODAY
    );
    expect(rows.map((r) => r.id)).toEqual(["expired", "soon", "valid"]);
  });

  it("breaks ties by expiry date so the order is stable", () => {
    const rows = sortByUrgency(
      [
        { id: "b", expiryDate: "2026-07-01" },
        { id: "a", expiryDate: "2026-06-01" },
      ],
      TODAY
    );
    expect(rows.map((r) => r.id)).toEqual(["a", "b"]);
  });
});

describe("splitCurrentAndHistory", () => {
  it("treats the latest expiry per type as current", () => {
    const old = rec({ id: "old", documentType: "road_tax", expiryDate: "2025-06-30" });
    const renewed = rec({ id: "new", documentType: "road_tax", expiryDate: "2027-06-30" });
    const { current, history } = splitCurrentAndHistory([old, renewed]);
    expect(current.map((r) => r.id)).toEqual(["new"]);
    expect(history.map((r) => r.id)).toEqual(["old"]);
  });

  it("keeps one current record per document type", () => {
    const records = [
      rec({ id: "ins", documentType: "insurance", expiryDate: "2027-01-01" }),
      rec({ id: "tax", documentType: "road_tax", expiryDate: "2027-02-01" }),
      rec({ id: "fit", documentType: "fitness", expiryDate: "2027-03-01" }),
    ];
    const { current, history } = splitCurrentAndHistory(records);
    expect(current).toHaveLength(3);
    expect(history).toHaveLength(0);
  });

  it("keeps differently-named 'other' documents apart", () => {
    // A tyre register must not supersede an unrelated custom document.
    const tyres = rec({ id: "tyres", documentType: "other", customType: "Tyre register", expiryDate: "2027-01-01" });
    const permit = rec({ id: "permit", documentType: "other", customType: "Airport permit", expiryDate: "2027-02-01" });
    const { current, history } = splitCurrentAndHistory([tyres, permit]);
    expect(current.map((r) => r.id).sort()).toEqual(["permit", "tyres"]);
    expect(history).toHaveLength(0);
  });

  it("supersedes an older document of the same custom type", () => {
    const oldTyres = rec({ id: "old", documentType: "other", customType: "Tyre register", expiryDate: "2025-01-01" });
    const newTyres = rec({ id: "new", documentType: "other", customType: "Tyre register", expiryDate: "2027-01-01" });
    const { current, history } = splitCurrentAndHistory([oldTyres, newTyres]);
    expect(current.map((r) => r.id)).toEqual(["new"]);
    expect(history.map((r) => r.id)).toEqual(["old"]);
  });

  it("handles an empty register", () => {
    expect(splitCurrentAndHistory([])).toEqual({ current: [], history: [] });
  });
});
