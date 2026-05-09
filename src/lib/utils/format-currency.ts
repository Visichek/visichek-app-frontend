/**
 * Format a minor-unit amount (e.g., cents) to a display currency string.
 */
export function formatCurrency(
  amountMinor: number,
  currency = "NGN",
  locale = "en-NG"
): string {
  const amount = amountMinor / 100;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format a MAJOR-unit amount (already in whole currency, e.g. 4999.50)
 * to a display currency string. Used for backend fields that already carry
 * float major units like `mrr`, `arr`, `totalMonthlyRevenue`.
 */
export function formatCurrencyMajor(
  amount: number,
  currency = "NGN",
  locale = "en-NG"
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}
