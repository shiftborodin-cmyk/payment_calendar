import {
  createLocalPayment,
  deleteLocalPayment,
  getLocalPayments,
  setLocalPaymentStatus,
  updateLocalPayment,
  updateLocalPaymentOccurrence,
  type LocalPaymentInput
} from "@/features/payments/localPaymentsStorage";

export type CreatePaymentInput = LocalPaymentInput & {
  userId: string;
};

export type UpdatePaymentInput = CreatePaymentInput;

export async function fetchPaymentItems(userId: string) {
  return getLocalPayments(userId);
}

export async function fetchPaymentItemById(userId: string, id: string) {
  const payments = await getLocalPayments(userId);
  return payments.find((payment) => payment.id === id) ?? null;
}

export async function createPaymentItem(input: CreatePaymentInput) {
  return createLocalPayment(input.userId, {
    title: input.title,
    amount: input.amount,
    categoryId: input.categoryId,
    date: input.date,
    comment: input.comment,
    repeatRule: input.repeatRule,
    type: input.type,
    status: input.status
  });
}

export async function updatePaymentItem(id: string, input: UpdatePaymentInput) {
  await updateLocalPayment(input.userId, id, {
    title: input.title,
    amount: input.amount,
    categoryId: input.categoryId,
    date: input.date,
    comment: input.comment,
    repeatRule: input.repeatRule,
    type: input.type
  });
}

export async function updatePaymentOccurrence(
  userId: string,
  paymentId: string,
  occurrenceDate: string,
  input: LocalPaymentInput
) {
  await updateLocalPaymentOccurrence(userId, paymentId, occurrenceDate, input);
}

export async function setPaymentItemStatus(userId: string, id: string, status: "scheduled" | "paid") {
  await setLocalPaymentStatus(userId, id, status);
}

export async function deletePaymentItem(userId: string, id: string) {
  await deleteLocalPayment(userId, id);
}
