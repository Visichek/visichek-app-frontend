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
