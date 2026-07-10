import type { PaymentItem } from "@/types/payment";
import { formatPaymentDate as formatLocalPaymentDate, getTodayDateString } from "@/features/payments/paymentDates";

export function formatPaymentDate(date: string) {
  return formatLocalPaymentDate(date);
}

export function formatPaymentAmount(payment: PaymentItem) {
  if (payment.amount === null) {
    return "Без суммы";
  }

  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: payment.currency,
    maximumFractionDigits: 0
  }).format(payment.amount);
}

export function getTodayDateInputValue() {
  return getTodayDateString();
}
