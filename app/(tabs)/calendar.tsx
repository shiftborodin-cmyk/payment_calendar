import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Card } from "@/shared/ui/Card";
import { ScreenContainer } from "@/shared/ui/ScreenContainer";
import { SegmentControl } from "@/shared/ui/SegmentControl";
import { theme } from "@/shared/theme/theme";

type CalendarView = "month" | "week" | "day";

const weekDays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

export default function CalendarScreen() {
  const [view, setView] = useState<CalendarView>("month");

  const monthLabel = useMemo(() => {
    const formatter = new Intl.DateTimeFormat("ru-RU", {
      month: "long",
      year: "numeric"
    });

    return formatter.format(new Date());
  }, []);

  const calendarCells = useMemo(() => Array.from({ length: 35 }, (_, index) => index + 1), []);

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
              {view === "month" ? "Обзор месяца" : view === "week" ? "Обзор недели" : "Расписание дня"}
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
            <View
              key={day}
              style={[styles.dayCell, day <= 7 && styles.dayCellMuted, day === 15 && styles.dayCellActive]}
            >
              <Text
                style={[
                  styles.dayText,
                  day <= 7 && styles.dayTextMuted,
                  day === 15 && styles.dayTextActive
                ]}
              >
                {day <= 31 ? day : ""}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.legend}>
          <View style={styles.legendDot} />
          <Text style={styles.legendText}>Здесь будут отмечены дни с платежами</Text>
        </View>
      </Card>
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
  }
});
