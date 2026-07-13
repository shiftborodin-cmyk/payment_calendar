import { useMemo, useRef, useState } from "react";
import { PanResponder, Pressable, StyleSheet, Text, View } from "react-native";

import { getCurrentLocale } from "@/features/settings/i18n";
import { formatPaymentDate } from "@/features/payments/paymentFormatters";
import { useTheme } from "@/shared/theme/theme";
import type { DailyBalanceForecast } from "@/features/payments/paymentForecast";

const CHART_HEIGHT = 164;
const PLOT_TOP = 12;
const PLOT_BOTTOM = 28;

function formatCurrency(value: number) {
  return new Intl.NumberFormat(getCurrentLocale(), {
    currency: "RUB",
    maximumFractionDigits: 0,
    style: "currency"
  }).format(value);
}

export function InteractiveForecastChart({ forecast }: { forecast: DailyBalanceForecast[] }) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(forecast.length ? forecast.length - 1 : 0);
  const dragStartX = useRef(0);

  const points = useMemo(() => {
    if (forecast.length < 1) return [];
    const values = forecast.map((day) => day.balance);
    const min = Math.min(0, ...values);
    const max = Math.max(0, ...values);
    const range = Math.max(1, max - min);
    const plotWidth = Math.max(1, width - 12);
    const plotHeight = CHART_HEIGHT - PLOT_TOP - PLOT_BOTTOM;

    return forecast.map((day, index) => ({
      x: forecast.length === 1 ? plotWidth / 2 : 6 + (index / (forecast.length - 1)) * plotWidth,
      y: PLOT_TOP + ((max - day.balance) / range) * plotHeight
    }));
  }, [forecast, width]);

  const zeroY = useMemo(() => {
    if (forecast.length < 1) return PLOT_TOP;
    const values = forecast.map((day) => day.balance);
    const min = Math.min(0, ...values);
    const max = Math.max(0, ...values);
    const range = Math.max(1, max - min);
    return PLOT_TOP + ((max - 0) / range) * (CHART_HEIGHT - PLOT_TOP - PLOT_BOTTOM);
  }, [forecast]);

  const selectByX = (x: number) => {
    if (!forecast.length || width <= 0) return;
    const clamped = Math.max(0, Math.min(width, x));
    const index = forecast.length === 1 ? 0 : Math.round((clamped / width) * (forecast.length - 1));
    setSelectedIndex(Math.max(0, Math.min(forecast.length - 1, index)));
  };

  const panResponder = useMemo(
    () => PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 6 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 0.65,
      onPanResponderGrant: (event) => {
        dragStartX.current = event.nativeEvent.locationX;
      },
      onPanResponderMove: (_, gesture) => selectByX(dragStartX.current + gesture.dx),
      onPanResponderRelease: (_, gesture) => selectByX(dragStartX.current + gesture.dx),
      onPanResponderTerminationRequest: () => false
    }),
    [width, forecast.length]
  );

  if (!forecast.length) return null;

  const selected = forecast[selectedIndex] ?? forecast[forecast.length - 1];

  return (
    <View
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={[styles.wrapper, { borderColor: theme.colors.border }]}
    >
      <View pointerEvents="none" style={[styles.zeroLine, { backgroundColor: theme.colors.border, top: zeroY }]} />
      <View pointerEvents="none" style={styles.plot}>
        {points.slice(1).map((point, index) => {
          const previous = points[index];
          const dx = point.x - previous.x;
          const dy = point.y - previous.y;
          const length = Math.sqrt(dx * dx + dy * dy);
          const angle = `${Math.atan2(dy, dx) * (180 / Math.PI)}deg`;
          const midpointX = (previous.x + point.x) / 2;
          const midpointY = (previous.y + point.y) / 2;
          return (
            <View
              key={`segment-${forecast[index + 1].date}`}
              style={[styles.segment, { backgroundColor: forecast[index + 1].isNegative ? theme.colors.danger : theme.colors.primary, left: midpointX - length / 2, top: midpointY - 1, transform: [{ rotate: angle }], width: length }]}
            />
          );
        })}
        {points.map((point, index) => (
          <View key={`point-${forecast[index].date}`} style={[styles.point, { backgroundColor: forecast[index].isNegative ? theme.colors.danger : theme.colors.primary, left: point.x - 3, top: point.y - 3 }]} />
        ))}
        {points[selectedIndex] ? (
          <View
            pointerEvents="none"
            style={[
              styles.selectedGuide,
              { backgroundColor: theme.colors.primary, left: points[selectedIndex].x, top: PLOT_TOP, height: Math.max(1, CHART_HEIGHT - PLOT_TOP - PLOT_BOTTOM) }
            ]}
          />
        ) : null}
        {points[selectedIndex] ? (
          <View
            pointerEvents="none"
            style={[styles.selectedPoint, { borderColor: theme.colors.background, backgroundColor: theme.colors.primary, left: points[selectedIndex].x - 6, top: points[selectedIndex].y - 6 }]}
          />
        ) : null}
      </View>
      <Pressable {...panResponder.panHandlers} onPress={(event) => selectByX(event.nativeEvent.locationX)} style={styles.touchLayer} />
      <View pointerEvents="none" style={styles.labels}>
        <Text style={[styles.label, { color: theme.colors.textMuted }]}>{formatPaymentDate(forecast[0].date).replace(/\s*\d{4}.*/, "")}</Text>
        <Text style={[styles.label, { color: theme.colors.text, fontWeight: "700" }]}>{formatCurrency(selected.balance)}</Text>
        <Text style={[styles.label, { color: theme.colors.textMuted }]}>{formatPaymentDate(forecast[forecast.length - 1].date).replace(/\s*\d{4}.*/, "")}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { height: CHART_HEIGHT, marginTop: 8, overflow: "hidden", position: "relative" },
  plot: { bottom: PLOT_BOTTOM, left: 0, position: "absolute", right: 0, top: 0 },
  zeroLine: { height: 1, left: 0, position: "absolute", right: 0 },
  segment: { borderRadius: 2, height: 2, position: "absolute" },
  point: { borderRadius: 6, height: 6, position: "absolute", width: 6 },
  selectedGuide: { opacity: 0.35, position: "absolute", width: 1 },
  selectedPoint: { borderRadius: 8, borderWidth: 2, height: 12, position: "absolute", width: 12 },
  touchLayer: { bottom: 0, left: 0, position: "absolute", right: 0, top: 0 },
  labels: { bottom: 4, flexDirection: "row", justifyContent: "space-between", left: 0, position: "absolute", right: 0 },
  label: { fontSize: 10 }
});
