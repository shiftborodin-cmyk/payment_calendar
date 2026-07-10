import {
  addDaysToDateString,
  getMonthEndDateString,
  getMonthStartDateString
} from "@/features/payments/paymentDates";
import { getPaymentsForRange } from "@/features/payments/paymentOccurrences";
import type { PaymentItem } from "@/types/payment";

export type DailyBalanceForecast = {
  balance: number;
  date: string;
  income: number;
  expense: number;
  isNegative: boolean;
};

export function getMonthlyBalanceForecast(
  payments: PaymentItem[],
  monthDate: string,
  openingBalance: number
) {
  const monthStart = getMonthStartDateString(monthDate);
  const monthEnd = getMonthEndDateString(monthDate);
  const monthPayments = getPaymentsForRange(payments, monthStart, monthEnd);
  const paymentsByDate = new Map<string, PaymentItem[]>();

  monthPayments.forEach((payment) => {
    const current = paymentsByDate.get(payment.date) ?? [];
    current.push(payment);
    paymentsByDate.set(payment.date, current);
  });

  const forecast = new Map<string, DailyBalanceForecast>();
  let balance = openingBalance;
  let date = monthStart;

  while (date <= monthEnd) {
    const dayPayments = paymentsByDate.get(date) ?? [];
    const income = dayPayments.reduce(
      (sum, payment) => sum + (payment.type === "income" ? payment.amount ?? 0 : 0),
      0
    );
    const expense = dayPayments.reduce(
      (sum, payment) => sum + (payment.type === "expense" ? payment.amount ?? 0 : 0),
      0
    );

    balance += income - expense;
    forecast.set(date, {
      balance,
      date,
      expense,
      income,
      isNegative: balance < 0
    });
    date = addDaysToDateString(date, 1);
  }

  return forecast;
}

export function getForecastForDate(
  payments: PaymentItem[],
  date: string,
  openingBalance: number
) {
  return getMonthlyBalanceForecast(payments, date, openingBalance).get(date) ?? null;
}
