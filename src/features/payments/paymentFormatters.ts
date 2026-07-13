import type { PaymentItem } from "@/types/payment";
import { formatPaymentDate as formatLocalPaymentDate, getTodayDateString } from "@/features/payments/paymentDates";
import { getCurrentLocale, translate } from "@/features/settings/i18n";

export function formatPaymentDate(date: string) {
  return formatLocalPaymentDate(date);
}

export function formatPaymentAmount(payment: PaymentItem) {
  if (payment.amount === null) {
    return translate("Без суммы", "No amount");
  }

  const formatted = new Intl.NumberFormat(getCurrentLocale(), {
    style: "currency",
    currency: payment.currency,
    maximumFractionDigits: 0
  }).format(payment.amount);

  return payment.type === "income" ? `+${formatted}` : formatted;
}

export function getTodayDateInputValue() {
  return getTodayDateString();
}
