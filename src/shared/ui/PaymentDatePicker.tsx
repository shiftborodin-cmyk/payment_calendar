import { Ionicons } from "@expo/vector-icons";
import { Modal, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";

import { getCurrentLanguage, getCurrentLocale, translate } from "@/features/settings/i18n";
import {
  formatPaymentDate,
  getDayOfMonth,
  getMonthEndDateString,
  getMonthStartDateString,
  getTodayDateString,
  moveDateByMonthsKeepingDesiredDay,
  parsePaymentDate
} from "@/features/payments/paymentDates";
import { theme } from "@/shared/theme/theme";

type PaymentDatePickerProps = {
  monthDate: string;
  onChangeMonth: (date: string) => void;
  onClose: () => void;
  onSelect: (date: string) => void;
  selectedDate: string;
  visible: boolean;
};

const weekDaysRu = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const weekDaysEn = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

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

function getMonthLabel(dateString: string) {
  return new Intl.DateTimeFormat(getCurrentLocale(), { month: "long", year: "numeric" }).format(
    parsePaymentDate(dateString)
  );
}

export function PaymentDatePicker({
  monthDate,
  onChangeMonth,
  onClose,
  onSelect,
  selectedDate,
  visible
}: PaymentDatePickerProps) {
  const weekDays = getCurrentLanguage() === "en" ? weekDaysEn : weekDaysRu;

  function moveMonth(delta: number) {
    onChangeMonth(moveDateByMonthsKeepingDesiredDay(monthDate, delta, 1));
  }

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <SafeAreaView style={styles.backdrop}>
        <Pressable onPress={onClose} style={StyleSheet.absoluteFill} />
        <View style={styles.dialog}>
          <View style={styles.header}>
            <Pressable accessibilityLabel={translate("Предыдущий месяц", "Previous month")} onPress={() => moveMonth(-1)} style={styles.iconButton}>
              <Ionicons color={theme.colors.text} name="chevron-back" size={22} />
            </Pressable>
            <Text style={styles.monthLabel}>{getMonthLabel(monthDate)}</Text>
            <Pressable accessibilityLabel={translate("Следующий месяц", "Next month")} onPress={() => moveMonth(1)} style={styles.iconButton}>
              <Ionicons color={theme.colors.text} name="chevron-forward" size={22} />
            </Pressable>
          </View>

          <View style={styles.weekRow}>
            {weekDays.map((day) => <Text key={day} style={styles.weekDay}>{day}</Text>)}
          </View>
          <View style={styles.grid}>
            {getMonthCells(monthDate).map((dateString, index) =>
              dateString ? (
                <Pressable
                  key={dateString}
                  onPress={() => onSelect(dateString)}
                  style={[styles.day, dateString === selectedDate && styles.daySelected]}
                >
                  <Text style={[styles.dayText, dateString === selectedDate && styles.dayTextSelected]}>
                    {getDayOfMonth(dateString)}
                  </Text>
                </Pressable>
              ) : <View key={`empty-${index}`} style={styles.day} />
            )}
          </View>

          <View style={styles.footer}>
            <Pressable
              onPress={() => onSelect(getTodayDateString())}
              style={styles.todayButton}
            >
              <Text style={styles.todayText}>{translate("Сегодня", "Today")}</Text>
            </Pressable>
            <Text style={styles.selectedLabel}>{formatPaymentDate(selectedDate)}</Text>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.68)",
    flex: 1,
    justifyContent: "center",
    padding: theme.spacing.md
  },
  dialog: {
    backgroundColor: theme.colors.surfaceElevated,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    gap: theme.spacing.md,
    maxWidth: 420,
    padding: theme.spacing.md,
    width: "100%"
  },
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  iconButton: {
    alignItems: "center",
    backgroundColor: theme.colors.primarySoft,
    borderRadius: theme.radius.md,
    height: 42,
    justifyContent: "center",
    width: 42
  },
  monthLabel: { color: theme.colors.text, fontSize: 18, fontWeight: "800", textTransform: "capitalize" },
  weekRow: { flexDirection: "row" },
  weekDay: { color: theme.colors.textMuted, flex: 1, fontSize: 12, fontWeight: "700", textAlign: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  day: { alignItems: "center", height: 44, justifyContent: "center", width: `${100 / 7}%` },
  daySelected: { backgroundColor: theme.colors.primary, borderRadius: theme.radius.md },
  dayText: { color: theme.colors.text, fontSize: 15, fontWeight: "600" },
  dayTextSelected: { color: theme.colors.background, fontWeight: "800" },
  footer: { alignItems: "center", flexDirection: "row", gap: theme.spacing.md, justifyContent: "space-between" },
  todayButton: { backgroundColor: theme.colors.primarySoft, borderRadius: theme.radius.md, paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm },
  todayText: { color: theme.colors.text, fontSize: 14, fontWeight: "700" },
  selectedLabel: { color: theme.colors.textMuted, flex: 1, fontSize: 13, textAlign: "right" }
});
