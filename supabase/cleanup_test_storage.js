// Removes the Storage files backing the demo/test rows that
// production_cleanup_test_data.sql is about to delete. Run this BEFORE that
// SQL script — it reads vehicle_images/invoices while those rows still
// exist to know exactly which storage objects belong to them; if the SQL
// ran first, the rows (and the only record of these paths) would already be
// gone via cascade, orphaning the actual files with nothing left to find
// them by.
//
// Read-only against everything except the specific files identified below.
// Requires SUPABASE_SERVICE_ROLE_KEY in .env.local (never committed).
//
// Usage: node supabase/cleanup_test_storage.js            (dry run, default)
//        node supabase/cleanup_test_storage.js --apply     (actually delete)

const fs = require("fs");
const path = require("path");

const envPath = path.join(__dirname, "..", ".env.local");
for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].trim();
}

const { createClient } = require(path.join(__dirname, "..", "node_modules", "@supabase/supabase-js"));
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const APPLY = process.argv.includes("--apply");

function flattenVariantPaths(variants) {
  if (!variants || typeof variants !== "object") return [];
  const paths = [];
  for (const size of Object.values(variants)) {
    if (!size || typeof size !== "object") continue;
    for (const p of Object.values(size)) {
      if (typeof p === "string") paths.push(p);
    }
  }
  return paths;
}

async function main() {
  console.log(APPLY ? "Running in APPLY mode — files will be deleted." : "Running in DRY-RUN mode — nothing will be deleted (pass --apply to actually delete).");

  // --- vehicle-images bucket: every image row belonging to an is_demo vehicle ---
  const { data: demoVehicles, error: vErr } = await supabase.from("vehicles").select("id, name").eq("is_demo", true);
  if (vErr) throw new Error("Failed to read vehicles: " + vErr.message);

  const demoVehicleIds = (demoVehicles ?? []).map((v) => v.id);
  const { data: images, error: iErr } = await supabase
    .from("vehicle_images")
    .select("id, vehicle_id, path, variants")
    .in("vehicle_id", demoVehicleIds.length > 0 ? demoVehicleIds : ["00000000-0000-0000-0000-000000000000"]);
  if (iErr) throw new Error("Failed to read vehicle_images: " + iErr.message);

  const vehicleImagePaths = [];
  for (const img of images ?? []) {
    vehicleImagePaths.push(img.path);
    vehicleImagePaths.push(...flattenVariantPaths(img.variants));
  }

  console.log(`\nvehicle-images bucket: ${vehicleImagePaths.length} file(s) to remove (from ${images?.length ?? 0} image row(s) across ${demoVehicles?.length ?? 0} demo vehicle(s))`);
  vehicleImagePaths.forEach((p) => console.log("  -", p));

  if (APPLY && vehicleImagePaths.length > 0) {
    const { error } = await supabase.storage.from("vehicle-images").remove(vehicleImagePaths);
    if (error) console.error("  FAILED to remove some vehicle-images files:", error.message);
    else console.log("  Removed.");
  }

  // --- invoices bucket: the one test invoice's PDF ---
  const { data: testInvoices, error: invErr } = await supabase
    .from("invoices")
    .select("id, number, storage_path")
    .eq("customer_name", "test");
  if (invErr) throw new Error("Failed to read invoices: " + invErr.message);

  const invoicePaths = (testInvoices ?? []).map((i) => i.storage_path).filter(Boolean);
  console.log(`\ninvoices bucket: ${invoicePaths.length} file(s) to remove`);
  invoicePaths.forEach((p) => console.log("  -", p));

  if (APPLY && invoicePaths.length > 0) {
    const { error } = await supabase.storage.from("invoices").remove(invoicePaths);
    if (error) console.error("  FAILED to remove some invoices files:", error.message);
    else console.log("  Removed.");
  }

  console.log(APPLY ? "\nDone." : "\nDry run complete — re-run with --apply to actually delete these files, then run production_cleanup_test_data.sql.");
}

main().catch((err) => {
  console.error("cleanup_test_storage.js FAILED:", err.message);
  process.exit(1);
});
