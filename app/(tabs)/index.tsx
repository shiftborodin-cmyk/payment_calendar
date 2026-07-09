import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/features/auth/AuthContext";
import { formatPaymentAmount, formatPaymentDate } from "@/features/payments/paymentFormatters";
import { fetchPaymentItems } from "@/features/payments/paymentsApi";
import { AppButton } from "@/shared/ui/AppButton";
import { Card } from "@/shared/ui/Card";
import { ScreenContainer } from "@/shared/ui/ScreenContainer";
import { theme } from "@/shared/theme/theme";
import type { PaymentItem } from "@/types/payment";

function getGreeting() {
  const hour = new Date().getHours();

  if (hour < 12) {
    return "Доброе утро";
  }

  if (hour < 18) {
    return "Добрый день";
  }

  return "Добрый вечер";
}

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [nextPayment, setNextPayment] = useState<PaymentItem | null>(null);
  const [loading, setLoading] = useState(false);
  const displayName = user?.email?.split("@")[0] ?? "друг";

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      async function loadNextPayment() {
        if (!user) {
          setNextPayment(null);
          return;
        }

        setLoading(true);

        try {
          const items = await fetchPaymentItems(user.id);
          const unpaidItems = items.filter((item) => item.status !== "paid");

          if (isActive) {
            setNextPayment(unpaidItems[0] ?? null);
          }
        } finally {
          if (isActive) {
            setLoading(false);
          }
        }
      }

      loadNextPayment();

      return () => {
        isActive = false;
      };
    }, [user])
  );

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Text style={styles.greeting}>{getGreeting()}, {displayName}</Text>
        <Text style={styles.subtitle}>Ваш платёжный календарь на сегодня</Text>
      </View>

      <Card style={styles.nextPaymentCard}>
        <View style={styles.cardHeader}>
          <View style={styles.cardIconWrap}>
            <Ionicons color={theme.colors.primary} name="wallet-outline" size={22} />
          </View>
          <Text style={styles.cardTitle}>Ближайший платёж</Text>
        </View>

        {nextPayment ? (
          <View style={styles.nextPaymentSummary}>
            <Text style={styles.nextPaymentLabel}>{formatPaymentDate(nextPayment.date)}</Text>
            <Text style={styles.nextPaymentValue}>{nextPayment.title}</Text>
            <Text style={styles.nextPaymentAmount}>{formatPaymentAmount(nextPayment)}</Text>
          </View>
        ) : (
          <View style={styles.emptyBlock}>
            <Ionicons color={theme.colors.textMuted} name="calendar-outline" size={32} />
            <Text style={styles.emptyTitle}>{loading ? "Загружаю платежи..." : "Платежей пока нет"}</Text>
            <Text style={styles.emptyDescription}>
              Добавьте первый платёж, чтобы видеть его здесь и в календаре.
            </Text>
          </View>
        )}
      </Card>

      <AppButton onPress={() => router.push("/add-payment")} title="Добавить платёж" />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.sm
  },
  greeting: {
    color: theme.colors.text,
    fontSize: 26,
    fontWeight: "700"
  },
  subtitle: {
    color: theme.colors.textMuted,
    fontSize: 15,
    lineHeight: 22
  },
  nextPaymentCard: {
    gap: theme.spacing.md
  },
  cardHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.sm
  },
  cardIconWrap: {
    alignItems: "center",
    backgroundColor: theme.colors.primarySoft,
    borderRadius: theme.radius.sm,
    height: 36,
    justifyContent: "center",
    width: 36
  },
  cardTitle: {
    color: theme.colors.text,
    fontSize: 17,
    fontWeight: "600"
  },
  nextPaymentSummary: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    gap: theme.spacing.xs,
    padding: theme.spacing.md
  },
  nextPaymentLabel: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: "500"
  },
  nextPaymentValue: {
    color: theme.colors.primary,
    fontSize: 20,
    fontWeight: "700"
  },
  nextPaymentAmount: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: "600"
  },
  emptyBlock: {
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    borderStyle: "dashed",
    borderWidth: 1,
    gap: theme.spacing.sm,
    padding: theme.spacing.lg
  },
  emptyTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: "600"
  },
  emptyDescription: {
    color: theme.colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center"
  }
});
