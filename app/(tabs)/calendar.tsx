import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/features/auth/AuthContext";
import { formatPaymentAmount, formatPaymentDate } from "@/features/payments/paymentFormatters";
import { fetchPaymentItems } from "@/features/payments/paymentsApi";
import { Card } from "@/shared/ui/Card";
import { ScreenContainer } from "@/shared/ui/ScreenContainer";
import { SegmentControl } from "@/shared/ui/SegmentControl";
import { theme } from "@/shared/theme/theme";
import type { PaymentItem } from "@/types/payment";

type CalendarView = "month" | "week" | "day";

const weekDays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function getDateValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function isPaymentOverdue(item: PaymentItem) {
  return item.status !== "paid" && item.date < getDateValue(new Date());
}

export default function CalendarScreen() {
  const { user } = useAuth();
  const [view, setView] = useState<CalendarView>("month");
  const [selectedDay, setSelectedDay] = useState(new Date().getDate());
  const [items, setItems] = useState<PaymentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const monthLabel = useMemo(() => {
    const formatter = new Intl.DateTimeFormat("ru-RU", {
      month: "long",
      year: "numeric"
    });

    return formatter.format(new Date());
  }, []);

  const calendarCells = useMemo(() => Array.from({ length: 35 }, (_, index) => index + 1), []);
  const currentDate = useMemo(() => new Date(), []);
  const paymentDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    return new Set(
      items
        .map((item) => new Date(`${item.date}T00:00:00`))
        .filter((date) => date.getFullYear() === year && date.getMonth() === month)
        .map((date) => date.getDate())
    );
  }, [items, currentDate]);
  const selectedDateValue = useMemo(
    () => getDateValue(new Date(currentDate.getFullYear(), currentDate.getMonth(), selectedDay)),
    [currentDate, selectedDay]
  );
  const selectedPayments = useMemo(
    () =>
      items
        .filter((item) => item.date === selectedDateValue)
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt)),
    [items, selectedDateValue]
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
          { id: "week", label: "Неделя" },
          { id: "day", label: "День" }
        ]}
        value={view}
      />

      <Card style={styles.calendarCard}>
        <View style={styles.calendarTopRow}>
          <View>
            <Text style={styles.monthLabel}>{monthLabel}</Text>
            <Text style={styles.calendarModeLabel}>
              {loading
                ? "Загружаю платежи..."
                : view === "month"
                  ? "Обзор месяца"
                  : view === "week"
                    ? "Обзор недели"
                    : "Расписание дня"}
            </Text>
          </View>
          <View style={styles.calendarIconWrap}>
            <Ionicons color={theme.colors.primary} name="calendar-clear-outline" size={22} />
          </View>
        </View>

        <View style={styles.weekRow}>
          {weekDays.map((day) => (
            <Text key={day} style={styles.weekDay}>
              {day}
            </Text>
          ))}
        </View>

        <View style={styles.grid}>
          {calendarCells.map((day) => (
            <Pressable
              key={day}
              onPress={() => setSelectedDay(day)}
              style={[
                styles.dayCell,
                day <= 7 && styles.dayCellMuted,
                day === selectedDay && styles.dayCellActive
              ]}
            >
              <Text
                style={[
                  styles.dayText,
                  day <= 7 && styles.dayTextMuted,
                  day === selectedDay && styles.dayTextActive
                ]}
              >
                {day <= 31 ? day : ""}
              </Text>
              {paymentDays.has(day) ? <View style={styles.dayDot} /> : null}
            </Pressable>
          ))}
        </View>

        <View style={styles.legend}>
          <View style={styles.legendDot} />
          <Text style={styles.legendText}>
            {error ? "Не удалось загрузить платежи" : "Дни с локальными платежами отмечены точкой"}
          </Text>
        </View>
      </Card>

      <View style={styles.selectedDayBlock}>
        <Text style={styles.sectionTitle}>{formatPaymentDate(selectedDateValue)}</Text>
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
  calendarCard: {
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
  dayCellMuted: {
    opacity: 0.35
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
  dayTextMuted: {
    color: theme.colors.textMuted
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
  }
});
