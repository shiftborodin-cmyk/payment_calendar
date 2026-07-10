import AsyncStorage from "@react-native-async-storage/async-storage";

import type { PaymentItem, PaymentStatus, RepeatRule } from "@/types/payment";

export type LocalPaymentInput = {
  title: string;
  amount: number | null;
  date: string;
  comment: string | null;
  repeatRule: RepeatRule;
};

type LocalPaymentRow = {
  id: string;
  user_id: string;
  title: string;
  amount: number | null;
  currency: string;
  date: string;
  comment: string | null;
  status: PaymentStatus;
  repeat_rule?: RepeatRule;
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
    categoryId: null,
    title: row.title,
    amount: row.amount,
    currency: row.currency,
    date: row.date,
    time: null,
    comment: row.comment,
    status: row.status,
    repeatRule: row.repeat_rule ?? "none",
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
      currency: "RUB",
      date: input.date,
      comment: input.comment,
      status: "scheduled",
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
    const nextRows = rows.map((payment) =>
      payment.id === paymentId
        ? {
            ...payment,
            title: input.title,
            amount: input.amount,
            date: input.date,
            comment: input.comment,
            repeat_rule: input.repeatRule,
            updated_at: now
          }
        : payment
    );

    await writeRows(userId, nextRows);
  });
}

export async function deleteLocalPayment(userId: string, paymentId: string) {
  return withLocalDiagnostics("Удаление локального платежа", async () => {
    const rows = await readRows(userId);
    await writeRows(userId, rows.filter((payment) => payment.id !== paymentId));
  });
}

export async function markLocalPaymentPaid(userId: string, paymentId: string) {
  return withLocalDiagnostics("Отметка локального платежа оплаченной", async () => {
    const rows = await readRows(userId);
    const now = new Date().toISOString();
    const nextRows = rows.map((payment) =>
      payment.id === paymentId
        ? {
            ...payment,
            status: "paid" as PaymentStatus,
            updated_at: now
          }
        : payment
    );

    await writeRows(userId, nextRows);
  });
}
