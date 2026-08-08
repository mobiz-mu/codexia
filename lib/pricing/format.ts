// Single shared money formatter — every price-displaying surface (public
// pages, booking flow, admin, emails, invoices, structured data) must go
// through this rather than building its own Intl.NumberFormat call.
// EN uses en-GB, FR uses fr-FR; only digit-grouping/decimal-separator
// conventions change with locale, never the currency itself. MUR is a
// legacy display path for historical (pre-EUR-migration) records only —
// no currency selector or conversion logic lives here.
export function formatMoney(cents: number, currency: string | null | undefined, locale: string) {
  const intlLocale = locale === "fr" ? "fr-FR" : "en-GB";
  // A missing currency (e.g. a row read before its migration has run) falls
  // back to EUR rather than throwing — Intl.NumberFormat requires a
  // currency code with style: "currency" and would otherwise crash the
  // whole page render for what is, in practice, a transient data gap.
  const resolvedCurrency = currency || "EUR";

  if (resolvedCurrency === "MUR") {
    const amount = new Intl.NumberFormat(intlLocale, { maximumFractionDigits: 0 }).format(cents / 100);
    return `Rs ${amount}`;
  }

  return new Intl.NumberFormat(intlLocale, {
    style: "currency",
    currency: resolvedCurrency,
  }).format(cents / 100);
}
