import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/features/auth/AuthContext";
import { PaymentForm, type PaymentFormValues } from "@/features/payments/PaymentForm";
import { createPaymentItem } from "@/features/payments/paymentsApi";
import { ScreenContainer } from "@/shared/ui/ScreenContainer";
import { theme } from "@/shared/theme/theme";

export default function AddPaymentScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSave(values: PaymentFormValues) {
    if (saving) {
      return;
    }

    setError(null);

    if (!user) {
      setError("Нужно войти в аккаунт.");
      return;
    }

    setSaving(true);

    try {
      await createPaymentItem({ ...values, userId: user.id });
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
      <View style={styles.header}>
        <Text style={styles.title}>Новый платёж</Text>
        <Text style={styles.subtitle}>Добавьте обязательство, которое нужно увидеть в календаре.</Text>
      </View>

      <PaymentForm
        error={error}
        loading={saving}
        onCancel={() => router.back()}
        onSubmit={handleSave}
        submitTitle="Сохранить"
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
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
