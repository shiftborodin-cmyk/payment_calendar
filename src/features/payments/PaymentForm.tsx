import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { isValidPaymentDate } from "@/features/payments/paymentDates";
import { getTodayDateInputValue } from "@/features/payments/paymentFormatters";
import { getDateAfterDays, getDateAfterMonths } from "@/features/payments/paymentOccurrences";
import { AppButton } from "@/shared/ui/AppButton";
import { AppTextInput } from "@/shared/ui/AppTextInput";
import { theme } from "@/shared/theme/theme";
import type { PaymentItem, RepeatRule } from "@/types/payment";

export type PaymentFormValues = {
  title: string;
  amount: number | null;
  date: string;
  comment: string | null;
  repeatRule: RepeatRule;
};

type PaymentFormProps = {
  initialPayment?: PaymentItem | null;
  submitTitle: string;
  loading?: boolean;
  error?: string | null;
  onSubmit: (values: PaymentFormValues) => Promise<void>;
  onCancel: () => void;
};

const quickDateOptions = [
  { label: "Сегодня", getValue: () => getTodayDateInputValue() },
  { label: "Завтра", getValue: () => getDateAfterDays(1) },
  { label: "Через неделю", getValue: () => getDateAfterDays(7) },
  { label: "Через месяц", getValue: () => getDateAfterMonths(1) }
];

const repeatOptions: Array<{ label: string; value: RepeatRule }> = [
  { label: "Не повторять", value: "none" },
  { label: "Каждую неделю", value: "weekly" },
  { label: "Каждый месяц", value: "monthly" },
  { label: "Каждый год", value: "yearly" }
];

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
  const [repeatRule, setRepeatRule] = useState<RepeatRule>(initialPayment?.repeatRule ?? "none");
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

    if (!isValidPaymentDate(trimmedDate)) {
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
      comment: comment.trim() || null,
      repeatRule
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
        <View style={styles.chipGroup}>
          {quickDateOptions.map((option) => (
            <Pressable key={option.label} onPress={() => setDate(option.getValue())} style={styles.chip}>
              <Text style={styles.chipText}>{option.label}</Text>
            </Pressable>
          ))}
        </View>
        <AppTextInput
          label="Комментарий"
          multiline
          onChangeText={setComment}
          placeholder="Любая заметка"
          style={styles.commentInput}
          value={comment}
        />

        <View style={styles.group}>
          <Text style={styles.groupLabel}>Повторяемость</Text>
          <View style={styles.chipGroup}>
            {repeatOptions.map((option) => (
              <Pressable
                key={option.value}
                onPress={() => setRepeatRule(option.value)}
                style={[styles.chip, repeatRule === option.value && styles.chipActive]}
              >
                <Text style={[styles.chipText, repeatRule === option.value && styles.chipTextActive]}>
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

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
  group: {
    gap: theme.spacing.sm
  },
  groupLabel: {
    color: theme.colors.textMuted,
    fontSize: 14,
    fontWeight: "500"
  },
  chipGroup: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm
  },
  chip: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: theme.spacing.md
  },
  chipActive: {
    backgroundColor: theme.colors.primarySoft,
    borderColor: theme.colors.primary
  },
  chipText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: "700"
  },
  chipTextActive: {
    color: theme.colors.primary
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
