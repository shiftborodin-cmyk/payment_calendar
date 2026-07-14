export type PaymentStatus = "scheduled" | "paid" | "overdue";

export type PaymentType = "expense" | "income";

export type RepeatRule = "none" | "weekly" | "monthly" | "yearly";

export type NotificationOffset =
  | "same_day"
  | "one_day_before"
  | "three_days_before"
  | "one_week_before";

export type PaymentOccurrenceOverride = {
  title: string;
  amount: number | null;
  categoryId: string | null;
  comment: string | null;
  type: PaymentType;
};

export type PaymentItem = {
  id: string;
  userId: string;
  categoryId: string | null;
  title: string;
  amount: number | null;
  currency: string;
  date: string;
  time: string | null;
  comment: string | null;
  status: PaymentStatus;
  type: PaymentType;
  repeatRule: RepeatRule;
  notificationOffsets: NotificationOffset[];
  originalPaymentId?: string;
  isGeneratedOccurrence?: boolean;
  paidOccurrenceDates?: string[];
  deletedOccurrenceDates?: string[];
  occurrenceOverrides?: Record<string, PaymentOccurrenceOverride>;
  createdAt: string;
  updatedAt: string;
};
