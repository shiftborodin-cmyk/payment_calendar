import { getCurrentLocale } from "@/features/settings/i18n";

function padDatePart(value: number) {
  return value.toString().padStart(2, "0");
}

export function formatToDateString(date: Date) {
  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;
}

export function parsePaymentDate(dateString: string) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function isValidPaymentDate(dateString: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return false;
  }

  return formatToDateString(parsePaymentDate(dateString)) === dateString;
}

export function formatPaymentDate(dateString: string) {
  return new Intl.DateTimeFormat(getCurrentLocale(), {
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(parsePaymentDate(dateString));
}

export function getTodayDateString() {
  return formatToDateString(new Date());
}

export function addDaysToDateString(dateString: string, days: number) {
  const date = parsePaymentDate(dateString);
  date.setDate(date.getDate() + days);
  return formatToDateString(date);
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

export function addMonthsClamped(dateString: string, months: number) {
  const [year, month, day] = dateString.split("-").map(Number);
  const targetMonthIndex = month - 1 + months;
  const targetYear = year + Math.floor(targetMonthIndex / 12);
  const normalizedMonthIndex = ((targetMonthIndex % 12) + 12) % 12;
  const normalizedMonth = normalizedMonthIndex + 1;
  const lastDay = getDaysInMonth(targetYear, normalizedMonth);
  const targetDay = Math.min(day, lastDay);

  return `${targetYear}-${padDatePart(normalizedMonth)}-${padDatePart(targetDay)}`;
}

export function addYearsClamped(dateString: string, years: number) {
  const [year, month, day] = dateString.split("-").map(Number);
  const targetYear = year + years;
  const lastDay = getDaysInMonth(targetYear, month);
  const targetDay = Math.min(day, lastDay);

  return `${targetYear}-${padDatePart(month)}-${padDatePart(targetDay)}`;
}

export function compareDateStrings(left: string, right: string) {
  return left.localeCompare(right);
}

export function isDateBefore(left: string, right: string) {
  return compareDateStrings(left, right) < 0;
}

export function isDateSameOrAfter(left: string, right: string) {
  return compareDateStrings(left, right) >= 0;
}

export function getMonthStartDateString(dateString: string) {
  const [year, month] = dateString.split("-").map(Number);
  return `${year}-${padDatePart(month)}-01`;
}

export function getMonthEndDateString(dateString: string) {
  const [year, month] = dateString.split("-").map(Number);
  return `${year}-${padDatePart(month)}-${padDatePart(getDaysInMonth(year, month))}`;
}

export function getDayOfMonth(dateString: string) {
  return Number(dateString.slice(8, 10));
}

export function moveDateByMonthsKeepingDesiredDay(dateString: string, monthDelta: number, desiredDay: number) {
  const [year, month] = dateString.split("-").map(Number);
  const targetMonthIndex = month - 1 + monthDelta;
  const targetYear = year + Math.floor(targetMonthIndex / 12);
  const normalizedMonthIndex = ((targetMonthIndex % 12) + 12) % 12;
  const normalizedMonth = normalizedMonthIndex + 1;
  const lastDay = getDaysInMonth(targetYear, normalizedMonth);
  const targetDay = Math.min(desiredDay, lastDay);

  return `${targetYear}-${padDatePart(normalizedMonth)}-${padDatePart(targetDay)}`;
}

export function getWeekStartDateString(dateString: string) {
  const date = parsePaymentDate(dateString);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return formatToDateString(date);
}
