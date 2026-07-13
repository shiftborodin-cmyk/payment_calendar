import {
  addDaysToDateString,
  addMonthsClamped,
  addYearsClamped,
  compareDateStrings,
  formatToDateString,
  getTodayDateString,
  isDateBefore,
  isDateSameOrAfter
} from "@/features/payments/paymentDates";
import type { PaymentItem } from "@/types/payment";

type ExpandOptions = {
  startDate?: string;
  endDate?: string;
};

const defaultHorizonMonths = 12;

function getDefaultEndDate() {
  return addMonthsClamped(getTodayDateString(), defaultHorizonMonths);
}

function createOccurrence(payment: PaymentItem, date: string, isGenerated: boolean): PaymentItem {
  if (!isGenerated) {
    return payment;
  }

  return {
    ...payment,
    date,
    id: `${payment.id}:${date}`,
    isGeneratedOccurrence: true,
    originalPaymentId: payment.id
  };
}

function getOccurrenceDate(sourceDate: string, index: number, repeatRule: PaymentItem["repeatRule"]) {
  if (repeatRule === "weekly") {
    return addDaysToDateString(sourceDate, index * 7);
  }

  if (repeatRule === "monthly") {
    return addMonthsClamped(sourceDate, index);
  }

  if (repeatRule === "yearly") {
    return addYearsClamped(sourceDate, index);
  }

  return sourceDate;
}

export function isPaymentOverdue(payment: Pick<PaymentItem, "date" | "status">, today = getTodayDateString()) {
  if (payment.status === "paid") {
    return false;
  }

  return isDateBefore(payment.date, today);
}

export function expandPaymentOccurrences(payments: PaymentItem[], options: ExpandOptions = {}) {
  const startDate = options.startDate ?? getTodayDateString();
  const endDate = options.endDate ?? getDefaultEndDate();
  const occurrences: PaymentItem[] = [];

  payments.forEach((payment) => {
    const repeatRule = payment.repeatRule ?? "none";
    const sourceDate = payment.date;

    if (repeatRule === "none" || payment.status === "paid") {
      if (isDateSameOrAfter(sourceDate, startDate) && compareDateStrings(sourceDate, endDate) <= 0) {
        occurrences.push(createOccurrence(payment, sourceDate, false));
      }

      return;
    }

    let index = 0;

    while (index < 1200) {
      const occurrenceDate = getOccurrenceDate(sourceDate, index, repeatRule);

      if (compareDateStrings(occurrenceDate, endDate) > 0) {
        break;
      }

      if (isDateSameOrAfter(occurrenceDate, startDate)) {
        occurrences.push(createOccurrence(payment, occurrenceDate, index > 0));
      }

      index += 1;
    }
  });

  return sortPaymentsByDate(occurrences);
}

export function getPaymentsForDate(payments: PaymentItem[], date: string) {
  return expandPaymentOccurrences(payments, { startDate: date, endDate: date });
}

export function getPaymentsForRange(payments: PaymentItem[], startDate: string, endDate: string) {
  return expandPaymentOccurrences(payments, { startDate, endDate });
}

export function sortPaymentsByDate(payments: PaymentItem[]) {
  return [...payments].sort(
    (left, right) => compareDateStrings(left.date, right.date) || left.createdAt.localeCompare(right.createdAt)
  );
}

export function getDateValue(date?: Date) {
  return date ? formatToDateString(date) : getTodayDateString();
}

export function getDateAfterDays(days: number) {
  return addDaysToDateString(getTodayDateString(), days);
}

export function getDateAfterMonths(months: number) {
  return addMonthsClamped(getTodayDateString(), months);
}
