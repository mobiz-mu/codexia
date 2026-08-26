import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * `apply_all.sql` is the documented fresh-install path, and its ordering is
 * load-bearing in a way nothing enforces at runtime.
 *
 * `seed.sql` creates the `roles` rows. Every migration from 0026 onward
 * grants its new permissions by selecting from `roles`. Put `seed.sql` at the
 * end — which is exactly what docs/SETUP.md used to tell people to do — and
 * those grants match an empty table and insert nothing. No error is raised,
 * the schema is byte-identical, and the database quietly ends up with 50 of
 * 75 role_permissions: every fleet-ops grant for `administrator` and
 * `fleet_manager` missing, so staff cannot see half the admin.
 *
 * That failure is invisible to a schema diff, so it needs a guard here.
 */

const SUPABASE = join(process.cwd(), "supabase");
const MIGRATIONS = join(SUPABASE, "migrations");

const applyAll = readFileSync(join(SUPABASE, "apply_all.sql"), "utf8");
const migrationFiles = readdirSync(MIGRATIONS)
  .filter((f) => f.endsWith(".sql"))
  .sort();

/** Line number (1-based) of the first line matching, or -1. */
function lineOf(haystack: string, needle: string): number {
  const lines = haystack.split("\n");
  const index = lines.findIndex((line) => line.includes(needle));
  return index === -1 ? -1 : index + 1;
}

const SEED_MARKER = "Codexia Ltd — seed data";

describe("apply_all.sql bundles every migration", () => {
  it("references each migration file exactly once, in filename order", () => {
    const positions = migrationFiles.map((file) => ({ file, at: lineOf(applyAll, file) }));

    const missing = positions.filter((p) => p.at === -1).map((p) => p.file);
    expect(missing).toEqual([]);

    const order = positions.map((p) => p.at);
    const sorted = [...order].sort((a, b) => a - b);
    expect(order).toEqual(sorted);
  });

  it("has migrations to check in the first place", () => {
    // Guards against the directory read silently returning nothing.
    expect(migrationFiles.length).toBeGreaterThan(30);
  });

  it("runs inside a transaction so a partial apply cannot survive", () => {
    // The file opens with a header comment, so `begin;` is not line 1 — what
    // matters is that it precedes the first migration and `commit;` closes.
    const beginAt = lineOf(applyAll, "begin;");
    expect(beginAt).toBeGreaterThan(0);
    expect(beginAt).toBeLessThan(lineOf(applyAll, migrationFiles[0]));
    expect(applyAll.trimEnd().endsWith("commit;")).toBe(true);
  });
});

describe("seed.sql sits between 0025 and 0026", () => {
  const seedAt = lineOf(applyAll, SEED_MARKER);

  it("is present in the bundle at all", () => {
    expect(seedAt).toBeGreaterThan(0);
  });

  it("comes after migration 0025", () => {
    const before = migrationFiles.filter((f) => f.slice(0, 4) <= "0025");
    for (const file of before) {
      expect(lineOf(applyAll, file)).toBeLessThan(seedAt);
    }
  });

  it("comes before migration 0026 and everything after it", () => {
    // This is the assertion that actually protects the 75 grants.
    const after = migrationFiles.filter((f) => f.slice(0, 4) >= "0026");
    expect(after.length).toBeGreaterThan(0);
    for (const file of after) {
      expect(lineOf(applyAll, file)).toBeGreaterThan(seedAt);
    }
  });

  it("is not appended at the end of the bundle", () => {
    const lastMigration = migrationFiles.at(-1)!;
    expect(seedAt).toBeLessThan(lineOf(applyAll, lastMigration));
  });
});

describe("the ordering constraint is written down where it will be seen", () => {
  it("seed.sql says so in its own banner", () => {
    const seed = readFileSync(join(SUPABASE, "seed.sql"), "utf8");
    expect(seed).toContain("ORDERING IS LOAD-BEARING");
  });

  it("the setup guide's regeneration command inlines seed at 0026", () => {
    const setup = readFileSync(join(process.cwd(), "docs", "SETUP.md"), "utf8");
    expect(setup).toContain("supabase/seed.sql");
    expect(setup).toContain("0026");
    // The old command piped every migration out and appended seed last.
    expect(setup).not.toContain("cat /tmp/schema.sql supabase/seed.sql");
  });
});

describe("grants that depend on roles existing", () => {
  it("migrations from 0026 onward grant by selecting from roles", () => {
    // If this stops being true the ordering constraint may have been solved
    // properly instead — in which case update this test deliberately rather
    // than deleting the guard above.
    const later = migrationFiles.filter((f) => f.slice(0, 4) >= "0026");
    const granting = later.filter((f) => {
      const sql = readFileSync(join(MIGRATIONS, f), "utf8");
      return /insert\s+into\s+role_permissions/i.test(sql);
    });
    expect(granting.length).toBeGreaterThan(0);

    for (const file of granting) {
      const sql = readFileSync(join(MIGRATIONS, file), "utf8");
      expect(sql).toMatch(/from\s+roles|join\s+roles/i);
    }
  });
});
