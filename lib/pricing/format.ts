// Single shared money formatter — every price-displaying surface (public
// pages, booking flow, admin, emails, invoices, structured data) must go
// through this rather than building its own Intl.NumberFormat call.
// EN uses en-GB, FR uses fr-FR; only digit-grouping/decimal-separator
// conventions change with locale, never the currency itself.
//
// MUR is NOT a legacy path. Customer rental pricing is EUR, but internal
// fleet running costs — maintenance, fuel, compliance, incident repairs —
// are rupee-denominated and actively written today. No conversion logic
// lives here: the two currencies are never mixed into one total.
export function formatMoney(cents: number, currency: string | null | undefined, locale: string) {
  const intlLocale = locale === "fr" ? "fr-FR" : "en-GB";
  // A missing currency (e.g. a row read before its migration has run) falls
  // back to EUR rather than throwing — Intl.NumberFormat requires a
  // currency code with style: "currency" and would otherwise crash the
  // whole page render for what is, in practice, a transient data gap.
  const resolvedCurrency = currency || "EUR";

  if (resolvedCurrency === "MUR") {
    // Two decimals, not zero: a tyre change costing Rs 1,499.77 must not
    // render as "Rs 1,500". Fleet expenses are reconciled against supplier
    // invoices to the cent.
    const amount = new Intl.NumberFormat(intlLocale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(cents / 100);
    return `Rs ${amount}`;
  }

  return new Intl.NumberFormat(intlLocale, {
    style: "currency",
    currency: resolvedCurrency,
  }).format(cents / 100);
}
