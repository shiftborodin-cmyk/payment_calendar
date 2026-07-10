import { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";

import { getTodayDateInputValue } from "@/features/payments/paymentFormatters";
import { AppButton } from "@/shared/ui/AppButton";
import { AppTextInput } from "@/shared/ui/AppTextInput";
import { theme } from "@/shared/theme/theme";
import type { PaymentItem } from "@/types/payment";

export type PaymentFormValues = {
  title: string;
  amount: number | null;
  date: string;
  comment: string | null;
};

type PaymentFormProps = {
  initialPayment?: PaymentItem | null;
  submitTitle: string;
  loading?: boolean;
  error?: string | null;
  onSubmit: (values: PaymentFormValues) => Promise<void>;
  onCancel: () => void;
};

function isValidDateInput(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00`).getTime());
}

export function PaymentForm({
  initialPayment,
  submitTitle,
  loading = false,
  error,
  onSubmit,
  onCancel
}: PaymentFormProps) {
  const [title, setTitle] = useState(initialPayment?.title ?? "");
  const [amount, setAmount] = useState(initialPayment?.amount?.toString() ?? "");
  const [date, setDate] = useState(initialPayment?.date ?? getTodayDateInputValue());
  const [comment, setComment] = useState(initialPayment?.comment ?? "");
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit() {
    if (loading) {
      return;
    }

    setFormError(null);

    const trimmedTitle = title.trim();
    const trimmedDate = date.trim();
    const normalizedAmount = amount.trim().replace(",", ".");
    const parsedAmount = normalizedAmount ? Number(normalizedAmount) : null;

    if (!trimmedTitle) {
      setFormError("Введите название платежа.");
      return;
    }

    if (!isValidDateInput(trimmedDate)) {
      setFormError("Введите дату в формате ГГГГ-ММ-ДД.");
      return;
    }

    if (parsedAmount !== null && Number.isNaN(parsedAmount)) {
      setFormError("Введите сумму числом или оставьте поле пустым.");
      return;
    }

    await onSubmit({
      title: trimmedTitle,
      amount: parsedAmount,
      date: trimmedDate,
      comment: comment.trim() || null
    });
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.keyboard}
    >
      <View style={styles.form}>
        <AppTextInput
          label="Название"
          onChangeText={setTitle}
          placeholder="Например, аренда"
          value={title}
        />
        <AppTextInput
          keyboardType="decimal-pad"
          label="Сумма"
          onChangeText={setAmount}
          placeholder="45000"
          value={amount}
        />
        <AppTextInput
          autoCapitalize="none"
          label="Дата"
          onChangeText={setDate}
          placeholder="2026-07-25"
          value={date}
        />
        <AppTextInput
          label="Комментарий"
          multiline
          onChangeText={setComment}
          placeholder="Любая заметка"
          style={styles.commentInput}
          value={comment}
        />

        {formError ? <Text style={styles.error}>{formError}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>

      <View style={styles.actions}>
        <AppButton loading={loading} onPress={handleSubmit} title={submitTitle} />
        <AppButton onPress={onCancel} title="Отмена" variant="secondary" />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboard: {
    flex: 1,
    gap: theme.spacing.lg
  },
  form: {
    gap: theme.spacing.md
  },
  commentInput: {
    minHeight: 92,
    textAlignVertical: "top"
  },
  error: {
    color: theme.colors.danger,
    fontSize: 14,
    lineHeight: 20
  },
  actions: {
    gap: theme.spacing.sm
  }
});
