import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/features/auth/AuthContext";
import { getCategoryCardBackground } from "@/features/categories/categoryColors";
import { getLocalCategories, type LocalCategory } from "@/features/categories/localCategoriesStorage";
import { useAppSettings } from "@/features/settings/AppSettingsContext";
import { getCurrentLocale, translate } from "@/features/settings/i18n";
import { getMonthEndDateString, getMonthStartDateString, getTodayDateString } from "@/features/payments/paymentDates";
import { getMonthlyBalanceForecast } from "@/features/payments/paymentForecast";
import { formatPaymentAmount, formatPaymentDate } from "@/features/payments/paymentFormatters";
import { expandPaymentOccurrences, sortPaymentsByDate } from "@/features/payments/paymentOccurrences";
import { fetchPaymentItems } from "@/features/payments/paymentsApi";
import { AppButton } from "@/shared/ui/AppButton";
import { Card } from "@/shared/ui/Card";
import { ScreenContainer } from "@/shared/ui/ScreenContainer";
import { useTheme, type AppTheme } from "@/shared/theme/theme";
import type { PaymentItem } from "@/types/payment";

function getGreeting() {
  const hour = new Date().getHours();

  if (hour < 12) {
    return translate("Доброе утро", "Good morning");
  }

  if (hour < 18) {
    return translate("Добрый день", "Good afternoon");
  }

  return translate("Добрый вечер", "Good evening");
}

function sumPayments(items: PaymentItem[]) {
  return items.reduce((sum, item) => sum + (item.amount ?? 0), 0);
}

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { settings } = useAppSettings();
  const theme = useTheme();
  const styles = createStyles(theme);
  const [items, setItems] = useState<PaymentItem[]>([]);
  const [categories, setCategories] = useState<LocalCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const focusedRef = useRef(false);
  const loadingRef = useRef(false);
  const displayName = settings.displayName.trim() || user?.email?.split("@")[0] || "друг";

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
      const [nextItems, nextCategories] = await Promise.all([
        fetchPaymentItems(user.id),
        getLocalCategories(user.id).catch(() => [])
      ]);

      if (focusedRef.current) {
        setItems(nextItems);
        setCategories(nextCategories);
      }
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : translate("Не удалось загрузить платежи.", "Could not load payments.");

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

  const today = getTodayDateString();
  const monthStart = getMonthStartDateString(today);
  const monthEnd = getMonthEndDateString(today);
  const visibleItems = useMemo(
    () => items.filter((item) => settings.includeIncome || item.type !== "income"),
    [items, settings.includeIncome]
  );
  const expandedItems = useMemo(() => expandPaymentOccurrences(visibleItems, { startDate: "1970-01-01" }), [visibleItems]);
  const unpaidItems = useMemo(
    () => sortPaymentsByDate(expandedItems.filter((item) => item.status !== "paid" && item.type === "expense")),
    [expandedItems]
  );
  const nextPayment = unpaidItems.find((item) => item.date >= today) ?? unpaidItems[0] ?? null;
  const currentMonthExpenses = expandedItems.filter(
    (item) => item.type === "expense" && item.date >= monthStart && item.date <= monthEnd
  );
  const currentMonthPaidExpenses = currentMonthExpenses.filter((item) => item.status === "paid");
  const currentMonthIncome = expandedItems.filter(
    (item) => item.type === "income" && item.date >= monthStart && item.date <= monthEnd
  );
  const currentMonthExpenseTotal = sumPayments(currentMonthExpenses);
  const currentMonthPaidTotal = sumPayments(currentMonthPaidExpenses);
  const currentMonthIncomeTotal = sumPayments(currentMonthIncome);
  const forecast = useMemo(
    () =>
      settings.includeIncome
        ? Array.from(getMonthlyBalanceForecast(items, today, settings.openingBalance).values())
        : [],
    [items, settings.includeIncome, settings.openingBalance, today]
  );
  const forecastIncome = forecast.reduce((sum, day) => sum + day.income, 0);
  const forecastExpense = forecast.reduce((sum, day) => sum + day.expense, 0);
  const projectedBalance = forecast[forecast.length - 1]?.balance ?? settings.openingBalance;
  const firstNegativeDay = forecast.find((day) => day.isNegative) ?? null;
  const maxForecastValue = Math.max(1, ...forecast.map((day) => Math.abs(day.balance)));
  const nextPaymentCategory = nextPayment?.categoryId
    ? categories.find((category) => category.id === nextPayment.categoryId)
    : null;

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
    <ScreenContainer contentStyle={styles.screenContent}>
      <View style={styles.header}>
        <Text style={styles.greeting}>{getGreeting()}, {displayName}</Text>
        <Text style={styles.subtitle}>{translate("Ваш платёжный календарь на сегодня", "Your payment calendar for today")}</Text>
      </View>

      <Card
        style={[
          styles.nextPaymentCard,
          nextPaymentCategory ? { backgroundColor: getCategoryCardBackground(nextPaymentCategory.color) } : null
        ]}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardIconWrap}>
            <Ionicons
              color={nextPaymentCategory?.color ?? theme.colors.primary}
              name={(nextPaymentCategory?.icon as keyof typeof Ionicons.glyphMap) ?? "wallet-outline"}
              size={22}
            />
          </View>
          <Text style={styles.cardTitle}>{translate("Ближайший платёж", "Next payment")}</Text>
        </View>

        {nextPayment ? (
          <View style={styles.nextPaymentSummary}>
            <View style={styles.nextPaymentMain}>
              <Text numberOfLines={1} style={styles.nextPaymentValue}>{nextPayment.title}</Text>
              <View style={styles.nextPaymentMetaRow}>
                <Text style={styles.nextPaymentLabel}>{formatPaymentDate(nextPayment.date)}</Text>
                {nextPaymentCategory ? (
                  <View style={styles.categoryBadge}>
                    <Ionicons color={nextPaymentCategory.color} name={nextPaymentCategory.icon as keyof typeof Ionicons.glyphMap} size={14} />
                    <Text numberOfLines={1} style={styles.categoryText}>{nextPaymentCategory.name}</Text>
                  </View>
                ) : null}
              </View>
            </View>
            <Text style={styles.nextPaymentAmount}>{formatPaymentAmount(nextPayment)}</Text>
          </View>
        ) : error ? (
          <View style={styles.emptyBlock}>
            <Ionicons color={theme.colors.danger} name="alert-circle-outline" size={32} />
            <Text style={styles.emptyTitle}>{translate("Не удалось загрузить платежи", "Could not load payments")}</Text>
            <Text style={styles.emptyDescription}>{error}</Text>
            <AppButton loading={loading} onPress={loadNextPayment} title={translate("Повторить", "Retry")} variant="secondary" />
          </View>
        ) : (
          <View style={styles.emptyBlock}>
            <Ionicons color={theme.colors.textMuted} name="calendar-outline" size={32} />
            <Text style={styles.emptyTitle}>
              {loading
                ? translate("Загружаю платежи...", "Loading payments...")
                : visibleItems.length > 0
                  ? translate("Все платежи оплачены", "All payments are paid")
                  : translate("Платежей пока нет", "No payments yet")}
            </Text>
            <Text style={styles.emptyDescription}>
              {visibleItems.length > 0
                ? translate("На ближайшее время активных платежей нет.", "There are no active payments coming up.")
                : translate("Добавьте первый платёж, чтобы видеть его здесь и в календаре.", "Add your first payment to see it here and in the calendar.")}
            </Text>
          </View>
        )}
      </Card>

      <View style={styles.addActions}>
        {settings.includeIncome ? <View style={styles.addAction}>
          <AppButton icon="add" onPress={() => router.push({ pathname: "/add-payment", params: { type: "income" } })} title={translate("Доход", "Income")} variant="secondary" />
        </View> : null}
        <View style={styles.addAction}>
          <AppButton icon="remove" onPress={() => router.push({ pathname: "/add-payment", params: { type: "expense" } })} title={translate("Расход", "Expense")} />
        </View>
      </View>

      {settings.includeIncome ? (
        <Card style={styles.forecastCard}>
          <View style={styles.forecastHeader}>
            <View>
              <Text style={styles.cardTitle}>{translate("Прогноз денег", "Money forecast")}</Text>
              <Text style={styles.forecastSubtitle}>{translate("Остаток по дням текущего месяца", "Daily balance for this month")}</Text>
            </View>
            <Ionicons color={theme.colors.primary} name="analytics-outline" size={24} />
          </View>

          <View style={styles.forecastSummary}>
            <View style={styles.forecastSummaryItem}>
              <Text style={styles.forecastSummaryLabel}>{translate("Доходы", "Income")}</Text>
              <Text style={styles.forecastIncomeValue}>{formatCurrency(forecastIncome)}</Text>
            </View>
            <View style={styles.forecastSummaryItem}>
              <Text style={styles.forecastSummaryLabel}>{translate("Расходы", "Expenses")}</Text>
              <Text style={styles.forecastExpenseValue}>{formatCurrency(forecastExpense)}</Text>
            </View>
            <View style={styles.forecastSummaryItem}>
              <Text style={styles.forecastSummaryLabel}>{translate("Остаток", "Balance")}</Text>
              <Text style={[styles.forecastBalanceValue, projectedBalance < 0 && styles.forecastNegativeValue]}>
                {formatCurrency(projectedBalance)}
              </Text>
            </View>
          </View>

          <View style={styles.chart}>
            <View style={styles.zeroLine} />
            <View style={styles.chartColumns}>
              {forecast.map((day) => {
                const barHeight = Math.max(2, Math.round((Math.abs(day.balance) / maxForecastValue) * 34));

                return (
                  <View key={day.date} style={styles.chartColumn}>
                    <View style={styles.chartHalfTop}>
                      {day.balance >= 0 ? <View style={[styles.positiveBar, { height: barHeight }]} /> : null}
                    </View>
                    <View style={styles.chartHalfBottom}>
                      {day.balance < 0 ? <View style={[styles.negativeBar, { height: barHeight }]} /> : null}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>

          <Text style={[styles.forecastNotice, firstNegativeDay && styles.forecastNoticeNegative]}>
            {firstNegativeDay
              ? `${translate("Возможная нехватка с", "Possible shortage from")} ${formatPaymentDate(firstNegativeDay.date)}`
              : translate("По текущему плану денег хватает на весь месяц.", "The current plan stays funded for the whole month.")}
          </Text>
        </Card>
      ) : null}

      <Card style={styles.monthCard}>
        <View style={styles.monthRow}>
          <View style={styles.monthTextBlock}>
            <Text style={styles.monthLabel}>{translate("В этом месяце платежей", "Payments this month")} <Text style={styles.monthCount}>{currentMonthExpenses.length}</Text></Text>
          </View>
          <Text style={styles.monthValue}>{formatCurrency(currentMonthExpenseTotal)}</Text>
        </View>
        <View style={styles.monthDivider} />
        <View style={styles.monthRow}>
          <View style={styles.monthTextBlock}>
            <Text style={styles.monthLabel}>{translate("Оплачено в этом месяце", "Paid this month")} <Text style={styles.monthCount}>{currentMonthPaidExpenses.length}</Text></Text>
          </View>
          <Text style={styles.monthValue}>{formatCurrency(currentMonthPaidTotal)}</Text>
        </View>
        {settings.includeIncome ? <>
          <View style={styles.monthDivider} />
          <View style={styles.monthRow}>
            <View style={styles.monthTextBlock}>
              <Text style={styles.monthLabel}>{translate("Доходы в этом месяце", "Income this month")} <Text style={styles.monthCount}>{currentMonthIncome.length}</Text></Text>
            </View>
            <Text style={styles.incomeMonthValue}>{formatCurrency(currentMonthIncomeTotal)}</Text>
          </View>
        </> : null}
      </Card>
    </ScreenContainer>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
  screenContent: {
    gap: 8,
    paddingBottom: theme.spacing.sm
  },
  header: {
    gap: theme.spacing.xs,
    marginBottom: 2
  },
  greeting: {
    color: theme.colors.text,
    fontSize: 24,
    fontWeight: "700"
  },
  subtitle: {
    color: theme.colors.textMuted,
    fontSize: 14,
    lineHeight: 19
  },
  nextPaymentCard: {
    gap: 6,
    padding: 12
  },
  categoryBadge: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.xs
  },
  categoryDot: {
    borderRadius: 5,
    height: 10,
    width: 10
  },
  categoryText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: "700"
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
    height: 32,
    justifyContent: "center",
    width: 32
  },
  cardTitle: {
    color: theme.colors.text,
    fontSize: 17,
    fontWeight: "600"
  },
  nextPaymentSummary: {
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: theme.spacing.sm,
    justifyContent: "space-between",
    padding: 9
  },
  nextPaymentMain: {
    flex: 1,
    gap: 3
  },
  nextPaymentMetaRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm
  },
  nextPaymentLabel: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: "500"
  },
  nextPaymentValue: {
    color: theme.colors.primary,
    fontSize: 18,
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
    padding: theme.spacing.md
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
  statSubValue: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: "700"
  },
  monthCard: {
    gap: 7,
    padding: 12
  },
  monthRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: theme.spacing.md
  },
  monthLabel: {
    color: theme.colors.textMuted,
    fontSize: 14
  },
  monthTextBlock: {
    flex: 1,
  },
  monthCount: {
    color: theme.colors.primary,
    fontSize: 16,
    fontWeight: "800"
  },
  monthDivider: {
    backgroundColor: theme.colors.border,
    height: 1
  },
  monthValue: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: "800"
  },
  incomeMonthValue: {
    color: "#74D6A0",
    fontSize: 16,
    fontWeight: "800"
  },
  addActions: {
    flexDirection: "row",
    gap: theme.spacing.sm
  },
  addAction: {
    flex: 1
  },
  forecastCard: {
    gap: 10,
    padding: 12
  },
  forecastHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  forecastSubtitle: {
    color: theme.colors.textMuted,
    fontSize: 12,
    marginTop: 2
  },
  forecastSummary: {
    flexDirection: "row",
    gap: theme.spacing.sm
  },
  forecastSummaryItem: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    flex: 1,
    gap: 3,
    padding: 7
  },
  forecastSummaryLabel: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: "600"
  },
  forecastIncomeValue: {
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: "800"
  },
  forecastExpenseValue: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: "800"
  },
  forecastBalanceValue: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: "800"
  },
  forecastNegativeValue: {
    color: "#D98A8A"
  },
  chart: {
    height: 82,
    justifyContent: "center",
    position: "relative"
  },
  zeroLine: {
    backgroundColor: theme.colors.border,
    height: 1,
    left: 0,
    position: "absolute",
    right: 0,
    top: 41
  },
  chartColumns: {
    flexDirection: "row",
    height: 82
  },
  chartColumn: {
    flex: 1
  },
  chartHalfTop: {
    alignItems: "center",
    height: 41,
    justifyContent: "flex-end"
  },
  chartHalfBottom: {
    alignItems: "center",
    height: 41,
    justifyContent: "flex-start"
  },
  positiveBar: {
    backgroundColor: "rgba(54, 209, 125, 0.72)",
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
    width: "62%"
  },
  negativeBar: {
    backgroundColor: "rgba(210, 112, 112, 0.62)",
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
    width: "62%"
  },
  forecastNotice: {
    color: theme.colors.textMuted,
    fontSize: 13,
    lineHeight: 18
  },
  forecastNoticeNegative: {
    color: "#D98A8A",
    fontWeight: "700"
  }
  });
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat(getCurrentLocale(), {
    currency: "RUB",
    maximumFractionDigits: 0,
    style: "currency"
  }).format(value);
}
