import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isPubliclyBookable, publicVehicleFilter, blockHoldsVehicle } from "./availability-rules";

/**
 * A staff car is a real fleet vehicle with real service history that is never
 * sellable. Migration 0030 documents that guarantee and even builds
 * `vehicles_rentable_idx ... where is_staff_car = false` for it — but for a
 * long while no query applied the filter, and `isPubliclyBookable` sat in the
 * repository with zero importers while its tests went on passing.
 *
 * So these tests deliberately work at two levels: the rule's behaviour, and
 * the fact that the real query paths actually reach for it. A green rule that
 * nothing calls is precisely the failure being guarded against here.
 */

const WINDOW = { start: "2026-09-01T06:00:00.000Z", end: "2026-09-05T06:00:00.000Z" };
const RENTABLE = { status: "active", isStaffCar: false };

/** Records what a PostgREST-style builder was asked to filter on. */
function fakeQuery() {
  const calls: string[] = [];
  const builder = {
    eq(column: string, value: string | boolean) {
      calls.push(`eq:${column}=${String(value)}`);
      return builder;
    },
    is(column: string, value: null) {
      calls.push(`is:${column}=${String(value)}`);
      return builder;
    },
  };
  return { builder, calls };
}

function source(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("staff cars are excluded from public rental stock", () => {
  it("refuses a staff car even when nothing else is holding it", () => {
    expect(
      isPubliclyBookable({
        vehicle: { status: "active", isStaffCar: true },
        window: WINDOW,
        bookings: [],
        blocks: [],
      })
    ).toBe(false);
  });

  it("still offers an ordinary active vehicle with a free calendar", () => {
    expect(isPubliclyBookable({ vehicle: RENTABLE, window: WINDOW, bookings: [], blocks: [] })).toBe(true);
  });

  it("refuses a vehicle that is not active", () => {
    expect(
      isPubliclyBookable({
        vehicle: { status: "draft", isStaffCar: false },
        window: WINDOW,
        bookings: [],
        blocks: [],
      })
    ).toBe(false);
  });

  it("puts is_staff_car into the query filter itself", () => {
    const { builder, calls } = fakeQuery();
    publicVehicleFilter(builder);
    expect(calls).toContain("eq:is_staff_car=false");
    expect(calls).toContain("eq:status=active");
    expect(calls).toContain("eq:currency=EUR");
    expect(calls).toContain("is:deleted_at=null");
  });
});

describe("the canonical rule is actually wired into the public paths", () => {
  it("public search filters and then applies the rule", () => {
    const booking = source("lib/actions/booking.ts");
    expect(booking).toContain("publicVehicleFilter(");
    expect(booking).toContain("isPubliclyBookable({");
  });

  it("customer booking insertion refuses a staff car", () => {
    // The quote is shared with admin manual booking, so the refusal has to
    // live on the insertion — assert it is there and not merely implied.
    const booking = source("lib/actions/booking.ts");
    const createBooking = booking.slice(booking.indexOf("export async function createBooking"));
    expect(createBooking).toContain("is_staff_car");
  });

  it("every public vehicle listing composes the canonical filter", () => {
    const data = source("lib/data/vehicles.ts");
    const listings = ["getFeaturedVehicles", "getVehicles", "getVehicleBySlug", "getRelatedVehicles"];
    for (const name of listings) expect(data).toContain(name);
    // Four listings, four filter applications, plus the import.
    expect(data.split("publicVehicleFilter(").length - 1).toBe(4);
    // No listing may restate the columns and quietly omit is_staff_car.
    expect(data).not.toContain('eq("status", "active")');
  });
});

describe("staff cars remain fully visible to internal fleet operations", () => {
  /**
   * is_staff_car governs public rentability, not existence. Inspections,
   * maintenance, fuel, compliance, incidents and the planning board must all
   * still see the car — a staff vehicle is inspected like any other.
   */
  const internal: [string, string][] = [
    ["weekly inspections", "lib/actions/admin/inspections.ts"],
    ["planning board", "lib/actions/admin/availability.ts"],
    ["manual booking", "lib/actions/admin/manual-booking.ts"],
  ];

  it.each(internal)("%s does not apply the public filter", (_label, path) => {
    expect(source(path)).not.toContain("publicVehicleFilter");
  });

  it("the inspection programme still selects staff cars", () => {
    const inspections = source("lib/actions/admin/inspections.ts");
    expect(inspections).toContain("is_staff_car");
    // It reads the flag to LABEL the row, never to filter the row out.
    expect(inspections).not.toContain('eq("is_staff_car", false)');
  });
});

describe("block types that take a vehicle off the road", () => {
  it("counts inspection downtime, added by migration 0034", () => {
    expect(blockHoldsVehicle("inspection")).toBe(true);
  });

  it.each(["maintenance", "internal", "preparing", "cleaning", "incident", "stop_sell"])(
    "counts %s",
    (type) => {
      expect(blockHoldsVehicle(type)).toBe(true);
    }
  );

  it("hides a vehicle that is in a weekly inspection during the window", () => {
    expect(
      isPubliclyBookable({
        vehicle: RENTABLE,
        window: WINDOW,
        bookings: [],
        blocks: [{ type: "inspection", start: "2026-09-02T06:00:00.000Z", end: "2026-09-03T06:00:00.000Z" }],
      })
    ).toBe(false);
  });

  it("ignores a block that ends before the window opens", () => {
    expect(
      isPubliclyBookable({
        vehicle: RENTABLE,
        window: WINDOW,
        bookings: [],
        blocks: [{ type: "maintenance", start: "2026-08-01T06:00:00.000Z", end: "2026-08-02T06:00:00.000Z" }],
      })
    ).toBe(true);
  });
});
