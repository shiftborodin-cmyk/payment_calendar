export type PaymentStatus = "scheduled" | "paid" | "overdue";

export type RepeatRule = "none" | "weekly" | "monthly" | "yearly";

export type NotificationOffset =
  | "same_day"
  | "one_day_before"
  | "three_days_before"
  | "one_week_before";

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
  repeatRule: RepeatRule;
  notificationOffsets: NotificationOffset[];
  createdAt: string;
  updatedAt: string;
};
