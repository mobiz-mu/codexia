import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { SITE_DEFAULTS } from "@/lib/config/site";
import type { InspectionReport } from "@/lib/inspections/report";

/**
 * The Weekly Vehicle Inspection Checklist, as a printable A4 document.
 *
 * Deliberately NOT built on InvoiceDocument: that is a line-items-and-totals
 * layout, and forcing a 40-row checklist through it would produce a worse
 * document than either. What is shared is the engine and the font choice.
 *
 * Fonts: Helvetica only, one of the PDF base-14. Nothing is registered or
 * embedded, so there is no web-font fetch during generation and no embedded
 * subset for a viewer to choke on — which is what keeps this safe in macOS
 * Preview as well as Chrome.
 *
 * Print safety: every result is a WORD, never a colour alone. The colours
 * below only reinforce a label that already reads correctly in greyscale.
 */

const NAVY = "#1F4E79";
const INK = "#14212C";
const MUTED = "#5A6B7B";
const RULE = "#B9C6D2";
const RULE_SOFT = "#DCE4EB";
const PASS = "#15803D";
const ATTENTION = "#9A6206";
const FAIL = "#B42318";

const styles = StyleSheet.create({
  page: { paddingTop: 34, paddingBottom: 46, paddingHorizontal: 34, fontSize: 9, fontFamily: "Helvetica", color: INK },

  mastheadRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 },
  company: { fontSize: 14, fontWeight: 700, color: NAVY },
  companyMeta: { fontSize: 8, color: MUTED, marginTop: 1 },
  title: { fontSize: 13, fontWeight: 700, color: NAVY, textAlign: "right" },
  reference: { fontSize: 8, color: MUTED, textAlign: "right", marginTop: 2 },

  draftBanner: {
    borderWidth: 1,
    borderColor: ATTENTION,
    backgroundColor: "#FDF6E7",
    padding: 5,
    marginBottom: 8,
  },
  draftText: { fontSize: 9, fontWeight: 700, color: ATTENTION },
  draftNote: { fontSize: 8, color: MUTED, marginTop: 1 },

  headerBox: { borderWidth: 1, borderColor: RULE, marginBottom: 10 },
  headerGrid: { flexDirection: "row", flexWrap: "wrap" },
  headerCell: { width: "33.33%", paddingVertical: 3, paddingHorizontal: 5 },
  headerLabel: { fontSize: 6.5, color: MUTED, letterSpacing: 0.4 },
  headerValue: { fontSize: 9, marginTop: 1 },

  sectionHeader: { backgroundColor: NAVY, paddingVertical: 3, paddingHorizontal: 5, marginTop: 8 },
  sectionHeaderText: { color: "#FFFFFF", fontSize: 8.5, fontWeight: 700, letterSpacing: 0.6 },

  tableHead: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: RULE, backgroundColor: "#EEF2F6" },
  th: { fontSize: 6.5, fontWeight: 700, color: MUTED, paddingVertical: 3, paddingHorizontal: 5, letterSpacing: 0.4 },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: RULE_SOFT, alignItems: "center" },
  cellItem: { width: "48%", paddingVertical: 3.5, paddingHorizontal: 5 },
  cellResult: { width: "17%", paddingVertical: 3.5, paddingHorizontal: 5 },
  cellRemarks: { width: "35%", paddingVertical: 3.5, paddingHorizontal: 5, color: MUTED },
  resultText: { fontSize: 8, fontWeight: 700 },
  safetyTag: { fontSize: 6, color: FAIL, marginTop: 1 },

  block: { borderWidth: 1, borderColor: RULE, marginTop: 10 },
  blockTitle: {
    backgroundColor: NAVY,
    color: "#FFFFFF",
    fontSize: 8.5,
    fontWeight: 700,
    letterSpacing: 0.6,
    paddingVertical: 3,
    paddingHorizontal: 5,
  },
  blockBody: { padding: 6 },

  alertBlock: { borderWidth: 1.5, borderColor: FAIL, marginTop: 10 },
  alertTitle: {
    backgroundColor: FAIL,
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: 0.8,
    paddingVertical: 4,
    paddingHorizontal: 5,
  },

  defectLine: { flexDirection: "row", marginBottom: 2.5 },
  defectResult: { width: 58, fontSize: 7.5, fontWeight: 700 },
  defectLabel: { flex: 1, fontSize: 8.5 },
  defectRemarks: { fontSize: 8, color: MUTED, marginLeft: 58, marginBottom: 3 },

  outcomeRow: { flexDirection: "row", marginTop: 10 },
  outcomeCell: { flex: 1, borderWidth: 1, borderColor: RULE, padding: 6, marginRight: 6 },
  outcomeCellLast: { flex: 1, borderWidth: 1, borderColor: RULE, padding: 6 },
  outcomeLabel: { fontSize: 6.5, color: MUTED, letterSpacing: 0.4 },
  outcomeValue: { fontSize: 12, fontWeight: 700, marginTop: 2 },
  outcomeNote: { fontSize: 7.5, color: MUTED, marginTop: 3 },

  ackRow: { flexDirection: "row", marginTop: 10 },
  ackCell: { flex: 1, borderWidth: 1, borderColor: RULE, padding: 6, marginRight: 6 },
  ackCellLast: { flex: 1, borderWidth: 1, borderColor: RULE, padding: 6 },
  ackTitle: { fontSize: 7, fontWeight: 700, color: NAVY, letterSpacing: 0.4 },
  ackField: { fontSize: 8, marginTop: 3 },
  ackMuted: { fontSize: 7, color: MUTED },

  countsRow: { flexDirection: "row", marginTop: 8 },
  countCell: { flex: 1, borderWidth: 1, borderColor: RULE_SOFT, padding: 4, marginRight: 4, alignItems: "center" },
  countValue: { fontSize: 11, fontWeight: 700 },
  countLabel: { fontSize: 6.5, color: MUTED, letterSpacing: 0.3, marginTop: 1 },

  footer: {
    position: "absolute",
    bottom: 22,
    left: 34,
    right: 34,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 0.5,
    borderTopColor: RULE,
    paddingTop: 4,
  },
  footerText: { fontSize: 7, color: MUTED },
});

function resultColour(result: string): string {
  if (result === "PASS") return PASS;
  if (result === "ATTENTION") return ATTENTION;
  if (result === "FAIL") return FAIL;
  return MUTED;
}

function HeaderCell({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.headerCell}>
      <Text style={styles.headerLabel}>{label.toUpperCase()}</Text>
      <Text style={styles.headerValue}>{value}</Text>
    </View>
  );
}

export function WeeklyInspectionDocument({ report }: { report: InspectionReport }) {
  return (
    <Document
      title={`${report.title} — ${report.reference}`}
      author={SITE_DEFAULTS.companyName}
      subject={`Weekly vehicle inspection ${report.registration} week ending ${report.weekEnding}`}
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.mastheadRow} fixed>
          <View>
            <Text style={styles.company}>{SITE_DEFAULTS.companyName}</Text>
            <Text style={styles.companyMeta}>{SITE_DEFAULTS.domain}</Text>
            <Text style={styles.companyMeta}>{SITE_DEFAULTS.phone}</Text>
          </View>
          <View>
            <Text style={styles.title}>{report.title}</Text>
            <Text style={styles.reference}>
              {report.reference} · Checklist v{report.checklistVersion}
            </Text>
          </View>
        </View>

        {report.isDraft ? (
          <View style={styles.draftBanner}>
            <Text style={styles.draftText}>DRAFT — INSPECTION NOT COMPLETED</Text>
            <Text style={styles.draftNote}>
              This sheet is still being filled in. Items shown as UNANSWERED have not been checked, and this
              document is not a completed or approved inspection record.
            </Text>
          </View>
        ) : null}

        <View style={styles.headerBox}>
          <View style={styles.headerGrid}>
            <HeaderCell label="Company" value={report.company} />
            <HeaderCell label="Vehicle Registration No." value={report.registration} />
            <HeaderCell label="Vehicle Make / Model" value={report.makeModel} />
            <HeaderCell label="Driver Name" value={report.driverName} />
            <HeaderCell label="Week Ending" value={report.weekEnding} />
            <HeaderCell label="Date of Inspection" value={report.inspectionDate} />
            <HeaderCell label="Odometer Reading" value={report.odometerLabel} />
            <HeaderCell label="Inspected By" value={report.inspectorName} />
            <HeaderCell label="Inspection Reference" value={report.reference} />
          </View>
        </View>

        {report.sections.map((section) => (
          // minPresenceAhead keeps a section heading from stranding itself at
          // the foot of a page with its first rows overleaf.
          <View key={section.section} minPresenceAhead={48}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionHeaderText}>{section.title}</Text>
            </View>
            <View style={styles.tableHead}>
              <Text style={[styles.th, styles.cellItem]}>INSPECTION ITEM</Text>
              <Text style={[styles.th, styles.cellResult]}>RESULT</Text>
              <Text style={[styles.th, styles.cellRemarks]}>REMARKS</Text>
            </View>
            {section.rows.map((row) => (
              // A row never splits across a page, so a result can never be
              // separated from the item it belongs to.
              <View key={row.itemKey} style={styles.row} wrap={false}>
                <View style={styles.cellItem}>
                  <Text>{row.label}</Text>
                  {row.safetyCritical ? <Text style={styles.safetyTag}>SAFETY-CRITICAL</Text> : null}
                </View>
                <View style={styles.cellResult}>
                  <Text style={[styles.resultText, { color: resultColour(row.resultLabel) }]}>
                    {row.resultLabel}
                  </Text>
                </View>
                <Text style={styles.cellRemarks}>{row.remarks ?? ""}</Text>
              </View>
            ))}
          </View>
        ))}

        <View style={styles.countsRow} wrap={false}>
          {(
            [
              ["PASS", report.counts.pass, PASS],
              ["ATTENTION", report.counts.attention, ATTENTION],
              ["FAIL", report.counts.fail, FAIL],
              ["N/A", report.counts.na, MUTED],
              ["UNANSWERED", report.counts.unanswered, MUTED],
            ] as const
          ).map(([label, value, colour], index) => (
            <View key={label} style={index === 4 ? [styles.countCell, { marginRight: 0 }] : styles.countCell}>
              <Text style={[styles.countValue, { color: colour }]}>{value}</Text>
              <Text style={styles.countLabel}>{label}</Text>
            </View>
          ))}
        </View>

        {report.safetyFailures.length > 0 ? (
          <View style={styles.alertBlock} wrap={false}>
            <Text style={styles.alertTitle}>VEHICLE SAFETY FAILURE</Text>
            <View style={styles.blockBody}>
              <Text style={{ fontSize: 8.5, marginBottom: 4 }}>
                {report.safetyFailures.length === 1
                  ? "The following safety-critical check has failed. The vehicle may be unsafe to rent."
                  : `The following ${report.safetyFailures.length} safety-critical checks have failed. The vehicle may be unsafe to rent.`}
              </Text>
              {report.safetyFailures.map((failure) => (
                <Text key={failure.itemKey} style={{ fontSize: 8.5, marginBottom: 1.5 }}>
                  • {failure.label}
                </Text>
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.block} minPresenceAhead={40}>
          <Text style={styles.blockTitle}>DEFECTS / REPAIRS REQUIRED</Text>
          <View style={styles.blockBody}>
            {report.defects.length === 0 && !report.defectsNotes ? (
              <Text style={{ fontSize: 8.5, color: MUTED }}>No defects recorded.</Text>
            ) : null}
            {report.defects.map((defect, index) => (
              <View key={`${defect.label}-${index}`} wrap={false}>
                <View style={styles.defectLine}>
                  <Text style={[styles.defectResult, { color: resultColour(defect.resultLabel) }]}>
                    {defect.resultLabel}
                  </Text>
                  <Text style={styles.defectLabel}>
                    {defect.label}
                    {defect.safetyCritical ? " (safety-critical)" : ""}
                  </Text>
                </View>
                {defect.remarks ? <Text style={styles.defectRemarks}>{defect.remarks}</Text> : null}
              </View>
            ))}
            {report.defectsNotes ? (
              <View style={{ marginTop: report.defects.length > 0 ? 5 : 0 }}>
                <Text style={styles.headerLabel}>OVERALL NOTES</Text>
                <Text style={{ fontSize: 8.5, marginTop: 1 }}>{report.defectsNotes}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {report.followUps.length > 0 ? (
          <View style={styles.block} wrap={false}>
            <Text style={styles.blockTitle}>MAINTENANCE FOLLOW-UP</Text>
            <View style={styles.blockBody}>
              {report.followUps.map((followUp) => (
                <View key={followUp.reference} style={{ marginBottom: 3 }}>
                  <Text style={{ fontSize: 8.5 }}>
                    {followUp.reference} · {followUp.date} · {followUp.type}
                  </Text>
                  {followUp.itemLabels.length > 0 ? (
                    <Text style={{ fontSize: 7.5, color: MUTED }}>{followUp.itemLabels.join("; ")}</Text>
                  ) : null}
                </View>
              ))}
              {/* Costs deliberately absent: fleet maintenance accounting lives
                  in the Maintenance module, not on an inspection sheet. */}
              <Text style={{ fontSize: 7, color: MUTED, marginTop: 3 }}>
                Repair costs are recorded on the maintenance record, not on this inspection.
              </Text>
            </View>
          </View>
        ) : null}

        {report.downtime ? (
          <View style={styles.block} wrap={false}>
            <Text style={styles.blockTitle}>VEHICLE DOWNTIME</Text>
            <View style={styles.blockBody}>
              <Text style={{ fontSize: 8.5 }}>
                Off road from {report.downtime.startAt} to {report.downtime.endAt}
              </Text>
              <Text style={{ fontSize: 8, color: MUTED, marginTop: 1 }}>
                {report.downtime.released ? "Released — vehicle returned to service." : "Currently held off road."}
              </Text>
            </View>
          </View>
        ) : null}

        {/* Result and approval are two separate boxes. Approval never rewrites
            the result, so a reviewed failure prints FAILED beside APPROVED. */}
        <View style={styles.outcomeRow} wrap={false}>
          <View style={styles.outcomeCell}>
            <Text style={styles.outcomeLabel}>INSPECTION RESULT</Text>
            <Text style={[styles.outcomeValue, { color: resultColour(report.resultLabel) }]}>
              {report.resultLabel}
            </Text>
            <Text style={styles.outcomeNote}>Derived from the checklist items.</Text>
          </View>
          <View style={styles.outcomeCellLast}>
            <Text style={styles.outcomeLabel}>FLEET MANAGER APPROVAL</Text>
            <Text style={styles.outcomeValue}>{report.approvalLabel}</Text>
            <Text style={styles.outcomeNote}>
              Approval records management review. It does not change the inspection result.
            </Text>
          </View>
        </View>

        <View style={styles.ackRow} wrap={false}>
          <View style={styles.ackCell}>
            <Text style={styles.ackTitle}>DRIVER ACKNOWLEDGEMENT</Text>
            <Text style={styles.ackField}>{report.driverName}</Text>
            <Text style={styles.ackMuted}>Date: {report.driverAcknowledgedOn ?? "—"}</Text>
          </View>
          <View style={styles.ackCell}>
            <Text style={styles.ackTitle}>INSPECTOR ACKNOWLEDGEMENT</Text>
            <Text style={styles.ackField}>{report.inspectorName}</Text>
            <Text style={styles.ackMuted}>Date: {report.inspectorAcknowledgedOn ?? "—"}</Text>
          </View>
          <View style={styles.ackCellLast}>
            <Text style={styles.ackTitle}>FLEET MANAGER APPROVAL</Text>
            <Text style={styles.ackField}>{report.approvedBy ?? "—"}</Text>
            <Text style={styles.ackMuted}>Date: {report.approvedAt ?? "—"}</Text>
            {report.approvalRemarks ? (
              <Text style={[styles.ackMuted, { marginTop: 2 }]}>{report.approvalRemarks}</Text>
            ) : null}
          </View>
        </View>

        <Text style={{ fontSize: 7, color: MUTED, marginTop: 6 }}>
          Acknowledgements above are recorded names and dates entered in the fleet system. They are not handwritten
          or electronic signatures.
        </Text>

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            {SITE_DEFAULTS.companyName} · {report.reference} · Week ending {report.weekEnding}
          </Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}
