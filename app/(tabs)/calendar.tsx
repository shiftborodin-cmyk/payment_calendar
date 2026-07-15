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
import { formatCurrencyValue } from "@/features/payments/paymentFormatters";
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
import { useTheme, type AppTheme } from "@/shared/theme/theme";
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

export default function CalendarScreen() {
  const { user } = useAuth();
  const { settings } = useAppSettings();
  const theme = useTheme();
  const styles = createStyles(theme);
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
  const [carouselHeight, setCarouselHeight] = useState(0);
  const [screenScrollEnabled, setScreenScrollEnabled] = useState(true);
  const viewRef = useRef(view);
  const desiredDayRef = useRef(desiredDayOfMonth);
  const carouselScrollRef = useRef<ScrollView>(null);
  const carouselWidthRef = useRef(0);
  const handlingScrollEndRef = useRef(false);

  viewRef.current = view;
  desiredDayRef.current = desiredDayOfMonth;

  useEffect(() => {
    setCarouselHeight(0);
  }, [selectedDate, view, weekPeriodStart]);

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
    setTimeout(() => {
      scrollCarouselToCenter(false);
      handlingScrollEndRef.current = false;
    }, 280);
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
                dayPayments.length === 0 && styles.weekCardEmpty,
                forecast?.isNegative && styles.weekCardNegative,
                isSelected && styles.weekCardActive
              ]}
            >
              <View style={styles.weekCardHeader}>
                <Text style={[styles.weekCardDateInline, isSelected && styles.weekCardTextActive]}>
                  {getWeekDayLabel(dateString, weekDays)} · {getShortDateLabel(dateString)}
                </Text>
                <Text style={styles.weekCardSummary}>
                  {dayPayments.length === 0
                    ? translate("Нет операций", "No operations")
                    : `${dayPayments.length} · ${formatCurrencyValue(settings.includeIncome ? sumPaymentsNet(dayPayments) : sumPayments(dayPayments))}`}
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
    const isCurrentPeriod = view === "month" ? periodDate === selectedDate : periodDate === weekPeriodStart;
    const columnAnchorPadding = carouselWidth > 0 ? Math.max(0, carouselWidth / 14 - 8) : 0;
    const iconAnchorPadding = Math.max(0, columnAnchorPadding - 10);

    return (
      <View
        key={periodDate}
        onLayout={isCurrentPeriod ? (event) => setCarouselHeight(event.nativeEvent.layout.height) : undefined}
        style={[styles.carouselPage, carouselWidth > 0 && { width: carouselWidth }]}
      >
        <View style={styles.calendarTopRow}>
          <Text numberOfLines={1} style={[styles.monthLabel, { left: columnAnchorPadding }]}>
            {getMonthLabel(periodDate)}
          </Text>
          <View
            style={[
              styles.calendarIconWrap,
              carouselWidth > 0 ? { left: (carouselWidth / 7) * 6 + iconAnchorPadding } : { right: 10 }
            ]}
          >
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
          style={[styles.carouselViewport, carouselHeight > 0 && { height: carouselHeight }]}
          onLayout={(event) => handleCarouselLayout(event.nativeEvent.layout.width)}
          onTouchCancel={() => setScreenScrollEnabled(true)}
          onTouchEnd={() => setScreenScrollEnabled(true)}
          onTouchStart={() => setScreenScrollEnabled(false)}
        >
          <ScrollView
            contentContainerStyle={styles.carouselContent}
            decelerationRate="normal"
            directionalLockEnabled={false}
            disableIntervalMomentum
            horizontal
            nestedScrollEnabled
            onMomentumScrollEnd={handleCarouselScrollEnd}
            onScrollBeginDrag={() => setScreenScrollEnabled(false)}
            onScrollEndDrag={() => setScreenScrollEnabled(true)}
            pagingEnabled
            ref={carouselScrollRef}
            snapToAlignment="start"
            snapToInterval={carouselWidth > 0 ? carouselWidth : undefined}
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
            {settings.includeIncome ? translate("Итог", "Net") : translate("Сумма", "Total")}: {formatCurrencyValue(selectedTotal)}
          </Text>
        </Card>
        {settings.includeIncome && selectedForecast ? (
          <Text style={[styles.forecastText, selectedForecast.isNegative && styles.forecastTextNegative]}>
            {translate("Прогноз остатка", "Forecast balance")}: {formatCurrencyValue(selectedForecast.balance)}
          </Text>
        ) : null}
        {selectedPayments.length === 0 ? (
          <Card style={styles.emptyDayCard}>
            <Text style={styles.emptyDayTitle}>{translate("На этот день платежей нет", "No payments for this date")}</Text>
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
                    {formatCurrencyValue(settings.includeIncome ? sumPaymentsNet(datePayments) : sumPayments(datePayments))}
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

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
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
  carouselContent: {
    alignItems: "flex-start"
  },
  carouselPage: {
    alignSelf: "flex-start",
    gap: 5
  },
  calendarTopRow: {
    height: 34,
    position: "relative"
  },
  calendarIconWrap: {
    alignItems: "center",
    backgroundColor: theme.colors.primarySoft,
    borderRadius: theme.radius.md,
    height: 34,
    justifyContent: "center",
    position: "absolute",
    top: 0,
    width: 34
  },
  monthLabel: {
    color: theme.colors.text,
    fontSize: 17,
    fontWeight: "600",
    position: "absolute",
    top: 5,
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
    minHeight: 70,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 6
  },
  weekCardEmpty: {
    gap: 0,
    height: 38,
    justifyContent: "center",
    minHeight: 0,
    paddingVertical: 0
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
    fontSize: 11,
    fontWeight: "700"
  },
  weekCardDate: {
    color: theme.colors.text,
    fontSize: 10,
    fontWeight: "700",
    textAlign: "center"
  },
  weekCardDateInline: {
    color: theme.colors.text,
    fontSize: 11,
    fontWeight: "700"
  },
  weekCardTextActive: {
    color: theme.colors.primary
  },
  weekCardSummary: {
    color: theme.colors.textMuted,
    fontSize: 11,
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
    minHeight: 28,
    paddingHorizontal: 6
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
}
