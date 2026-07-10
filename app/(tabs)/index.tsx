import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
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

function getDateValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getDateAfterDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return getDateValue(date);
}

function sortByDate(items: PaymentItem[]) {
  return [...items].sort((left, right) => left.date.localeCompare(right.date) || left.createdAt.localeCompare(right.createdAt));
}

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [items, setItems] = useState<PaymentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const focusedRef = useRef(false);
  const loadingRef = useRef(false);
  const displayName = user?.email?.split("@")[0] ?? "друг";

  const loadNextPayment = useCallback(async () => {
    if (!user) {
      setItems([]);
      return;
    }

    if (loadingRef.current) {
      return;
    }

    loadingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const nextItems = await fetchPaymentItems(user.id);

      if (focusedRef.current) {
        setItems(nextItems);
      }
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Не удалось загрузить платежи.";

      if (focusedRef.current) {
        setError(message);
      }
    } finally {
      loadingRef.current = false;

      if (focusedRef.current) {
        setLoading(false);
      }
    }
  }, [user]);

  const today = getDateValue(new Date());
  const weekEnd = getDateAfterDays(7);
  const unpaidItems = useMemo(() => sortByDate(items.filter((item) => item.status !== "paid")), [items]);
  const nextPayment = unpaidItems.find((item) => item.date >= today) ?? unpaidItems[0] ?? null;
  const overdueCount = unpaidItems.filter((item) => item.date < today).length;
  const upcomingWeekItems = unpaidItems.filter((item) => item.date >= today && item.date <= weekEnd).slice(0, 4);

  useFocusEffect(
    useCallback(() => {
      focusedRef.current = true;
      loadNextPayment();

      return () => {
        focusedRef.current = false;
      };
    }, [loadNextPayment, user])
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
        ) : error ? (
          <View style={styles.emptyBlock}>
            <Ionicons color={theme.colors.danger} name="alert-circle-outline" size={32} />
            <Text style={styles.emptyTitle}>Не удалось загрузить платежи</Text>
            <Text style={styles.emptyDescription}>{error}</Text>
            <AppButton loading={loading} onPress={loadNextPayment} title="Повторить" variant="secondary" />
          </View>
        ) : (
          <View style={styles.emptyBlock}>
            <Ionicons color={theme.colors.textMuted} name="calendar-outline" size={32} />
            <Text style={styles.emptyTitle}>
              {loading ? "Загружаю платежи..." : items.length > 0 ? "Все платежи оплачены" : "Платежей пока нет"}
            </Text>
            <Text style={styles.emptyDescription}>
              {items.length > 0
                ? "На ближайшее время активных платежей нет."
                : "Добавьте первый платёж, чтобы видеть его здесь и в календаре."}
            </Text>
          </View>
        )}
      </Card>

      {items.length > 0 ? (
        <Card style={styles.statsCard}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{overdueCount}</Text>
            <Text style={styles.statLabel}>Просрочено</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{upcomingWeekItems.length}</Text>
            <Text style={styles.statLabel}>На 7 дней</Text>
          </View>
        </Card>
      ) : null}

      {upcomingWeekItems.length > 0 ? (
        <View style={styles.upcomingBlock}>
          <Text style={styles.sectionTitle}>Ближайшие на 7 дней</Text>
          {upcomingWeekItems.map((payment) => (
            <Card key={payment.id} style={styles.miniCard}>
              <View style={styles.miniText}>
                <Text style={styles.miniTitle}>{payment.title}</Text>
                <Text style={styles.miniDate}>{formatPaymentDate(payment.date)}</Text>
              </View>
              <Text style={styles.miniAmount}>{formatPaymentAmount(payment)}</Text>
            </Card>
          ))}
        </View>
      ) : null}

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
  },
  statsCard: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.md,
    justifyContent: "space-around"
  },
  statItem: {
    alignItems: "center",
    flex: 1,
    gap: 4
  },
  statDivider: {
    backgroundColor: theme.colors.border,
    height: 42,
    width: 1
  },
  statValue: {
    color: theme.colors.primary,
    fontSize: 24,
    fontWeight: "800"
  },
  statLabel: {
    color: theme.colors.textMuted,
    fontSize: 13
  },
  upcomingBlock: {
    gap: theme.spacing.sm
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: "700"
  },
  miniCard: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  miniText: {
    flex: 1,
    gap: 3
  },
  miniTitle: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: "700"
  },
  miniDate: {
    color: theme.colors.textMuted,
    fontSize: 13
  },
  miniAmount: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: "700"
  }
});
