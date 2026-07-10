import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/features/auth/AuthContext";
import { getLocalCategories, type LocalCategory } from "@/features/categories/localCategoriesStorage";
import { useAppSettings } from "@/features/settings/AppSettingsContext";
import { translate } from "@/features/settings/i18n";
import { isValidPaymentDate } from "@/features/payments/paymentDates";
import { getTodayDateInputValue } from "@/features/payments/paymentFormatters";
import { getDateAfterDays, getDateAfterMonths } from "@/features/payments/paymentOccurrences";
import { AppButton } from "@/shared/ui/AppButton";
import { AppTextInput } from "@/shared/ui/AppTextInput";
import { theme } from "@/shared/theme/theme";
import type { PaymentItem, PaymentType, RepeatRule } from "@/types/payment";

export type PaymentFormValues = {
  title: string;
  amount: number | null;
  date: string;
  comment: string | null;
  repeatRule: RepeatRule;
  categoryId?: string | null;
  type: PaymentType;
};

type PaymentFormProps = {
  initialPayment?: PaymentItem | null;
  submitTitle: string;
  loading?: boolean;
  error?: string | null;
  onSubmit: (values: PaymentFormValues) => Promise<void>;
  onCancel: () => void;
  initialType?: PaymentType;
  lockType?: boolean;
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
  onCancel,
  initialType = "expense",
  lockType = false
}: PaymentFormProps) {
  const { user } = useAuth();
  const { settings } = useAppSettings();
  const [title, setTitle] = useState(initialPayment?.title ?? "");
  const [amount, setAmount] = useState(initialPayment?.amount?.toString() ?? "");
  const [date, setDate] = useState(initialPayment?.date ?? getTodayDateInputValue());
  const [comment, setComment] = useState(initialPayment?.comment ?? "");
  const [repeatRule, setRepeatRule] = useState<RepeatRule>(initialPayment?.repeatRule ?? "none");
  const [categoryId, setCategoryId] = useState<string | null>(initialPayment?.categoryId ?? null);
  const [type, setType] = useState<PaymentType>(initialPayment?.type ?? initialType);
  const [categories, setCategories] = useState<LocalCategory[]>([]);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadCategories() {
      if (!user) {
        return;
      }

      try {
        const nextCategories = await getLocalCategories(user.id);

        if (isActive) {
          setCategories(nextCategories);
          setCategoryError(null);
        }
      } catch {
        if (isActive) {
          setCategoryError("Категории временно недоступны. Платёж можно сохранить без категории.");
        }
      }
    }

    loadCategories();

    return () => {
      isActive = false;
    };
  }, [user]);

  useEffect(() => {
    if (!initialPayment) {
      setType(initialType);
      if (initialType === "income") {
        setCategoryId(null);
      }
    }
  }, [initialPayment, initialType]);

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

    if (parsedAmount !== null && (!Number.isFinite(parsedAmount) || parsedAmount < 0)) {
      setFormError("Введите сумму числом не меньше нуля или оставьте поле пустым.");
      return;
    }

    await onSubmit({
      title: trimmedTitle,
      amount: parsedAmount,
      date: trimmedDate,
      comment: comment.trim() || null,
      repeatRule,
      categoryId: type === "income" ? null : categoryId,
      type
    });
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.keyboard}
    >
      <View style={styles.form}>
        {settings.includeIncome && !lockType ? (
          <View style={styles.group}>
            <Text style={styles.groupLabel}>{translate("Тип операции", "Operation type")}</Text>
            <View style={styles.chipGroup}>
              {([
                { label: translate("Расход", "Expense"), value: "expense" as const },
                { label: translate("Доход", "Income"), value: "income" as const }
              ]).map((option) => (
                <Pressable
                  key={option.value}
                  onPress={() => setType(option.value)}
                  style={[styles.chip, type === option.value && styles.chipActive]}
                >
                  <Text style={[styles.chipText, type === option.value && styles.chipTextActive]}>
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}
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
            (() => {
              const optionDate = option.getValue();
              const isActive = date === optionDate;

              return (
                <Pressable
                  key={option.label}
                  onPress={() => setDate(optionDate)}
                  style={[styles.chip, isActive && styles.chipActive]}
                >
                  <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{option.label}</Text>
                </Pressable>
              );
            })()
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

        {type === "expense" ? <View style={styles.group}>
          <Text style={styles.groupLabel}>Категория</Text>
          <View style={styles.chipGroup}>
            <Pressable
              onPress={() => setCategoryId(null)}
              style={[styles.chip, categoryId === null && styles.chipActive]}
            >
              <Text style={[styles.chipText, categoryId === null && styles.chipTextActive]}>
                Без категории
              </Text>
            </Pressable>
            {categories.map((category) => (
              <Pressable
                key={category.id}
                onPress={() => setCategoryId(category.id)}
                style={[styles.chip, categoryId === category.id && styles.chipActive]}
              >
                <Ionicons color={category.color} name={category.icon as keyof typeof Ionicons.glyphMap} size={16} />
                <Text style={[styles.chipText, categoryId === category.id && styles.chipTextActive]}>
                  {category.name}
                </Text>
              </Pressable>
            ))}
          </View>
          {categoryError ? <Text style={styles.hintText}>{categoryError}</Text> : null}
        </View> : null}

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
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: theme.spacing.xs,
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
  categoryDot: {
    borderRadius: 5,
    height: 10,
    width: 10
  },
  hintText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    lineHeight: 18
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
