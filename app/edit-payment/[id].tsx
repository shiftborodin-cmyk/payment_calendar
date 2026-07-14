import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/features/auth/AuthContext";
import { PaymentForm, type PaymentFormValues } from "@/features/payments/PaymentForm";
import { getPaymentsForDate } from "@/features/payments/paymentOccurrences";
import { fetchPaymentItemById, updatePaymentItem, updatePaymentOccurrence } from "@/features/payments/paymentsApi";
import { translate } from "@/features/settings/i18n";
import { AppButton } from "@/shared/ui/AppButton";
import { ScreenContainer } from "@/shared/ui/ScreenContainer";
import { useTheme, type AppTheme } from "@/shared/theme/theme";
import type { PaymentItem } from "@/types/payment";

export default function EditPaymentScreen() {
  const router = useRouter();
  const { id, occurrenceDate } = useLocalSearchParams<{ id: string; occurrenceDate?: string }>();
  const { user } = useAuth();
  const theme = useTheme();
  const styles = createStyles(theme);
  const [payment, setPayment] = useState<PaymentItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadPayment() {
      if (!user || !id) {
        setError("Платёж не найден.");
        setLoading(false);
        return;
      }

      try {
        const nextPayment = await fetchPaymentItemById(user.id, id);

        if (!isActive) {
          return;
        }

        if (!nextPayment) {
          setError("Платёж не найден.");
          return;
        }

        const occurrence = occurrenceDate ? getPaymentsForDate([nextPayment], occurrenceDate)[0] : null;
        setPayment(occurrenceDate && occurrence ? { ...occurrence, repeatRule: "none" } : nextPayment);
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : "Не удалось загрузить платёж.";

        if (isActive) {
          setError(message);
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    }

    loadPayment();

    return () => {
      isActive = false;
    };
  }, [id, occurrenceDate, user]);

  function hasRepeatExceptions() {
    return Boolean(
      payment?.repeatRule !== "none" &&
        ((payment?.paidOccurrenceDates?.length ?? 0) > 0 ||
          (payment?.deletedOccurrenceDates?.length ?? 0) > 0 ||
          Object.keys(payment?.occurrenceOverrides ?? {}).length > 0)
    );
  }

  async function savePayment(values: PaymentFormValues) {
    if (saving || !user || !id) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      if (occurrenceDate) {
        await updatePaymentOccurrence(user.id, id, occurrenceDate, { ...values, date: occurrenceDate });
      } else {
        await updatePaymentItem(id, { ...values, userId: user.id });
      }
      router.back();
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : "Не удалось сохранить изменения.";
      setError(message);
      Alert.alert("Ошибка", message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSave(values: PaymentFormValues) {
    const scheduleChanged = !occurrenceDate && payment && (payment.date !== values.date || payment.repeatRule !== values.repeatRule);

    if (scheduleChanged && hasRepeatExceptions()) {
      Alert.alert(
        translate("Изменить график серии?", "Change the series schedule?"),
        translate(
          "Оплаты, удаления и отдельные правки прошлых повторений относятся к старому графику. При сохранении они будут сброшены.",
          "Payments, deletions, and individual edits belong to the old schedule. They will be reset when saved."
        ),
        [
          { style: "cancel", text: translate("Отмена", "Cancel") },
          {
            style: "destructive",
            text: translate("Сбросить и сохранить", "Reset and save"),
            onPress: () => {
              void savePayment(values);
            }
          }
        ]
      );
      return;
    }

    await savePayment(values);
  }

  return (
    <ScreenContainer keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Text style={styles.title}>{translate("Редактировать операцию", "Edit operation")}</Text>
        <Text style={styles.subtitle}>
          {occurrenceDate
            ? translate("Изменения применятся только к этому повторению.", "Changes apply only to this occurrence.")
            : translate("Измените данные и сохраните операцию локально.", "Update the details and save the operation locally.")}
        </Text>
      </View>

      {loading ? <Text style={styles.stateText}>Загружаю платёж...</Text> : null}

      {!loading && payment ? (
        <>
          <PaymentForm
            error={error}
            initialPayment={payment}
            loading={saving}
            onCancel={() => router.back()}
            onSubmit={handleSave}
            hideRepeatRule={Boolean(occurrenceDate)}
            lockDate={Boolean(occurrenceDate)}
            submitTitle={translate("Сохранить изменения", "Save changes")}
          />
          {occurrenceDate ? (
            <AppButton
              onPress={() => router.replace({ pathname: "/edit-payment/[id]", params: { id } })}
              title={translate("Изменить всю серию", "Edit entire series")}
              variant="secondary"
            />
          ) : null}
        </>
      ) : null}

      {!loading && !payment ? (
        <View style={styles.emptyBlock}>
          <Text style={styles.error}>{error ?? "Платёж не найден."}</Text>
          <AppButton onPress={() => router.back()} title="Назад" variant="secondary" />
        </View>
      ) : null}
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
  },
  stateText: {
    color: theme.colors.textMuted,
    fontSize: 15
  },
  emptyBlock: {
    gap: theme.spacing.md
  },
  error: {
    color: theme.colors.danger,
    fontSize: 14,
    lineHeight: 20
  }
  });
}
