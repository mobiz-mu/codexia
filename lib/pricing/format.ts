export function formatMoney(cents: number, currency: string, locale: string) {
  if (currency === "MUR") {
    const amount = new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-GB", {
      maximumFractionDigits: 0,
    }).format(cents / 100);
    return `Rs ${amount}`;
  }

  return new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-GB", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}
