import { getSupabaseClient } from "@/shared/api/supabase";
import type { PaymentItem, PaymentStatus } from "@/types/payment";

type PaymentItemRow = {
  id: string;
  user_id: string;
  category_id: string | null;
  title: string;
  amount: number | string | null;
  currency: string;
  date: string;
  comment: string | null;
  status: PaymentStatus;
  created_at: string;
  updated_at: string;
};

type CreatePaymentInput = {
  userId: string;
  title: string;
  amount: number | null;
  date: string;
  comment: string | null;
};

function mapPaymentItem(row: PaymentItemRow): PaymentItem {
  return {
    id: row.id,
    userId: row.user_id,
    categoryId: row.category_id,
    title: row.title,
    amount: row.amount === null ? null : Number(row.amount),
    currency: row.currency,
    date: row.date,
    time: null,
    comment: row.comment,
    status: row.status,
    repeatRule: "none",
    notificationOffsets: [],
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function fetchPaymentItems(userId: string) {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("payment_items")
    .select("id,user_id,category_id,title,amount,currency,date,comment,status,created_at,updated_at")
    .eq("user_id", userId)
    .order("date", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => mapPaymentItem(row as PaymentItemRow));
}

export async function createPaymentItem(input: CreatePaymentInput) {
  const supabase = getSupabaseClient();

  const { error } = await supabase.from("payment_items").insert({
    user_id: input.userId,
    title: input.title,
    amount: input.amount,
    date: input.date,
    comment: input.comment,
    status: "scheduled"
  });

  if (error) {
    throw error;
  }
}

export async function markPaymentItemPaid(id: string) {
  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from("payment_items")
    .update({ status: "paid", updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    throw error;
  }
}

export async function deletePaymentItem(id: string) {
  const supabase = getSupabaseClient();

  const { error } = await supabase.from("payment_items").delete().eq("id", id);

  if (error) {
    throw error;
  }
}
