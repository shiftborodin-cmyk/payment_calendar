import type { PaymentItem } from "@/types/payment";
import { formatPaymentDate as formatLocalPaymentDate, getTodayDateString } from "@/features/payments/paymentDates";
import { getCurrentLocale, translate } from "@/features/settings/i18n";

export function formatPaymentDate(date: string) {
  return formatLocalPaymentDate(date);
}

export function formatCurrencyValue(value: number, currency = "RUB") {
  const formatted = new Intl.NumberFormat(getCurrentLocale(), {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  }).format(value);

  return getCurrentLocale() === "ru-RU" ? formatted.replace(/(?<=\d)[\u00a0\s](?=\d)/g, ".") : formatted;
}

export function formatAmountInput(value: string) {
  const normalized = value.replace(/\s/g, "").replace(/[^\d,]/g, "");
  const [integerPart = "", fractionPart] = normalized.split(",");
  const integer = integerPart.replace(/^0+(?=\d)/, "");
  const groupedInteger = (integer || "0").replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  return fractionPart === undefined
    ? (integer ? groupedInteger : "")
    : `${groupedInteger},${fractionPart.slice(0, 2)}`;
}

export function formatPaymentAmount(payment: PaymentItem) {
  if (payment.amount === null) {
    return translate("Без суммы", "No amount");
  }

  const formatted = formatCurrencyValue(payment.amount, payment.currency);

  return payment.type === "income" ? `+${formatted}` : formatted;
}

export function getTodayDateInputValue() {
  return getTodayDateString();
}
