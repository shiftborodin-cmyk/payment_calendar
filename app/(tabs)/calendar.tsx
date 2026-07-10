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
import {
  addDaysToDateString,
  formatPaymentDate,
  getDayOfMonth,
  getMonthEndDateString,
  getMonthStartDateString,
  getTodayDateString,
  getWeekStartDateString,
  moveDateByMonthsKeepingDesiredDay,
  parsePaymentDate
} from "@/features/payments/paymentDates";
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

const weekDays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function getMonthLabel(dateString: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    month: "long",
    year: "numeric"
  }).format(parsePaymentDate(dateString));
}

function getShortDateLabel(dateString: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short"
  }).format(parsePaymentDate(dateString));
}

function getMonthDays(dateString: string) {
  const monthStart = getMonthStartDateString(dateString);
  const lastDay = getDayOfMonth(getMonthEndDateString(dateString));

  return Array.from({ length: lastDay }, (_, index) =>
    moveDateByMonthsKeepingDesiredDay(monthStart, 0, index + 1)
  );
}

function getWeekDates(dateString: string) {
  const weekStart = getWeekStartDateString(dateString);
  return Array.from({ length: 7 }, (_, index) => addDaysToDateString(weekStart, index));
}

function sumPayments(payments: PaymentItem[]) {
  return payments.reduce((sum, payment) => sum + (payment.amount ?? 0), 0);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("ru-RU", {
    currency: "RUB",
    maximumFractionDigits: 0,
    style: "currency"
  }).format(value);
}

export default function CalendarScreen() {
  const { user } = useAuth();
  const [view, setView] = useState<CalendarView>("month");
  const [selectedDate, setSelectedDate] = useState(getTodayDateString());
  const [desiredDayOfMonth, setDesiredDayOfMonth] = useState(getDayOfMonth(getTodayDateString()));
  const [items, setItems] = useState<PaymentItem[]>([]);
  const [categories, setCategories] = useState<LocalCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [carouselWidth, setCarouselWidth] = useState(0);
  const viewRef = useRef(view);
  const desiredDayRef = useRef(desiredDayOfMonth);
  const carouselScrollRef = useRef<ScrollView>(null);
  const carouselWidthRef = useRef(0);
  const handlingScrollEndRef = useRef(false);

  viewRef.current = view;
  desiredDayRef.current = desiredDayOfMonth;

  const selectedPayments = useMemo(
    () => getPaymentsForDate(items, selectedDate),
    [items, selectedDate]
  );
  const selectedTotal = sumPayments(selectedPayments);
  const categoriesById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories]
  );
  const carouselDates = useMemo(() => {
    if (view === "week") {
      return [
        addDaysToDateString(selectedDate, -7),
        selectedDate,
        addDaysToDateString(selectedDate, 7)
      ];
    }

    return [
      moveDateByMonthsKeepingDesiredDay(selectedDate, -1, desiredDayOfMonth),
      selectedDate,
      moveDateByMonthsKeepingDesiredDay(selectedDate, 1, desiredDayOfMonth)
    ];
  }, [desiredDayOfMonth, selectedDate, view]);

  const navigate = useCallback((direction: -1 | 0 | 1) => {
    if (direction === 0) {
      const today = getTodayDateString();
      setSelectedDate(today);
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
          const message = loadError instanceof Error ? loadError.message : "Не удалось загрузить платежи.";

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
  }

  function getModeLabel() {
    if (loading) {
      return "Загружаю платежи...";
    }

    return view === "month" ? "Обзор месяца" : "Неделя с понедельника";
  }

  function getPeriodPaymentDates(periodDate: string) {
    const periodRange =
      view === "week"
        ? {
            end: addDaysToDateString(getWeekStartDateString(periodDate), 6),
            start: getWeekStartDateString(periodDate)
          }
        : {
            end: getMonthEndDateString(periodDate),
            start: getMonthStartDateString(periodDate)
          };
    const periodPayments = getPaymentsForRange(items, periodRange.start, periodRange.end);

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
          {getMonthDays(periodDate).map((dateString) => {
            const day = getDayOfMonth(dateString);
            const isSelected = dateString === selectedDate;

            return (
              <Pressable
                key={dateString}
                onPress={() => handleSelectDate(dateString)}
                style={[styles.dayCell, isSelected && styles.dayCellActive]}
              >
                <Text style={[styles.dayText, isSelected && styles.dayTextActive]}>{day}</Text>
                {markedDates.has(dateString) ? <View style={styles.dayDot} /> : null}
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
        {getWeekDates(periodDate).map((dateString, index) => {
          const isSelected = dateString === selectedDate;

          return (
            <Pressable
              key={dateString}
              onPress={() => handleSelectDate(dateString)}
              style={[styles.weekCard, isSelected && styles.weekCardActive]}
            >
              <Text style={[styles.weekCardDay, isSelected && styles.weekCardTextActive]}>{weekDays[index]}</Text>
              <Text style={[styles.weekCardDate, isSelected && styles.weekCardTextActive]}>
                {getShortDateLabel(dateString)}
              </Text>
              {markedDates.has(dateString) ? <View style={styles.dayDot} /> : null}
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

        {error ? <Text style={styles.calendarErrorText}>Не удалось загрузить платежи</Text> : null}
      </View>
    );
  }

  return (
    <ScreenContainer contentStyle={styles.screenContent}>
      <View style={styles.header}>
        <Text style={styles.title}>Календарь</Text>
        <Text style={styles.subtitle}>Платежи по датам</Text>
      </View>

      <SegmentControl
        onChange={setView}
        options={[
          { id: "month", label: "Месяц" },
          { id: "week", label: "Неделя" }
        ]}
        value={view}
      />

      <View style={styles.monthControls}>
        <Pressable onPress={() => navigate(-1)} style={styles.monthButton}>
          <Text style={styles.monthButtonText}>Предыдущий</Text>
        </Pressable>
        <Pressable onPress={() => navigate(0)} style={styles.monthButton}>
          <Text style={styles.monthButtonText}>Сегодня</Text>
        </Pressable>
        <Pressable onPress={() => navigate(1)} style={styles.monthButton}>
          <Text style={styles.monthButtonText}>Следующий</Text>
        </Pressable>
      </View>

      <Card style={styles.calendarCard}>
        <View
          style={styles.carouselViewport}
          onLayout={(event) => handleCarouselLayout(event.nativeEvent.layout.width)}
        >
          <ScrollView
            directionalLockEnabled={false}
            disableIntervalMomentum
            horizontal
            nestedScrollEnabled
            onMomentumScrollEnd={handleCarouselScrollEnd}
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
          <Text style={styles.daySummaryText}>Платежей: {selectedPayments.length}</Text>
          <Text style={styles.daySummaryText}>Сумма: {formatCurrency(selectedTotal)}</Text>
        </Card>
        {selectedPayments.length === 0 ? (
          <Card style={styles.emptyDayCard}>
            <Text style={styles.emptyDayTitle}>На этот день платежей нет</Text>
            <Text style={styles.emptyDayText}>Выберите другую дату или добавьте новый платёж.</Text>
          </Card>
        ) : (
          selectedPayments.map((payment) => {
            const overdue = isPaymentOverdue(payment);
            const category = payment.categoryId ? categoriesById.get(payment.categoryId) : null;

            return (
              <Card key={payment.id} style={[styles.paymentCard, overdue && styles.paymentCardOverdue]}>
                <View style={styles.paymentRow}>
                  <View style={styles.paymentText}>
                    <Text style={styles.paymentTitle}>{payment.title}</Text>
                    {category ? (
                      <View style={styles.categoryBadge}>
                        <View style={[styles.categoryDot, { backgroundColor: category.color }]} />
                        <Text style={styles.categoryText}>{category.name}</Text>
                      </View>
                    ) : null}
                    {overdue ? <Text style={styles.overdueText}>Просрочен</Text> : null}
                    {payment.isGeneratedOccurrence ? <Text style={styles.repeatText}>Повторяется</Text> : null}
                  </View>
                  <Text style={styles.paymentAmount}>{formatPaymentAmount(payment)}</Text>
                </View>
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
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm
  },
  monthButton: {
    backgroundColor: theme.colors.primarySoft,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm
  },
  monthButtonText: {
    color: theme.colors.primary,
    fontSize: 13,
    fontWeight: "700"
  },
  calendarCard: {
    overflow: "hidden",
    padding: theme.spacing.sm
  },
  carouselViewport: {
    overflow: "hidden"
  },
  carouselPage: {
    gap: theme.spacing.sm
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
    height: 40,
    justifyContent: "center",
    width: 40
  },
  monthLabel: {
    color: theme.colors.text,
    fontSize: 18,
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
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center"
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap"
  },
  dayCell: {
    alignItems: "center",
    aspectRatio: 1,
    borderRadius: theme.radius.sm,
    justifyContent: "center",
    marginBottom: 2,
    width: `${100 / 7}%`
  },
  dayCellActive: {
    backgroundColor: theme.colors.primarySoft,
    borderColor: theme.colors.primary,
    borderWidth: 1
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
  dayDot: {
    backgroundColor: theme.colors.primary,
    borderRadius: 3,
    height: 6,
    marginTop: 4,
    width: 6
  },
  weekCards: {
    flexDirection: "row",
    gap: 4
  },
  weekCard: {
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    flex: 1,
    minHeight: 64,
    justifyContent: "center",
    paddingHorizontal: 2,
    paddingVertical: theme.spacing.xs
  },
  weekCardActive: {
    backgroundColor: theme.colors.primarySoft,
    borderColor: theme.colors.primary
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
  }
});
