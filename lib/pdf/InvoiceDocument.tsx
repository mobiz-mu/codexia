import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { SITE_DEFAULTS } from "@/lib/config/site";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: "#1F2937" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24 },
  companyName: { fontSize: 16, fontWeight: 700 },
  muted: { color: "#6B7280" },
  invoiceTitle: { fontSize: 20, fontWeight: 700, textAlign: "right" },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 9, textTransform: "uppercase", color: "#6B7280", marginBottom: 4 },
  table: { marginTop: 8 },
  tableHeaderRow: {
    flexDirection: "row",
    borderBottom: "1px solid #E5E7EB",
    paddingBottom: 4,
    marginBottom: 4,
  },
  tableRow: { flexDirection: "row", paddingVertical: 3 },
  colDesc: { flex: 4 },
  colQty: { flex: 1, textAlign: "right" },
  colPrice: { flex: 1.5, textAlign: "right" },
  colTotal: { flex: 1.5, textAlign: "right" },
  totalsBlock: { marginTop: 16, alignItems: "flex-end" },
  totalsRow: { flexDirection: "row", width: 200, justifyContent: "space-between", marginBottom: 2 },
  totalsLabelBold: { fontWeight: 700 },
  footer: { marginTop: 32, fontSize: 8, color: "#6B7280" },
});

export type InvoicePdfData = {
  number: string;
  issueDate: string;
  dueDate: string;
  status: string;
  bookingReference: string | null;
  customerName: string;
  customerEmail: string;
  customerAddress: string | null;
  items: { description: string; quantity: number; unitPriceFormatted: string; totalFormatted: string }[];
  subtotalFormatted: string;
  taxFormatted: string;
  discountFormatted: string;
  totalFormatted: string;
  paidFormatted: string;
  balanceFormatted: string;
  terms: string | null;
  notes: string | null;
};

export function InvoiceDocument({ data }: { data: InvoicePdfData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.companyName}>{SITE_DEFAULTS.companyName}</Text>
            <Text style={styles.muted}>{SITE_DEFAULTS.domain}</Text>
            <Text style={styles.muted}>{SITE_DEFAULTS.phone}</Text>
            <Text style={styles.muted}>{SITE_DEFAULTS.email}</Text>
          </View>
          <View>
            <Text style={styles.invoiceTitle}>INVOICE</Text>
            <Text style={styles.muted}>{data.number}</Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Bill To</Text>
            <Text>{data.customerName}</Text>
            <Text style={styles.muted}>{data.customerEmail}</Text>
            {data.customerAddress && <Text style={styles.muted}>{data.customerAddress}</Text>}
          </View>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Details</Text>
            <Text>Issue Date: {data.issueDate}</Text>
            <Text>Due Date: {data.dueDate}</Text>
            {data.bookingReference && <Text>Booking: {data.bookingReference}</Text>}
            <Text>Status: {data.status.toUpperCase()}</Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.colDesc, styles.totalsLabelBold]}>Description</Text>
            <Text style={[styles.colQty, styles.totalsLabelBold]}>Qty</Text>
            <Text style={[styles.colPrice, styles.totalsLabelBold]}>Unit Price</Text>
            <Text style={[styles.colTotal, styles.totalsLabelBold]}>Total</Text>
          </View>
          {data.items.map((item, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={styles.colDesc}>{item.description}</Text>
              <Text style={styles.colQty}>{item.quantity}</Text>
              <Text style={styles.colPrice}>{item.unitPriceFormatted}</Text>
              <Text style={styles.colTotal}>{item.totalFormatted}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totalsBlock}>
          <View style={styles.totalsRow}>
            <Text>Subtotal</Text>
            <Text>{data.subtotalFormatted}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text>Tax</Text>
            <Text>{data.taxFormatted}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text>Discount</Text>
            <Text>-{data.discountFormatted}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabelBold}>Booking Total</Text>
            <Text style={styles.totalsLabelBold}>{data.totalFormatted}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text>Amount Paid</Text>
            <Text>{data.paidFormatted}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabelBold}>Remaining Balance</Text>
            <Text style={styles.totalsLabelBold}>{data.balanceFormatted}</Text>
          </View>
        </View>

        {data.terms && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Terms</Text>
            <Text>{data.terms}</Text>
          </View>
        )}
        {data.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text>{data.notes}</Text>
          </View>
        )}

        <Text style={styles.footer}>
          {SITE_DEFAULTS.companyName} — {SITE_DEFAULTS.domain} — {SITE_DEFAULTS.email} — {SITE_DEFAULTS.phone}
        </Text>
      </Page>
    </Document>
  );
}
