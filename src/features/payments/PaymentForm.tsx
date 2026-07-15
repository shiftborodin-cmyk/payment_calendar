import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/features/auth/AuthContext";
import { getLocalCategories, type LocalCategory } from "@/features/categories/localCategoriesStorage";
import { useAppSettings } from "@/features/settings/AppSettingsContext";
import { translate } from "@/features/settings/i18n";
import { isValidPaymentDate } from "@/features/payments/paymentDates";
import { formatAmountInput, getTodayDateInputValue } from "@/features/payments/paymentFormatters";
import { getDateAfterDays, getDateAfterMonths } from "@/features/payments/paymentOccurrences";
import { AppButton } from "@/shared/ui/AppButton";
import { AppTextInput } from "@/shared/ui/AppTextInput";
import { PaymentDatePicker } from "@/shared/ui/PaymentDatePicker";
import { useTheme, type AppTheme } from "@/shared/theme/theme";
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
  lockDate?: boolean;
  hideRepeatRule?: boolean;
  initialDate?: string;
};

const quickDateOptions = [
  { ru: "Сегодня", en: "Today", getValue: () => getTodayDateInputValue() },
  { ru: "Завтра", en: "Tomorrow", getValue: () => getDateAfterDays(1) },
  { ru: "Через неделю", en: "In a week", getValue: () => getDateAfterDays(7) },
  { ru: "Через месяц", en: "In a month", getValue: () => getDateAfterMonths(1) }
];

const repeatOptions: Array<{ ru: string; en: string; value: RepeatRule }> = [
  { ru: "Не повторять", en: "Do not repeat", value: "none" },
  { ru: "Каждую неделю", en: "Every week", value: "weekly" },
  { ru: "Каждый месяц", en: "Every month", value: "monthly" },
  { ru: "Каждый год", en: "Every year", value: "yearly" }
];

export function PaymentForm({
  initialPayment,
  submitTitle,
  loading = false,
  error,
  onSubmit,
  onCancel,
  initialType = "expense",
  lockType = false,
  lockDate = false,
  hideRepeatRule = false,
  initialDate
}: PaymentFormProps) {
  const { user } = useAuth();
  const { settings } = useAppSettings();
  const theme = useTheme();
  const styles = createStyles(theme);
  const [title, setTitle] = useState(initialPayment?.title ?? "");
  const [amount, setAmount] = useState(initialPayment?.amount === null || initialPayment?.amount === undefined ? "" : formatAmountInput(String(initialPayment.amount)));
  const [date, setDate] = useState(initialPayment?.date ?? initialDate ?? getTodayDateInputValue());
  const [calendarMonth, setCalendarMonth] = useState(initialPayment?.date ?? initialDate ?? getTodayDateInputValue());
  const [datePickerVisible, setDatePickerVisible] = useState(false);
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
    const normalizedAmount = amount.trim().replace(/\./g, "").replace(",", ".");
    const parsedAmount = normalizedAmount ? Number(normalizedAmount) : null;

    if (!trimmedTitle) {
      setFormError(translate("Введите название операции.", "Enter an operation name."));
      return;
    }

    if (!isValidPaymentDate(trimmedDate)) {
      setFormError(translate("Выберите корректную дату.", "Choose a valid date."));
      return;
    }

    if (parsedAmount !== null && (!Number.isFinite(parsedAmount) || parsedAmount < 0)) {
      setFormError(translate("Введите сумму числом не меньше нуля или оставьте поле пустым.", "Enter a non-negative amount or leave it empty."));
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
          label={translate("Название", "Title")}
          onChangeText={setTitle}
          placeholder={translate("Например, аренда", "For example, rent")}
          value={title}
        />
        <AppTextInput
          keyboardType="decimal-pad"
          label={translate("Сумма", "Amount")}
          onChangeText={(value) => setAmount(formatAmountInput(value))}
          placeholder="45000"
          value={amount}
        />
        <View style={styles.group}>
          <Text style={styles.groupLabel}>{translate("Дата", "Date")}</Text>
          <Pressable
            accessibilityRole={lockDate ? undefined : "button"}
            disabled={lockDate}
            onPress={() => {
              if (lockDate) {
                return;
              }

              setCalendarMonth(date);
              setDatePickerVisible(true);
            }}
            style={({ pressed }) => [
              styles.dateButton,
              lockDate && styles.dateButtonLocked,
              pressed && !lockDate && styles.dateButtonPressed
            ]}
          >
            <Ionicons color={theme.colors.text} name="calendar-outline" size={20} />
            <Text style={styles.dateButtonText}>{date}</Text>
            <Text style={styles.dateButtonHint}>
              {lockDate ? translate("Это повторение", "This occurrence") : translate("Выбрать", "Choose")}
            </Text>
          </Pressable>
        </View>
        {!lockDate ? (
          <View style={styles.chipGroup}>
            {quickDateOptions.map((option) => (
              (() => {
                const optionDate = option.getValue();
                const isActive = date === optionDate;

                return (
                  <Pressable
                    key={option.ru}
                    onPress={() => {
                      setDate(optionDate);
                      setCalendarMonth(optionDate);
                    }}
                    style={[styles.chip, isActive && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{translate(option.ru, option.en)}</Text>
                  </Pressable>
                );
              })()
            ))}
          </View>
        ) : null}
        <AppTextInput
          label={translate("Комментарий", "Comment")}
          multiline
          onChangeText={setComment}
          placeholder={translate("Любая заметка", "Any note")}
          style={styles.commentInput}
          value={comment}
        />

        {type === "expense" ? <View style={styles.group}>
          <Text style={styles.groupLabel}>{translate("Категория", "Category")}</Text>
          <View style={styles.chipGroup}>
            <Pressable
              onPress={() => setCategoryId(null)}
              style={[styles.chip, categoryId === null && styles.chipActive]}
            >
              <Text style={[styles.chipText, categoryId === null && styles.chipTextActive]}>
                {translate("Без категории", "No category")}
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

        {!hideRepeatRule ? (
          <View style={styles.group}>
            <Text style={styles.groupLabel}>{translate("Повторяемость", "Repeat")}</Text>
            <View style={styles.chipGroup}>
              {repeatOptions.map((option) => (
                <Pressable
                  key={option.value}
                  onPress={() => setRepeatRule(option.value)}
                  style={[styles.chip, repeatRule === option.value && styles.chipActive]}
                >
                  <Text style={[styles.chipText, repeatRule === option.value && styles.chipTextActive]}>
                      {translate(option.ru, option.en)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {formError ? <Text style={styles.error}>{formError}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>

      <View style={styles.actions}>
        <AppButton loading={loading} onPress={handleSubmit} title={submitTitle} />
        <AppButton onPress={onCancel} title={translate("Отмена", "Cancel")} variant="secondary" />
      </View>
      <PaymentDatePicker
        monthDate={calendarMonth}
        onChangeMonth={setCalendarMonth}
        onClose={() => setDatePickerVisible(false)}
        onSelect={(nextDate) => {
          setDate(nextDate);
          setCalendarMonth(nextDate);
          setDatePickerVisible(false);
        }}
        selectedDate={date}
        visible={datePickerVisible}
      />
    </KeyboardAvoidingView>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
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
  dateButton: {
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: theme.spacing.sm,
    minHeight: 50,
    paddingHorizontal: theme.spacing.md
  },
  dateButtonPressed: {
    opacity: 0.82
  },
  dateButtonLocked: {
    opacity: 0.72
  },
  dateButtonText: {
    color: theme.colors.text,
    flex: 1,
    fontSize: 16,
    fontWeight: "700"
  },
  dateButtonHint: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: "600"
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
}
