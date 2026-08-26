import { getInspectionReport } from "@/lib/actions/admin/inspections";
import { generateInspectionPdf } from "@/lib/pdf/generate-inspection-pdf";

/**
 * The inspection PDF, generated on demand from immutable historical rows.
 *
 * Authentication is enforced HERE, not inherited: route handlers are not
 * wrapped by the (protected) layout, and the proxy's admin gate is an
 * optimistic session check rather than a permission check. getInspectionReport
 * calls requireAdminUser and asserts view_inspections, so an authenticated
 * admin without that permission is refused like any other inspection read.
 *
 * `inline` opens in the browser's own PDF viewer; `?download=1` saves it.
 * There is no public or unauthenticated path to this document.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let report;
  try {
    report = await getInspectionReport(id);
  } catch (error) {
    // requireAdminUser / assertPermission throw. Report the refusal without
    // echoing internals back to the caller.
    const message = error instanceof Error ? error.message : "";
    const forbidden = message.includes("Missing required permission");
    return new Response(forbidden ? "Not permitted." : "Not authorised.", { status: forbidden ? 403 : 401 });
  }

  if (!report) return new Response("Inspection not found.", { status: 404 });

  const pdf = await generateInspectionPdf(report);
  const download = new URL(request.url).searchParams.get("download") === "1";
  const filename = `${report.reference}-weekly-inspection.pdf`;

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
      // Derived from immutable rows, but never cached by a shared cache: the
      // document is permission-controlled.
      "Cache-Control": "private, no-store",
    },
  });
}
