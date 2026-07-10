import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/features/auth/AuthContext";
import { PaymentForm, type PaymentFormValues } from "@/features/payments/PaymentForm";
import { createPaymentItem } from "@/features/payments/paymentsApi";
import { translate } from "@/features/settings/i18n";
import { ScreenContainer } from "@/shared/ui/ScreenContainer";
import { useTheme, type AppTheme } from "@/shared/theme/theme";

export default function AddPaymentScreen() {
  const router = useRouter();
  const { type: typeParam } = useLocalSearchParams<{ type?: string }>();
  const operationType = typeParam === "income" ? "income" : "expense";
  const { user } = useAuth();
  const theme = useTheme();
  const styles = createStyles(theme);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSave(values: PaymentFormValues) {
    if (saving) {
      return;
    }

    setError(null);

    if (!user) {
      setError(translate("Нужно войти в аккаунт.", "Please sign in."));
      return;
    }

    setSaving(true);

    try {
      await createPaymentItem({ ...values, userId: user.id });
      router.back();
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : translate("Не удалось сохранить операцию.", "Could not save the operation.");
      setError(message);
      Alert.alert(translate("Ошибка", "Error"), message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScreenContainer keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Text style={styles.title}>{operationType === "income" ? translate("Новый доход", "New income") : translate("Новый расход", "New expense")}</Text>
        <Text style={styles.subtitle}>{operationType === "income" ? translate("Добавьте поступление денег в календарь.", "Add money received to your calendar.") : translate("Добавьте предстоящий платёж в календарь.", "Add an upcoming payment to your calendar.")}</Text>
      </View>

      <PaymentForm
        error={error}
        initialType={operationType}
        lockType
        loading={saving}
        onCancel={() => router.back()}
        onSubmit={handleSave}
        submitTitle={translate("Сохранить", "Save")}
      />
    </ScreenContainer>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
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
  }
  });
}
