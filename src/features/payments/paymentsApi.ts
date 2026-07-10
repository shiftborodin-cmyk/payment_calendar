import {
  createLocalPayment,
  deleteLocalPayment,
  getLocalPayments,
  markLocalPaymentPaid,
  updateLocalPayment,
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
  await createLocalPayment(input.userId, {
    title: input.title,
    amount: input.amount,
    date: input.date,
    comment: input.comment,
    repeatRule: input.repeatRule
  });
}

export async function updatePaymentItem(id: string, input: UpdatePaymentInput) {
  await updateLocalPayment(input.userId, id, {
    title: input.title,
    amount: input.amount,
    date: input.date,
    comment: input.comment,
    repeatRule: input.repeatRule
  });
}

export async function markPaymentItemPaid(userId: string, id: string) {
  await markLocalPaymentPaid(userId, id);
}

export async function deletePaymentItem(userId: string, id: string) {
  await deleteLocalPayment(userId, id);
}
