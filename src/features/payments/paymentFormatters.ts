import type { PaymentItem } from "@/types/payment";

export function formatPaymentDate(date: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(new Date(`${date}T00:00:00`));
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
  return new Date().toISOString().slice(0, 10);
}
