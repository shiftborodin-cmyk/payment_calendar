import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { Animated, PanResponder, Pressable, StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/features/auth/AuthContext";
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
const swipeDistanceThreshold = 42;
const swipeVelocityThreshold = 0.45;
const swipeStartThreshold = 8;
const swipeDragResistance = 0.65;
const swipeExitDistance = 260;

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const viewRef = useRef(view);
  const desiredDayRef = useRef(desiredDayOfMonth);
  const swipeTranslateX = useRef(new Animated.Value(0)).current;
  const isSwipeAnimatingRef = useRef(false);

  viewRef.current = view;
  desiredDayRef.current = desiredDayOfMonth;

  const visibleRange = useMemo(() => {
    if (view === "week") {
      const weekStart = getWeekStartDateString(selectedDate);
      return {
        end: addDaysToDateString(weekStart, 6),
        start: weekStart
      };
    }

    return {
      end: getMonthEndDateString(selectedDate),
      start: getMonthStartDateString(selectedDate)
    };
  }, [selectedDate, view]);
  const visiblePayments = useMemo(
    () => getPaymentsForRange(items, visibleRange.start, visibleRange.end),
    [items, visibleRange.end, visibleRange.start]
  );
  const paymentDates = useMemo(
    () => new Set(visiblePayments.map((payment) => payment.date)),
    [visiblePayments]
  );
  const selectedPayments = useMemo(
    () => getPaymentsForDate(items, selectedDate),
    [items, selectedDate]
  );
  const selectedTotal = sumPayments(selectedPayments);
  const monthDays = useMemo(() => getMonthDays(selectedDate), [selectedDate]);
  const weekDates = useMemo(() => getWeekDates(selectedDate), [selectedDate]);

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

  const resetSwipePosition = useCallback(() => {
    Animated.spring(swipeTranslateX, {
      damping: 18,
      stiffness: 180,
      toValue: 0,
      useNativeDriver: true
    }).start(() => {
      isSwipeAnimatingRef.current = false;
    });
  }, [swipeTranslateX]);

  const finishSwipe = useCallback(
    (direction: -1 | 1) => {
      if (isSwipeAnimatingRef.current) {
        return;
      }

      isSwipeAnimatingRef.current = true;
      Animated.timing(swipeTranslateX, {
        duration: 140,
        toValue: direction === 1 ? -swipeExitDistance : swipeExitDistance,
        useNativeDriver: true
      }).start(() => {
        navigate(direction);
        swipeTranslateX.setValue(direction === 1 ? 72 : -72);
        resetSwipePosition();
      });
    },
    [navigate, resetSwipePosition, swipeTranslateX]
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gestureState) => {
          const horizontalMove = Math.abs(gestureState.dx);
          const verticalMove = Math.abs(gestureState.dy);

          return horizontalMove > swipeStartThreshold && horizontalMove > verticalMove * 1.2;
        },
        onPanResponderMove: (_event, gestureState) => {
          if (!isSwipeAnimatingRef.current) {
            swipeTranslateX.setValue(gestureState.dx * swipeDragResistance);
          }
        },
        onPanResponderRelease: (_event, gestureState) => {
          const horizontalMove = Math.abs(gestureState.dx);
          const verticalMove = Math.abs(gestureState.dy);
          const hasSwipeDistance = horizontalMove >= swipeDistanceThreshold;
          const hasSwipeVelocity = Math.abs(gestureState.vx) >= swipeVelocityThreshold && horizontalMove >= 12;
          const isHorizontalSwipe = horizontalMove > verticalMove * 1.15;

          if (isHorizontalSwipe && (hasSwipeDistance || hasSwipeVelocity)) {
            finishSwipe(gestureState.dx < 0 ? 1 : -1);
            return;
          }

          resetSwipePosition();
        },
        onPanResponderTerminate: resetSwipePosition
      }),
    [finishSwipe, resetSwipePosition, swipeTranslateX]
  );

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

          if (isActive) {
            setItems(nextItems);
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

  function renderMonthView() {
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
          {monthDays.map((dateString) => {
            const day = getDayOfMonth(dateString);
            const isSelected = dateString === selectedDate;

            return (
              <Pressable
                key={dateString}
                onPress={() => handleSelectDate(dateString)}
                style={[styles.dayCell, isSelected && styles.dayCellActive]}
              >
                <Text style={[styles.dayText, isSelected && styles.dayTextActive]}>{day}</Text>
                {paymentDates.has(dateString) ? <View style={styles.dayDot} /> : null}
              </Pressable>
            );
          })}
        </View>
      </>
    );
  }

  function renderWeekView() {
    return (
      <View style={styles.weekCards}>
        {weekDates.map((dateString, index) => {
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
              {paymentDates.has(dateString) ? <View style={styles.dayDot} /> : null}
            </Pressable>
          );
        })}
      </View>
    );
  }

  return (
    <ScreenContainer>
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

      <Card style={styles.calendarCard} {...panResponder.panHandlers}>
        <Animated.View style={[styles.calendarContent, { transform: [{ translateX: swipeTranslateX }] }]}>
          <View style={styles.calendarTopRow}>
            <View>
              <Text style={styles.monthLabel}>{getMonthLabel(selectedDate)}</Text>
              <Text style={styles.calendarModeLabel}>{getModeLabel()}</Text>
            </View>
            <View style={styles.calendarIconWrap}>
              <Ionicons color={theme.colors.primary} name="calendar-clear-outline" size={22} />
            </View>
          </View>

          {view === "month" ? renderMonthView() : null}
          {view === "week" ? renderWeekView() : null}

          <View style={styles.legend}>
            <View style={styles.legendDot} />
            <Text style={styles.legendText}>
              {error ? "Не удалось загрузить платежи" : "Свайп влево или вправо переключает период"}
            </Text>
          </View>
        </Animated.View>
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

            return (
              <Card key={payment.id} style={[styles.paymentCard, overdue && styles.paymentCardOverdue]}>
                <View style={styles.paymentRow}>
                  <View style={styles.paymentText}>
                    <Text style={styles.paymentTitle}>{payment.title}</Text>
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
    overflow: "hidden"
  },
  calendarContent: {
    gap: theme.spacing.md
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
    height: 44,
    justifyContent: "center",
    width: 44
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
    marginTop: 3
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
    marginBottom: theme.spacing.xs,
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
    gap: theme.spacing.xs
  },
  weekCard: {
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    flex: 1,
    minHeight: 76,
    justifyContent: "center",
    padding: theme.spacing.xs
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
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center"
  },
  weekCardTextActive: {
    color: theme.colors.primary
  },
  legend: {
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    flexDirection: "row",
    gap: theme.spacing.sm,
    padding: theme.spacing.sm
  },
  legendDot: {
    backgroundColor: theme.colors.primary,
    borderRadius: 4,
    height: 8,
    width: 8
  },
  legendText: {
    color: theme.colors.textMuted,
    flex: 1,
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
  }
});
