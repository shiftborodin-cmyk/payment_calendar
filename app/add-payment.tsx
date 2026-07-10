import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/features/auth/AuthContext";
import { createPaymentItem } from "@/features/payments/paymentsApi";
import { getTodayDateInputValue } from "@/features/payments/paymentFormatters";
import { AppButton } from "@/shared/ui/AppButton";
import { AppTextInput } from "@/shared/ui/AppTextInput";
import { ScreenContainer } from "@/shared/ui/ScreenContainer";
import { theme } from "@/shared/theme/theme";

function isValidDateInput(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00`).getTime());
}

export default function AddPaymentScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(getTodayDateInputValue());
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (saving) {
      return;
    }

    setError(null);

    if (!user) {
      setError("Нужно войти в аккаунт.");
      return;
    }

    const trimmedTitle = title.trim();
    const normalizedAmount = amount.trim().replace(",", ".");
    const parsedAmount = normalizedAmount ? Number(normalizedAmount) : null;

    if (!trimmedTitle) {
      setError("Введите название платежа.");
      return;
    }

    if (!isValidDateInput(date.trim())) {
      setError("Введите дату в формате ГГГГ-ММ-ДД.");
      return;
    }

    if (parsedAmount !== null && Number.isNaN(parsedAmount)) {
      setError("Введите сумму числом или оставьте поле пустым.");
      return;
    }

    setSaving(true);

    try {
      await createPaymentItem({
        userId: user.id,
        title: trimmedTitle,
        amount: parsedAmount,
        date: date.trim(),
        comment: comment.trim() || null
      });
      router.back();
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : "Не удалось сохранить платёж.";
      setError(message);
      Alert.alert("Ошибка", message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScreenContainer keyboardShouldPersistTaps="handled">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboard}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Новый платёж</Text>
          <Text style={styles.subtitle}>Добавьте обязательство, которое нужно увидеть в календаре.</Text>
        </View>

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

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>

        <View style={styles.actions}>
          <AppButton loading={saving} onPress={handleSave} title="Сохранить" />
          <AppButton onPress={() => router.back()} title="Отмена" variant="secondary" />
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  keyboard: {
    flex: 1,
    gap: theme.spacing.lg
  },
  header: {
    gap: theme.spacing.xs
  },
  title: {
    color: theme.colors.text,
    fontSize: 26,
    fontWeight: "700"
  },
  subtitle: {
    color: theme.colors.textMuted,
    fontSize: 15,
    lineHeight: 22
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
