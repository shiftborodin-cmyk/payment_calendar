import { useMemo, useRef, useState } from "react";
import { PanResponder, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line, Path } from "react-native-svg";

import type { DailyBalanceForecast } from "@/features/payments/paymentForecast";
import { formatCurrencyValue, formatPaymentDate } from "@/features/payments/paymentFormatters";
import { useTheme } from "@/shared/theme/theme";

const CHART_HEIGHT = 122;
const PLOT_TOP = 12;
const PLOT_BOTTOM = 24;

function shortDate(date: string) {
  return formatPaymentDate(date).replace(/\s*\d{4}.*/, "");
}

export function InteractiveForecastChart({ forecast }: { forecast: DailyBalanceForecast[] }) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(forecast.length ? forecast.length - 1 : 0);
  const dragStartX = useRef(0);

  const activeIndex = Math.min(selectedIndex, Math.max(0, forecast.length - 1));
  const plotBottom = CHART_HEIGHT - PLOT_BOTTOM;

  const points = useMemo(() => {
    if (!forecast.length || width <= 0) return [];

    const values = forecast.map((day) => day.balance);
    const min = Math.min(0, ...values);
    const max = Math.max(0, ...values);
    const range = Math.max(1, max - min);
    const plotWidth = Math.max(1, width - 4);
    const plotHeight = plotBottom - PLOT_TOP;

    return forecast.map((day, index) => ({
      x: forecast.length === 1 ? width / 2 : 2 + (index / (forecast.length - 1)) * plotWidth,
      y: PLOT_TOP + ((max - day.balance) / range) * plotHeight
    }));
  }, [forecast, plotBottom, width]);

  const linePath = useMemo(() => {
    if (!points.length) return "";
    if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

    let path = `M ${points[0].x} ${points[0].y}`;
    for (let index = 1; index < points.length; index += 1) {
      const previous = points[index - 1];
      const current = points[index];
      const midpoint = (previous.x + current.x) / 2;
      path += ` C ${midpoint} ${previous.y}, ${midpoint} ${current.y}, ${current.x} ${current.y}`;
    }
    return path;
  }, [points]);

  const areaPath = points.length
    ? `${linePath} L ${points[points.length - 1].x} ${plotBottom} L ${points[0].x} ${plotBottom} Z`
    : "";

  const selectByX = (x: number) => {
    if (!forecast.length || width <= 0) return;
    const clamped = Math.max(0, Math.min(width, x));
    const index = forecast.length === 1 ? 0 : Math.round((clamped / width) * (forecast.length - 1));
    setSelectedIndex(Math.max(0, Math.min(forecast.length - 1, index)));
  };

  const panResponder = useMemo(
    () => PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (event) => {
        dragStartX.current = event.nativeEvent.locationX;
        selectByX(event.nativeEvent.locationX);
      },
      onPanResponderMove: (_, gesture) => selectByX(dragStartX.current + gesture.dx),
      onPanResponderRelease: (_, gesture) => selectByX(dragStartX.current + gesture.dx),
      onPanResponderTerminationRequest: () => false
    }),
    [width, forecast.length]
  );

  if (!forecast.length) return null;

  const selected = forecast[activeIndex] ?? forecast[forecast.length - 1];
  const selectedPoint = points[activeIndex];

  return (
    <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={styles.wrapper}>
      {width > 0 ? (
        <Svg height={CHART_HEIGHT} pointerEvents="none" width={width}>
          <Line stroke={theme.colors.border} strokeWidth="1" x1="0" x2={width} y1={plotBottom} y2={plotBottom} />
          <Path d={areaPath} fill={theme.colors.primary} fillOpacity={0.08} />
          <Path d={linePath} fill="none" stroke={theme.colors.primary} strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
          {selectedPoint ? (
            <Line
              stroke={theme.colors.primary}
              strokeOpacity="0.48"
              strokeWidth="1"
              x1={selectedPoint.x}
              x2={selectedPoint.x}
              y1={selectedPoint.y + 8}
              y2={plotBottom}
            />
          ) : null}
          {selectedPoint ? (
            <Circle cx={selectedPoint.x} cy={selectedPoint.y} fill={theme.colors.primary} r="6" stroke={theme.colors.background} strokeWidth="3" />
          ) : null}
        </Svg>
      ) : null}
      <View {...panResponder.panHandlers} style={styles.touchLayer} />
      <View pointerEvents="none" style={styles.labels}>
        <Text style={[styles.label, { color: theme.colors.textMuted }]}>{shortDate(forecast[0].date)}</Text>
        <Text style={[styles.label, { color: theme.colors.text, fontWeight: "700" }]}>{shortDate(selected.date)}</Text>
        <Text style={[styles.label, { color: theme.colors.textMuted }]}>{shortDate(forecast[forecast.length - 1].date)}</Text>
      </View>
      {selectedPoint ? (
        <View pointerEvents="none" style={[styles.valueBubble, { backgroundColor: theme.colors.surfaceElevated, borderColor: theme.colors.border, left: Math.max(4, Math.min(width - 96, selectedPoint.x - 48)), top: Math.max(0, selectedPoint.y - 28) }]}>
          <Text style={[styles.valueText, { color: theme.colors.text }]}>{formatCurrencyValue(selected.balance)}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { height: CHART_HEIGHT, marginTop: 6, position: "relative" },
  touchLayer: { bottom: 0, left: 0, position: "absolute", right: 0, top: 0 },
  labels: { bottom: 2, flexDirection: "row", justifyContent: "space-between", left: 0, position: "absolute", right: 0 },
  label: { fontSize: 10 },
  valueBubble: { borderRadius: 6, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 3, position: "absolute" },
  valueText: { fontSize: 10, fontWeight: "700" }
});
