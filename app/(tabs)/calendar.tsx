import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent
} from "react-native";

import { useAuth } from "@/features/auth/AuthContext";
import { getLocalCategories, type LocalCategory } from "@/features/categories/localCategoriesStorage";
import { getCategoryCardBackground } from "@/features/categories/categoryColors";
import { useAppSettings } from "@/features/settings/AppSettingsContext";
import { getCurrentLocale, translate } from "@/features/settings/i18n";
import {
  addDaysToDateString,
  formatPaymentDate,
  getDayOfMonth,
  getMonthEndDateString,
  getMonthStartDateString,
  getTodayDateString,
  moveDateByMonthsKeepingDesiredDay,
  parsePaymentDate
} from "@/features/payments/paymentDates";
import { getForecastForDate, getMonthlyBalanceForecast } from "@/features/payments/paymentForecast";
import { formatPaymentAmount } from "@/features/payments/paymentFormatters";
import {
  getPaymentsForDate,
  getPaymentsForRange,
  isPaymentOverdue
} from "@/features/payments/paymentOccurrences";
import { fetchPaymentItems } from "@/features/payments/paymentsApi";
import { Card } from "@/shared/ui/Card";
import { ScreenContainer } from "@/shared/ui/ScreenContainer";
import { SegmentControl } from "@/shared/ui/SegmentControl";
import { theme } from "@/shared/theme/theme";
import type { PaymentItem } from "@/types/payment";

type CalendarView = "month" | "week";

const weekDaysRu = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const weekDaysEn = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getMonthLabel(dateString: string) {
  return new Intl.DateTimeFormat(getCurrentLocale(), {
    month: "long",
    year: "numeric"
  }).format(parsePaymentDate(dateString));
}

function getShortDateLabel(dateString: string) {
  return new Intl.DateTimeFormat(getCurrentLocale(), {
    day: "numeric",
    month: "short"
  }).format(parsePaymentDate(dateString));
}

function getMonthCells(dateString: string) {
  const monthStart = getMonthStartDateString(dateString);
  const lastDay = getDayOfMonth(getMonthEndDateString(dateString));
  const nativeWeekDay = parsePaymentDate(monthStart).getDay();
  const leadingEmptyCells = nativeWeekDay === 0 ? 6 : nativeWeekDay - 1;
  const days = Array.from({ length: lastDay }, (_, index) =>
    moveDateByMonthsKeepingDesiredDay(monthStart, 0, index + 1)
  );

  return [...Array.from({ length: leadingEmptyCells }, () => null), ...days];
}

function getWeekDates(dateString: string) {
  return Array.from({ length: 7 }, (_, index) => addDaysToDateString(dateString, index));
}

function getWeekDayLabel(dateString: string, labels: string[]) {
  const nativeIndex = parsePaymentDate(dateString).getDay();
  const mondayFirstIndex = nativeIndex === 0 ? 6 : nativeIndex - 1;

  return labels[mondayFirstIndex];
}

function sumPayments(payments: PaymentItem[]) {
  return payments.reduce((sum, payment) => sum + (payment.amount ?? 0), 0);
}

function sumPaymentsNet(payments: PaymentItem[]) {
  return payments.reduce((sum, payment) => {
    const amount = payment.amount ?? 0;
    return sum + (payment.type === "income" ? amount : -amount);
  }, 0);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat(getCurrentLocale(), {
    currency: "RUB",
    maximumFractionDigits: 0,
    style: "currency"
  }).format(value);
}

export default function CalendarScreen() {
  const { user } = useAuth();
  const { settings } = useAppSettings();
  const weekDays = settings.language === "en" ? weekDaysEn : weekDaysRu;
  const [view, setView] = useState<CalendarView>("month");
  const [selectedDate, setSelectedDate] = useState(getTodayDateString());
  const [weekPeriodStart, setWeekPeriodStart] = useState(getTodayDateString());
  const [desiredDayOfMonth, setDesiredDayOfMonth] = useState(getDayOfMonth(getTodayDateString()));
  const [items, setItems] = useState<PaymentItem[]>([]);
  const [categories, setCategories] = useState<LocalCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [carouselWidth, setCarouselWidth] = useState(0);
  const [screenScrollEnabled, setScreenScrollEnabled] = useState(true);
  const viewRef = useRef(view);
  const desiredDayRef = useRef(desiredDayOfMonth);
  const carouselScrollRef = useRef<ScrollView>(null);
  const carouselWidthRef = useRef(0);
  const handlingScrollEndRef = useRef(false);

  viewRef.current = view;
  desiredDayRef.current = desiredDayOfMonth;

  const visibleItems = useMemo(
    () => items.filter((item) => settings.includeIncome || item.type !== "income"),
    [items, settings.includeIncome]
  );
  const selectedPayments = useMemo(
    () => getPaymentsForDate(visibleItems, selectedDate),
    [selectedDate, visibleItems]
  );
  const selectedTotal = settings.includeIncome ? sumPaymentsNet(selectedPayments) : sumPayments(selectedPayments);
  const selectedMonthForecast = useMemo(
    () =>
      settings.includeIncome
        ? getMonthlyBalanceForecast(visibleItems, selectedDate, settings.openingBalance)
        : null,
    [selectedDate, settings.includeIncome, settings.openingBalance, visibleItems]
  );
  const selectedForecast = selectedMonthForecast?.get(selectedDate) ?? null;
  const displayedPeriod = useMemo(() => {
    const start = view === "month" ? getMonthStartDateString(selectedDate) : weekPeriodStart;
    const end = view === "month" ? getMonthEndDateString(selectedDate) : addDaysToDateString(weekPeriodStart, 6);
    const payments = getPaymentsForRange(visibleItems, start, end);
    const dates = Array.from(new Set(payments.map((payment) => payment.date)));

    return { dates, end, payments, start };
  }, [selectedDate, view, visibleItems, weekPeriodStart]);
  const categoriesById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories]
  );
  const carouselDates = useMemo(() => {
    if (view === "week") {
      return [
        addDaysToDateString(weekPeriodStart, -7),
        weekPeriodStart,
        addDaysToDateString(weekPeriodStart, 7)
      ];
    }

    return [
      moveDateByMonthsKeepingDesiredDay(selectedDate, -1, desiredDayOfMonth),
      selectedDate,
      moveDateByMonthsKeepingDesiredDay(selectedDate, 1, desiredDayOfMonth)
    ];
  }, [desiredDayOfMonth, selectedDate, view, weekPeriodStart]);

  const navigate = useCallback((direction: -1 | 0 | 1) => {
    if (direction === 0) {
      const today = getTodayDateString();
      setSelectedDate(today);
      setWeekPeriodStart(today);
      setDesiredDayOfMonth(getDayOfMonth(today));
      return;
    }

    if (viewRef.current === "month") {
      setSelectedDate((current) =>
        moveDateByMonthsKeepingDesiredDay(current, direction, desiredDayRef.current)
      );
      return;
    }

    if (viewRef.current === "week") {
      setWeekPeriodStart((current) => addDaysToDateString(current, direction * 7));
      setSelectedDate((current) => addDaysToDateString(current, direction * 7));
    }
  }, []);

  const scrollCarouselToCenter = useCallback((animated = false) => {
    const width = carouselWidthRef.current;

    if (width > 0) {
      carouselScrollRef.current?.scrollTo({ animated, x: width, y: 0 });
    }
  }, []);

  useEffect(() => {
    requestAnimationFrame(() => scrollCarouselToCenter(false));
  }, [carouselWidth, scrollCarouselToCenter, selectedDate, view]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      async function loadPayments() {
        if (!user) {
          setItems([]);
          return;
        }

        setLoading(true);
        setError(null);

        try {
          const nextItems = await fetchPaymentItems(user.id);
          const nextCategories = await getLocalCategories(user.id).catch(() => null);

          if (isActive) {
            setItems(nextItems);
            if (nextCategories) {
              setCategories(nextCategories);
            }
          }
        } catch (loadError) {
          const message = loadError instanceof Error ? loadError.message : translate("Не удалось загрузить платежи.", "Could not load payments.");

          if (isActive) {
            setError(message);
          }
        } finally {
          if (isActive) {
            setLoading(false);
          }
        }
      }

      loadPayments();

      return () => {
        isActive = false;
      };
    }, [user])
  );

  function handleSelectDate(dateString: string) {
    setSelectedDate(dateString);
    setDesiredDayOfMonth(getDayOfMonth(dateString));
    if (viewRef.current === "week") {
      setWeekPeriodStart(dateString);
    }
  }

  function getModeLabel() {
    if (loading) {
      return translate("Загружаю платежи...", "Loading payments...");
    }

    return view === "month" ? translate("Обзор месяца", "Month overview") : translate("7 дней от выбранного дня", "7 days from selected day");
  }

  function getPeriodPaymentDates(periodDate: string) {
    const periodRange =
      view === "week"
        ? {
            end: addDaysToDateString(periodDate, 6),
            start: periodDate
          }
        : {
            end: getMonthEndDateString(periodDate),
            start: getMonthStartDateString(periodDate)
          };
    const periodPayments = getPaymentsForRange(visibleItems, periodRange.start, periodRange.end);

    return new Set(periodPayments.map((payment) => payment.date));
  }

  function handleCarouselLayout(width: number) {
    if (width <= 0 || width === carouselWidthRef.current) {
      return;
    }

    carouselWidthRef.current = width;
    setCarouselWidth(width);
    requestAnimationFrame(() => scrollCarouselToCenter(false));
  }

  function handleCarouselScrollEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const width = carouselWidthRef.current;

    if (width <= 0 || handlingScrollEndRef.current) {
      return;
    }

    const page = Math.round(event.nativeEvent.contentOffset.x / width);
    const direction = page <= 0 ? -1 : page >= 2 ? 1 : 0;

    if (direction === 0) {
      scrollCarouselToCenter(false);
      return;
    }

    handlingScrollEndRef.current = true;
    navigate(direction);
    requestAnimationFrame(() => {
      scrollCarouselToCenter(false);
      handlingScrollEndRef.current = false;
    });
  }

  function renderMonthView(periodDate: string, markedDates: Set<string>) {
    const periodForecast = settings.includeIncome
      ? getMonthlyBalanceForecast(visibleItems, periodDate, settings.openingBalance)
      : null;

    return (
      <>
        <View style={styles.weekRow}>
          {weekDays.map((day) => (
            <Text key={day} style={styles.weekDay}>
              {day}
            </Text>
          ))}
        </View>
        <View style={styles.grid}>
          {getMonthCells(periodDate).map((dateString, index) => {
            if (!dateString) {
              return <View key={`empty-${periodDate}-${index}`} style={styles.dayCellPlaceholder} />;
            }

            const day = getDayOfMonth(dateString);
            const isSelected = dateString === selectedDate;
            const isToday = dateString === getTodayDateString();
            const isNegative = periodForecast?.get(dateString)?.isNegative === true;
            const dayPayments = getPaymentsForDate(visibleItems, dateString);

            return (
              <Pressable
                key={dateString}
                onPress={() => handleSelectDate(dateString)}
                style={[
                  styles.dayCell,
                  isNegative && styles.dayCellNegative,
                  isToday && styles.dayCellToday,
                  isSelected && styles.dayCellActive
                ]}
              >
                <Text style={[styles.dayText, isSelected && styles.dayTextActive]}>{day}</Text>
                {dayPayments.length > 0 ? (
                  <Text numberOfLines={1} style={[styles.dayOperationCount, isSelected && styles.dayTextActive]}>
                    {dayPayments.length}
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </>
    );
  }

  function renderWeekView(periodDate: string, markedDates: Set<string>) {
    return (
      <View style={styles.weekCards}>
        {getWeekDates(periodDate).map((dateString) => {
          const isSelected = dateString === selectedDate;
          const dayPayments = getPaymentsForDate(visibleItems, dateString);
          const forecast = settings.includeIncome
            ? getForecastForDate(visibleItems, dateString, settings.openingBalance)
            : null;

          return (
            <Pressable
              key={dateString}
              onPress={() => handleSelectDate(dateString)}
              style={[
                styles.weekCard,
                forecast?.isNegative && styles.weekCardNegative,
                isSelected && styles.weekCardActive
              ]}
            >
              <View style={styles.weekCardHeader}>
                <View>
                  <Text style={[styles.weekCardDay, isSelected && styles.weekCardTextActive]}>
                    {getWeekDayLabel(dateString, weekDays)}
                  </Text>
                  <Text style={[styles.weekCardDate, isSelected && styles.weekCardTextActive]}>
                    {getShortDateLabel(dateString)}
                  </Text>
                </View>
                <Text style={styles.weekCardSummary}>
                  {dayPayments.length === 0
                    ? translate("Нет операций", "No operations")
                    : `${dayPayments.length} · ${formatCurrency(settings.includeIncome ? sumPaymentsNet(dayPayments) : sumPayments(dayPayments))}`}
                </Text>
              </View>
              {dayPayments.length > 0 ? (
                <View style={styles.weekMiniList}>
                  {dayPayments.map((payment) => {
                    const category = payment.categoryId ? categoriesById.get(payment.categoryId) : null;

                    return (
                      <View
                        key={payment.id}
                        style={[
                          styles.weekMiniPayment,
                          category ? { backgroundColor: getCategoryCardBackground(category.color, 0.16) } : null
                        ]}
                      >
                        {category ? <Ionicons color={category.color} name={category.icon as keyof typeof Ionicons.glyphMap} size={12} /> : null}
                        <Text numberOfLines={1} style={styles.weekMiniTitle}>{payment.title}</Text>
                        <Text style={styles.weekMiniAmount}>{formatPaymentAmount(payment)}</Text>
                      </View>
                    );
                  })}
                </View>
              ) : null}
              {markedDates.has(dateString) && dayPayments.length === 0 ? <View style={styles.dayDot} /> : null}
            </Pressable>
          );
        })}
      </View>
    );
  }

  function renderPeriod(periodDate: string) {
    const markedDates = getPeriodPaymentDates(periodDate);

    return (
      <View key={periodDate} style={[styles.carouselPage, carouselWidth > 0 && { width: carouselWidth }]}>
        <View style={styles.calendarTopRow}>
          <View>
            <Text style={styles.monthLabel}>{getMonthLabel(periodDate)}</Text>
            <Text style={styles.calendarModeLabel}>{getModeLabel()}</Text>
          </View>
          <View style={styles.calendarIconWrap}>
            <Ionicons color={theme.colors.primary} name="calendar-clear-outline" size={22} />
          </View>
        </View>

        {view === "month" ? renderMonthView(periodDate, markedDates) : null}
        {view === "week" ? renderWeekView(periodDate, markedDates) : null}

        {error ? <Text style={styles.calendarErrorText}>{translate("Не удалось загрузить платежи", "Could not load payments")}</Text> : null}
      </View>
    );
  }

  return (
    <ScreenContainer
      contentStyle={styles.screenContent}
      nestedScrollEnabled
      scrollEnabled={screenScrollEnabled}
    >
      <View style={styles.header}>
        <Text style={styles.title}>{translate("Календарь", "Calendar")}</Text>
        <Text style={styles.subtitle}>{translate("Платежи по датам", "Payments by date")}</Text>
      </View>

      <SegmentControl
        onChange={(nextView) => {
          if (nextView === "week") {
            setWeekPeriodStart(selectedDate);
          }
          setView(nextView);
        }}
        options={[
          { id: "month", label: translate("Месяц", "Month") },
          { id: "week", label: translate("Неделя", "Week") }
        ]}
        value={view}
      />

      <View style={styles.monthControls}>
        <Pressable accessibilityLabel={translate("Предыдущий период", "Previous period")} onPress={() => navigate(-1)} style={styles.monthButton}>
          <Ionicons color={theme.colors.primary} name="chevron-back" size={20} />
        </Pressable>
        <Pressable onPress={() => navigate(0)} style={[styles.monthButton, styles.todayButton]}>
          <Text style={styles.monthButtonText}>{translate("Сегодня", "Today")}</Text>
        </Pressable>
        <Pressable accessibilityLabel={translate("Следующий период", "Next period")} onPress={() => navigate(1)} style={styles.monthButton}>
          <Ionicons color={theme.colors.primary} name="chevron-forward" size={20} />
        </Pressable>
      </View>

      <Card style={styles.calendarCard}>
        <View
          style={styles.carouselViewport}
          onLayout={(event) => handleCarouselLayout(event.nativeEvent.layout.width)}
          onTouchCancel={() => setScreenScrollEnabled(true)}
          onTouchEnd={() => setScreenScrollEnabled(true)}
          onTouchStart={() => setScreenScrollEnabled(false)}
        >
          <ScrollView
            decelerationRate="fast"
            directionalLockEnabled={false}
            disableIntervalMomentum
            horizontal
            nestedScrollEnabled
            onMomentumScrollEnd={handleCarouselScrollEnd}
            onScrollBeginDrag={() => setScreenScrollEnabled(false)}
            onScrollEndDrag={() => setScreenScrollEnabled(true)}
            pagingEnabled
            ref={carouselScrollRef}
            scrollEventThrottle={16}
            showsHorizontalScrollIndicator={false}
          >
            {carouselDates.map((periodDate) => renderPeriod(periodDate))}
          </ScrollView>
        </View>
      </Card>

      <View style={styles.selectedDayBlock}>
        <Text style={styles.sectionTitle}>{formatPaymentDate(selectedDate)}</Text>
        <Card style={styles.daySummaryCard}>
          <Text style={styles.daySummaryText}>{translate("Операций", "Operations")}: {selectedPayments.length}</Text>
          <Text style={styles.daySummaryText}>
            {settings.includeIncome ? translate("Итог", "Net") : translate("Сумма", "Total")}: {formatCurrency(selectedTotal)}
          </Text>
        </Card>
        {settings.includeIncome && selectedForecast ? (
          <Text style={[styles.forecastText, selectedForecast.isNegative && styles.forecastTextNegative]}>
            {translate("Прогноз остатка", "Forecast balance")}: {formatCurrency(selectedForecast.balance)}
          </Text>
        ) : null}
        {selectedPayments.length === 0 ? (
          <Card style={styles.emptyDayCard}>
            <Text style={styles.emptyDayTitle}>{translate("На этот день платежей нет", "No payments for this date")}</Text>
            <Text style={styles.emptyDayText}>{translate("Выберите другую дату или добавьте новый платёж.", "Choose another date or add a new payment.")}</Text>
          </Card>
        ) : (
          selectedPayments.map((payment) => {
            const overdue = isPaymentOverdue(payment);
            const category = payment.categoryId ? categoriesById.get(payment.categoryId) : null;

            return (
              <Card
                key={payment.id}
                style={[
                  styles.paymentCard,
                  category ? { backgroundColor: getCategoryCardBackground(category.color) } : null,
                  overdue && styles.paymentCardOverdue
                ]}
              >
                <View style={styles.paymentRow}>
                  <View style={styles.paymentText}>
                    <Text style={styles.paymentTitle}>{payment.title}</Text>
                    {category ? (
                      <View style={styles.categoryBadge}>
                        <Ionicons color={category.color} name={category.icon as keyof typeof Ionicons.glyphMap} size={14} />
                        <Text style={styles.categoryText}>{category.name}</Text>
                      </View>
                    ) : null}
                    {payment.type === "income" ? <Text style={styles.incomeText}>{translate("Доход", "Income")}</Text> : null}
                    {overdue ? <Text style={styles.overdueText}>{translate("Просрочен", "Overdue")}</Text> : null}
                    {payment.isGeneratedOccurrence ? <Text style={styles.repeatText}>{translate("Повторяется", "Repeating")}</Text> : null}
                  </View>
                  <Text style={styles.paymentAmount}>{formatPaymentAmount(payment)}</Text>
                </View>
              </Card>
            );
          })
        )}
      </View>

      <View style={styles.periodPaymentsBlock}>
        <Text style={styles.sectionTitle}>
          {view === "month"
            ? translate("Все операции месяца", "All operations this month")
            : translate("Операции за выбранные 7 дней", "Operations for the selected 7 days")}
        </Text>
        <Text style={styles.periodSubtitle}>
          {formatPaymentDate(displayedPeriod.start)} — {formatPaymentDate(displayedPeriod.end)}
        </Text>
        {displayedPeriod.payments.length === 0 ? (
          <Card style={styles.emptyDayCard}>
            <Text style={styles.emptyDayTitle}>{translate("В этом периоде операций нет", "No operations in this period")}</Text>
          </Card>
        ) : (
          displayedPeriod.dates.map((dateString) => {
            const datePayments = displayedPeriod.payments.filter((payment) => payment.date === dateString);

            return (
              <Card key={dateString} style={styles.periodDateCard}>
                <View style={styles.periodDateHeader}>
                  <Text style={styles.periodDateTitle}>{formatPaymentDate(dateString)}</Text>
                  <Text style={styles.periodDateTotal}>
                    {formatCurrency(settings.includeIncome ? sumPaymentsNet(datePayments) : sumPayments(datePayments))}
                  </Text>
                </View>
                {datePayments.map((payment) => {
                  const category = payment.categoryId ? categoriesById.get(payment.categoryId) : null;

                  return (
                    <View
                      key={payment.id}
                      style={[
                        styles.periodPaymentRow,
                        category ? { backgroundColor: getCategoryCardBackground(category.color) } : null
                      ]}
                    >
                      <View style={styles.periodPaymentName}>
                        {category ? <Ionicons color={category.color} name={category.icon as keyof typeof Ionicons.glyphMap} size={12} /> : null}
                        <Text numberOfLines={1} style={styles.periodPaymentTitle}>{payment.title}</Text>
                      </View>
                      <Text style={styles.periodPaymentAmount}>{formatPaymentAmount(payment)}</Text>
                    </View>
                  );
                })}
              </Card>
            );
          })
        )}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    paddingBottom: 132
  },
  header: {
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.sm
  },
  title: {
    color: theme.colors.text,
    fontSize: 26,
    fontWeight: "700"
  },
  subtitle: {
    color: theme.colors.textMuted,
    fontSize: 15
  },
  monthControls: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.sm
  },
  monthButton: {
    alignItems: "center",
    backgroundColor: theme.colors.primarySoft,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    height: 42,
    justifyContent: "center",
    width: 48
  },
  todayButton: {
    flex: 1,
    width: "auto"
  },
  monthButtonText: {
    color: theme.colors.primary,
    fontSize: 13,
    fontWeight: "700"
  },
  calendarCard: {
    overflow: "hidden",
    padding: 10
  },
  carouselViewport: {
    overflow: "hidden"
  },
  carouselPage: {
    gap: 5
  },
  calendarTopRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: theme.spacing.md
  },
  calendarIconWrap: {
    alignItems: "center",
    backgroundColor: theme.colors.primarySoft,
    borderRadius: theme.radius.md,
    height: 34,
    justifyContent: "center",
    width: 34
  },
  monthLabel: {
    color: theme.colors.text,
    fontSize: 17,
    fontWeight: "600",
    textTransform: "capitalize"
  },
  calendarModeLabel: {
    color: theme.colors.textMuted,
    fontSize: 13,
    marginTop: 2
  },
  weekRow: {
    flexDirection: "row"
  },
  weekDay: {
    color: theme.colors.textMuted,
    flex: 1,
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center"
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap"
  },
  dayCell: {
    alignItems: "center",
    borderRadius: theme.radius.sm,
    height: 38,
    justifyContent: "center",
    width: `${100 / 7}%`
  },
  dayCellPlaceholder: {
    height: 38,
    width: `${100 / 7}%`
  },
  dayCellActive: {
    backgroundColor: theme.colors.primarySoft,
    borderColor: theme.colors.primary,
    borderWidth: 1
  },
  dayCellToday: {
    borderColor: theme.colors.textMuted,
    borderWidth: 1
  },
  dayCellNegative: {
    backgroundColor: "rgba(210, 112, 112, 0.16)"
  },
  dayText: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: "500"
  },
  dayTextActive: {
    color: theme.colors.primary,
    fontWeight: "700"
  },
  dayOperationCount: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontWeight: "800",
    marginTop: 2
  },
  dayDot: {
    backgroundColor: theme.colors.primary,
    borderRadius: 3,
    height: 6,
    marginTop: 4,
    width: 6
  },
  weekCards: {
    gap: 6
  },
  weekCard: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    gap: 7,
    minHeight: 96,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 10
  },
  weekCardActive: {
    backgroundColor: theme.colors.primarySoft,
    borderColor: theme.colors.primary
  },
  weekCardNegative: {
    backgroundColor: "rgba(210, 112, 112, 0.16)",
    borderColor: "rgba(210, 112, 112, 0.38)"
  },
  weekCardHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  weekCardDay: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: "700"
  },
  weekCardDate: {
    color: theme.colors.text,
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center"
  },
  weekCardTextActive: {
    color: theme.colors.primary
  },
  weekCardSummary: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: "600"
  },
  weekMiniList: {
    gap: 5
  },
  weekMiniPayment: {
    alignItems: "center",
    backgroundColor: theme.colors.surfaceElevated,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    flexDirection: "row",
    gap: theme.spacing.xs,
    minHeight: 32,
    paddingHorizontal: theme.spacing.sm
  },
  weekMiniTitle: {
    color: theme.colors.text,
    flex: 1,
    fontSize: 12,
    fontWeight: "600"
  },
  weekMiniAmount: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: "700"
  },
  calendarErrorText: {
    color: theme.colors.textMuted,
    fontSize: 13
  },
  selectedDayBlock: {
    gap: theme.spacing.sm
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: "700"
  },
  daySummaryCard: {
    flexDirection: "row",
    gap: theme.spacing.md,
    justifyContent: "space-between"
  },
  daySummaryText: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: "700"
  },
  forecastText: {
    color: theme.colors.textMuted,
    fontSize: 14,
    fontWeight: "700"
  },
  forecastTextNegative: {
    color: "#D98A8A"
  },
  emptyDayCard: {
    gap: theme.spacing.xs
  },
  emptyDayTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: "700"
  },
  emptyDayText: {
    color: theme.colors.textMuted,
    fontSize: 14,
    lineHeight: 20
  },
  paymentCard: {
    gap: theme.spacing.sm
  },
  paymentCardOverdue: {
    borderColor: theme.colors.danger
  },
  paymentRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.md,
    justifyContent: "space-between"
  },
  paymentText: {
    flex: 1,
    gap: 3
  },
  paymentTitle: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: "700"
  },
  paymentAmount: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: "700"
  },
  overdueText: {
    color: theme.colors.danger,
    fontSize: 12,
    fontWeight: "700"
  },
  repeatText: {
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: "700"
  },
  incomeText: {
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: "700"
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
  periodPaymentsBlock: {
    gap: theme.spacing.sm
  },
  periodSubtitle: {
    color: theme.colors.textMuted,
    fontSize: 13
  },
  periodDateCard: {
    gap: theme.spacing.sm
  },
  periodDateHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.sm,
    justifyContent: "space-between"
  },
  periodDateTitle: {
    color: theme.colors.text,
    flex: 1,
    fontSize: 14,
    fontWeight: "700"
  },
  periodDateTotal: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: "700"
  },
  periodPaymentRow: {
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    flexDirection: "row",
    gap: theme.spacing.sm,
    justifyContent: "space-between",
    minHeight: 38,
    paddingHorizontal: theme.spacing.sm
  },
  periodPaymentName: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: theme.spacing.xs
  },
  periodPaymentTitle: {
    color: theme.colors.text,
    flex: 1,
    fontSize: 13,
    fontWeight: "600"
  },
  periodPaymentAmount: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: "700"
  }
});
