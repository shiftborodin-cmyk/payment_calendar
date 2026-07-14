import AsyncStorage from "@react-native-async-storage/async-storage";

import type { PaymentItem, PaymentOccurrenceOverride, PaymentStatus, PaymentType, RepeatRule } from "@/types/payment";

export type LocalPaymentInput = {
  title: string;
  amount: number | null;
  date: string;
  comment: string | null;
  repeatRule: RepeatRule;
  categoryId?: string | null;
  type: PaymentType;
};

type LocalPaymentRow = {
  id: string;
  user_id: string;
  title: string;
  amount: number | null;
  category_id?: string | null;
  currency: string;
  date: string;
  comment: string | null;
  status: PaymentStatus;
  repeat_rule?: RepeatRule;
  paid_occurrence_dates?: string[];
  deleted_occurrence_dates?: string[];
  occurrence_overrides?: Record<string, PaymentOccurrenceOverride>;
  type?: PaymentType;
  created_at: string;
  updated_at: string;
};

const localOperationTimeoutMs = 5000;
let localRequestCounter = 0;

function getOperationName(label: string) {
  if (label.startsWith("Загрузка")) {
    return "fetch";
  }

  if (label.startsWith("Создание")) {
    return "create";
  }

  if (label.startsWith("Обновление")) {
    return "update";
  }

  if (label.startsWith("Удаление")) {
    return "delete";
  }

  if (label.startsWith("Отметка")) {
    return "markPaid";
  }

  if (label.startsWith("Изменение статуса")) {
    return "status";
  }

  return "operation";
}

function getSuccessMeta(result: unknown) {
  return Array.isArray(result) ? { count: result.length } : null;
}

async function withLocalDiagnostics<T>(label: string, operation: () => Promise<T>) {
  const requestId = localRequestCounter + 1;
  localRequestCounter = requestId;

  const operationName = getOperationName(label);
  const timeoutMessage = `${label}: локальное хранилище не ответило за 5 секунд`;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  console.log(`[localPayments] ${operationName} start #${requestId}`);

  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      console.error(`[localPayments] timeout #${requestId}`, timeoutMessage);
      reject(new Error(timeoutMessage));
    }, localOperationTimeoutMs);
  });

  try {
    const result = await Promise.race([operation(), timeout]);
    const successMeta = getSuccessMeta(result);

    if (successMeta) {
      console.log(`[localPayments] ${operationName} success #${requestId}`, successMeta);
    } else {
      console.log(`[localPayments] ${operationName} success #${requestId}`);
    }

    return result;
  } catch (error) {
    console.error(`[localPayments] failed #${requestId}`, error);
    throw error;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

function getStorageKey(userId: string) {
  return `payment_items:${userId}`;
}

function createLocalId() {
  return `local_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function mapLocalPayment(row: LocalPaymentRow): PaymentItem {
  return {
    id: row.id,
    userId: row.user_id,
    categoryId: row.category_id ?? null,
    title: row.title,
    amount: row.amount,
    currency: row.currency,
    date: row.date,
    time: null,
    comment: row.comment,
    status: row.status,
    type: row.type === "income" ? "income" : "expense",
    repeatRule: row.repeat_rule ?? "none",
    paidOccurrenceDates: row.paid_occurrence_dates ?? [],
    deletedOccurrenceDates: row.deleted_occurrence_dates ?? [],
    occurrenceOverrides: row.occurrence_overrides ?? {},
    notificationOffsets: [],
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function sortPaymentRows(rows: LocalPaymentRow[]) {
  return [...rows].sort(
    (left, right) => left.date.localeCompare(right.date) || left.created_at.localeCompare(right.created_at)
  );
}

async function readRows(userId: string) {
  const rawValue = await AsyncStorage.getItem(getStorageKey(userId));

  if (!rawValue) {
    return [];
  }

  try {
    const parsedValue = JSON.parse(rawValue);
    return Array.isArray(parsedValue) ? (parsedValue as LocalPaymentRow[]) : [];
  } catch {
    return [];
  }
}

async function writeRows(userId: string, rows: LocalPaymentRow[]) {
  await AsyncStorage.setItem(getStorageKey(userId), JSON.stringify(sortPaymentRows(rows)));
}

export async function getLocalPayments(userId: string) {
  return withLocalDiagnostics("Загрузка локальных платежей", async () => {
    const rows = await readRows(userId);
    return sortPaymentRows(rows).map(mapLocalPayment);
  });
}

export async function createLocalPayment(userId: string, input: LocalPaymentInput) {
  return withLocalDiagnostics("Создание локального платежа", async () => {
    const rows = await readRows(userId);
    const now = new Date().toISOString();
    const payment: LocalPaymentRow = {
      id: createLocalId(),
      user_id: userId,
      title: input.title,
      amount: input.amount,
      category_id: input.categoryId ?? null,
      currency: "RUB",
      date: input.date,
      comment: input.comment,
      status: "scheduled",
      type: input.type,
      repeat_rule: input.repeatRule,
      created_at: now,
      updated_at: now
    };

    await writeRows(userId, [...rows, payment]);

    return mapLocalPayment(payment);
  });
}

export async function updateLocalPayment(userId: string, paymentId: string, input: LocalPaymentInput) {
  return withLocalDiagnostics("Обновление локального платежа", async () => {
    const rows = await readRows(userId);
    const now = new Date().toISOString();
    const nextRows = rows.map((payment) => {
      if (payment.id !== paymentId) {
        return payment;
      }

      const scheduleChanged = payment.date !== input.date || (payment.repeat_rule ?? "none") !== input.repeatRule;

      return {
        ...payment,
        title: input.title,
        amount: input.amount,
        category_id: input.categoryId ?? null,
        date: input.date,
        comment: input.comment,
        repeat_rule: input.repeatRule,
        type: input.type,
        ...(scheduleChanged
          ? {
              paid_occurrence_dates: [],
              deleted_occurrence_dates: [],
              occurrence_overrides: {}
            }
          : {}),
        updated_at: now
      };
    });

    await writeRows(userId, nextRows);
  });
}

export async function updateLocalPaymentOccurrence(
  userId: string,
  paymentId: string,
  occurrenceDate: string,
  input: LocalPaymentInput
) {
  return withLocalDiagnostics("Обновление локального платежа", async () => {
    const rows = await readRows(userId);
    const now = new Date().toISOString();
    const nextRows = rows.map((payment) => {
      if (payment.id !== paymentId) {
        return payment;
      }

      return {
        ...payment,
        occurrence_overrides: {
          ...(payment.occurrence_overrides ?? {}),
          [occurrenceDate]: {
            title: input.title,
            amount: input.amount,
            categoryId: input.categoryId ?? null,
            comment: input.comment,
            type: input.type
          }
        },
        updated_at: now
      };
    });

    await writeRows(userId, nextRows);
  });
}

export async function deleteLocalPayment(userId: string, paymentId: string) {
  return withLocalDiagnostics("Удаление локального платежа", async () => {
    const rows = await readRows(userId);
    const separatorIndex = paymentId.lastIndexOf(":");
    const occurrenceDate = separatorIndex > 0 ? paymentId.slice(separatorIndex + 1) : null;
    const sourcePaymentId = separatorIndex > 0 ? paymentId.slice(0, separatorIndex) : paymentId;
    const isGeneratedOccurrence = Boolean(occurrenceDate && /^\d{4}-\d{2}-\d{2}$/.test(occurrenceDate));

    if (isGeneratedOccurrence) {
      const nextRows = rows.map((payment) => {
        if (payment.id !== sourcePaymentId || !payment.repeat_rule || payment.repeat_rule === "none") {
          return payment;
        }

        const deletedDates = new Set(payment.deleted_occurrence_dates ?? []);
        deletedDates.add(occurrenceDate!);

        return {
          ...payment,
          deleted_occurrence_dates: Array.from(deletedDates).sort(),
          updated_at: new Date().toISOString()
        };
      });

      await writeRows(userId, nextRows);
      return;
    }

    await writeRows(userId, rows.filter((payment) => payment.id !== paymentId));
  });
}

export async function setLocalPaymentStatus(userId: string, paymentId: string, status: PaymentStatus) {
  return withLocalDiagnostics("Изменение статуса локального платежа", async () => {
    const rows = await readRows(userId);
    const now = new Date().toISOString();
    const separatorIndex = paymentId.lastIndexOf(":");
    const generatedDate = separatorIndex > 0 ? paymentId.slice(separatorIndex + 1) : null;
    const sourcePaymentId = separatorIndex > 0 ? paymentId.slice(0, separatorIndex) : paymentId;
    const isGeneratedOccurrence = Boolean(generatedDate && /^\d{4}-\d{2}-\d{2}$/.test(generatedDate));

    const nextRows = rows.map((payment) => {
      if (payment.id !== sourcePaymentId) {
        return payment;
      }

      if (payment.repeat_rule && payment.repeat_rule !== "none") {
        const occurrenceDate = isGeneratedOccurrence ? generatedDate! : payment.date;
        const paidDates = new Set(payment.paid_occurrence_dates ?? []);

        if (status === "paid") {
          paidDates.add(occurrenceDate);
        } else {
          paidDates.delete(occurrenceDate);
        }

        return {
          ...payment,
          status: "scheduled" as PaymentStatus,
          paid_occurrence_dates: Array.from(paidDates).sort(),
          updated_at: now
        };
      }

      return {
        ...payment,
        status,
        updated_at: now
      };
    });

    await writeRows(userId, nextRows);
  });
}

export async function clearLocalPaymentCategory(userId: string, categoryId: string) {
  return withLocalDiagnostics("Обновление локального платежа", async () => {
    const rows = await readRows(userId);
    const now = new Date().toISOString();
    const nextRows = rows.map((payment) =>
      payment.category_id === categoryId
        ? {
            ...payment,
            category_id: null,
            updated_at: now
          }
        : payment
    );

    await writeRows(userId, nextRows);
  });
}
