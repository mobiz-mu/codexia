import "server-only";
import { renderToBuffer } from "@react-pdf/renderer";
import { WeeklyInspectionDocument } from "./WeeklyInspectionDocument";
import type { InspectionReport } from "@/lib/inspections/report";

/**
 * Renders the inspection report to a PDF buffer.
 *
 * Deliberately NOT stored, unlike invoices. An invoice is a financial artifact
 * that must not change after issue, so it is written to a bucket once. An
 * inspection PDF is a derived view of rows that are already immutable once
 * approved — persisting it would add storage churn and create the possibility
 * of a stale copy disagreeing with the record it claims to represent.
 */
export async function generateInspectionPdf(report: InspectionReport): Promise<Buffer> {
  return renderToBuffer(WeeklyInspectionDocument({ report }));
}
