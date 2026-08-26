import { describe, it, expect } from "vitest";
import {
  FOLLOW_UP_KEY_SEPARATOR,
  followUpKeyIsResolvable,
  inspectionFollowUpKey,
  parseFollowUpKey,
} from "./follow-up";

/**
 * The follow-up key is the database's identity for "this exact inspection
 * follow-up". Every property asserted here is what the partial unique index
 * in 0035 relies on to be a correct concurrency guarantee rather than an
 * arbitrary one.
 */
describe("inspectionFollowUpKey", () => {
  it("derives a key from a single item", () => {
    expect(inspectionFollowUpKey(["road_brakes"])).toBe("road_brakes");
  });

  // Order must not create a second identity for the same job.
  it("is order-independent", () => {
    const a = inspectionFollowUpKey(["road_brakes", "ext_wiper_blades"]);
    const b = inspectionFollowUpKey(["ext_wiper_blades", "road_brakes"]);
    expect(a).toBe(b);
    expect(a).toBe("ext_wiper_blades,road_brakes");
  });

  it("is order-independent across many items", () => {
    const keys = ["tyre_front_tread", "road_brakes", "int_seat_belts", "eng_brake_fluid"];
    const forward = inspectionFollowUpKey(keys);
    const reversed = inspectionFollowUpKey([...keys].reverse());
    const shuffled = inspectionFollowUpKey([keys[2], keys[0], keys[3], keys[1]]);
    expect(forward).toBe(reversed);
    expect(forward).toBe(shuffled);
  });

  it("deduplicates repeated items so a doubled request keeps one identity", () => {
    expect(inspectionFollowUpKey(["road_brakes", "road_brakes"])).toBe("road_brakes");
    expect(inspectionFollowUpKey(["road_brakes", "ext_wiper_blades", "road_brakes"])).toBe(
      "ext_wiper_blades,road_brakes"
    );
  });

  // Two different selections must stay two different jobs.
  it("gives different selections different keys", () => {
    expect(inspectionFollowUpKey(["road_brakes"])).not.toBe(inspectionFollowUpKey(["ext_wiper_blades"]));
    expect(inspectionFollowUpKey(["road_brakes"])).not.toBe(
      inspectionFollowUpKey(["road_brakes", "ext_wiper_blades"])
    );
  });

  it("ignores blank and whitespace-only entries", () => {
    expect(inspectionFollowUpKey(["road_brakes", "", "   "])).toBe("road_brakes");
    expect(inspectionFollowUpKey([" road_brakes "])).toBe("road_brakes");
  });

  it("returns null when there is nothing to key on", () => {
    expect(inspectionFollowUpKey([])).toBeNull();
    expect(inspectionFollowUpKey(["", "  "])).toBeNull();
  });

  // Identity must never depend on presentation.
  it("depends only on item keys, never on labels or remarks", () => {
    const key = inspectionFollowUpKey(["road_brakes"]);
    expect(key).toBe("road_brakes");
    expect(key).not.toContain("Brakes operating correctly");
    expect(key).not.toContain(" ");
  });

  it("uses a separator that cannot appear inside a checklist key", () => {
    const key = inspectionFollowUpKey(["road_brakes", "ext_wiper_blades"]);
    expect(FOLLOW_UP_KEY_SEPARATOR).toBe(",");
    expect(key!.split(FOLLOW_UP_KEY_SEPARATOR)).toHaveLength(2);
  });
});

describe("parseFollowUpKey", () => {
  it("round-trips a key back to its sorted item list", () => {
    const key = inspectionFollowUpKey(["road_brakes", "ext_wiper_blades"])!;
    expect(parseFollowUpKey(key)).toEqual(["ext_wiper_blades", "road_brakes"]);
  });

  it("treats a missing key as no items", () => {
    expect(parseFollowUpKey(null)).toEqual([]);
    expect(parseFollowUpKey(undefined)).toEqual([]);
    expect(parseFollowUpKey("")).toEqual([]);
  });
});

describe("followUpKeyIsResolvable", () => {
  it("resolves a key of real checklist items", () => {
    expect(followUpKeyIsResolvable(inspectionFollowUpKey(["road_brakes", "tyre_front_tread"]))).toBe(true);
  });

  it("reports an unknown item without throwing", () => {
    expect(followUpKeyIsResolvable("road_brakes,ext_sunroof")).toBe(false);
  });

  // Historical rows carry no key at all and must stay valid.
  it("treats an absent key as unresolvable rather than an error", () => {
    expect(followUpKeyIsResolvable(null)).toBe(false);
    expect(followUpKeyIsResolvable("")).toBe(false);
  });
});
