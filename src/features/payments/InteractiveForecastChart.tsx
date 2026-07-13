import { useMemo, useState } from "react";
import { PanResponder, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";

import { getCurrentLocale, translate } from "@/features/settings/i18n";
import { formatPaymentDate } from "@/features/payments/paymentFormatters";
import { useTheme, type AppTheme } from "@/shared/theme/theme";
import type { DailyBalanceForecast } from "@/features/payments/paymentForecast";

type InteractiveForecastChartProps = {
  forecast: DailyBalanceForecast[];
};

const CHART_HEIGHT = 178;
const PLOT_TOP = 22;
const PLOT_BOTTOM = 28;
const MIN_DRAG_DISTANCE = 6;

export function InteractiveForecastChart({ forecast }: InteractiveForecastChartProps) {
  const theme = useTheme();
  const styles = createStyles(theme);
  const [width, setWidth] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const points = useMemo(() => {
    if (forecast.length === 0 || width <= 0) {
      return [];
    }

    const balances = forecast.map((day) => day.balance);
    const minBalance = Math.min(0, ...balances);
    const maxBalance = Math.max(0, ...balances);
    const range = Math.max(1, maxBalance - minBalance);
    const plotHeight = CHART_HEIGHT - PLOT_TOP - PLOT_BOTTOM;
    const denominator = Math.max(1, forecast.length - 1);

    return forecast.map((day, index) => ({
      day,
      x: (index / denominator) * width,
      y: PLOT_TOP + ((maxBalance - day.balance) / range) * plotHeight
    }));
  }, [forecast, width]);

  const selectByX = (x: number) => {
    if (forecast.length === 0 || width <= 0) {
      return;
    }

    const denominator = Math.max(1, forecast.length - 1);
    const nextIndex = Math.max(0, Math.min(forecast.length - 1, Math.round((x / width) * denominator)));
    setSelectedIndex(nextIndex);
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dx) > MIN_DRAG_DISTANCE && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 0.7,
        onPanResponderMove: (event) => selectByX(event.nativeEvent.locationX),
        onPanResponderRelease: (event) => selectByX(event.nativeEvent.locationX),
        onPanResponderTerminate: (event) => selectByX(event.nativeEvent.locationX)
      }),
    [forecast.length, width]
  );

  const selectedPoint = points[selectedIndex] ?? points[0] ?? null;

  const handleLayout = (event: LayoutChangeEvent) => {
    const nextWidth = event.nativeEvent.layout.width;
    if (nextWidth > 0 && nextWidth !== width) {
      setWidth(nextWidth);
    }
  };

  if (forecast.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>{translate("Добавьте платежи, чтобы увидеть прогноз.", "Add payments to see the forecast.")}</Text>
      </View>
    );
  }

  return (
    <View onLayout={handleLayout} style={styles.wrapper}>
      <View style={styles.chart}>
        <View style={[styles.gridLine, { top: PLOT_TOP }]} />
        <View style={[styles.gridLine, { top: CHART_HEIGHT / 2 }]} />
        <View style={[styles.gridLine, { top: CHART_HEIGHT - PLOT_BOTTOM }]} />

        {points.slice(1).map((point, index) => {
          const previous = points[index];
          const dx = point.x - previous.x;
          const dy = point.y - previous.y;
          const length = Math.sqrt(dx * dx + dy * dy);
          const angle = `${Math.atan2(dy, dx) * (180 / Math.PI)}deg`;

          return (
            <View
              key={`segment-${point.day.date}`}
              style={[
                styles.segment,
                {
                  backgroundColor: point.day.isNegative || previous.day.isNegative ? theme.colors.danger : theme.colors.primary,
                  left: (previous.x + point.x) / 2 - length / 2,
                  top: (previous.y + point.y) / 2 - 1,
                  transform: [{ rotate: angle }],
                  width: length
                }
              ]}
            />
          );
        })}

        {points.map((point) => (
          <View
            key={`point-${point.day.date}`}
            style={[
              styles.point,
              {
                backgroundColor: point.day.isNegative ? theme.colors.danger : theme.colors.primary,
                left: point.x - 3,
                top: point.y - 3
              }
            ]}
          />
        ))}

        {selectedPoint ? (
          <>
            <View style={[styles.marker, { left: selectedPoint.x }]} />
            <View
              style={[
                styles.tooltip,
                { left: Math.max(0, Math.min(width - 148, selectedPoint.x - 74)) }
              ]}
            >
              <Text style={styles.tooltipDate}>{formatPaymentDate(selectedPoint.day.date)}</Text>
              <Text style={[styles.tooltipValue, selectedPoint.day.isNegative && styles.tooltipNegative]}>
                {formatCurrency(selectedPoint.day.balance)}
              </Text>
              <Text style={styles.tooltipCaption}>{translate("прогнозируемый остаток", "projected balance")}</Text>
            </View>
          </>
        ) : null}

        <Pressable
          {...panResponder.panHandlers}
          onPress={(event) => selectByX(event.nativeEvent.locationX)}
          style={styles.touchLayer}
        />
      </View>

      <View style={styles.axisRow}>
        <Text style={styles.axisLabel}>{formatAxisDate(forecast[0].date)}</Text>
        <Text style={styles.axisLabel}>{formatAxisDate(forecast[Math.floor(forecast.length / 2)].date)}</Text>
        <Text style={styles.axisLabel}>{formatAxisDate(forecast[forecast.length - 1].date)}</Text>
      </View>
    </View>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat(getCurrentLocale(), {
    currency: "RUB",
    maximumFractionDigits: 0,
    style: "currency"
  }).format(value);
}

function formatAxisDate(date: string) {
  return formatPaymentDate(date).replace(/\s+\d{4}\s*г\.?$/, "");
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    axisLabel: {
      color: theme.colors.textMuted,
      fontSize: 10
    },
    axisRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingHorizontal: 2
    },
    chart: {
      height: CHART_HEIGHT,
      overflow: "hidden",
      position: "relative"
    },
    empty: {
      alignItems: "center",
      minHeight: 90,
      justifyContent: "center"
    },
    emptyText: {
      color: theme.colors.textMuted,
      fontSize: 13,
      textAlign: "center"
    },
    gridLine: {
      backgroundColor: theme.colors.border,
      height: 1,
      left: 0,
      opacity: 0.75,
      position: "absolute",
      right: 0
    },
    marker: {
      backgroundColor: theme.colors.text,
      bottom: PLOT_BOTTOM,
      position: "absolute",
      top: PLOT_TOP,
      width: 1
    },
    point: {
      borderColor: theme.colors.surfaceElevated,
      borderRadius: 4,
      borderWidth: 1.5,
      height: 7,
      position: "absolute",
      width: 7,
      zIndex: 3
    },
    segment: {
      borderRadius: 2,
      height: 2,
      position: "absolute",
      zIndex: 1
    },
    tooltip: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.sm,
      borderWidth: 1,
      paddingHorizontal: 9,
      paddingVertical: 6,
      position: "absolute",
      top: 0,
      width: 148,
      zIndex: 5
    },
    tooltipCaption: {
      color: theme.colors.textMuted,
      fontSize: 10,
      marginTop: 1
    },
    tooltipDate: {
      color: theme.colors.textMuted,
      fontSize: 11,
      fontWeight: "600"
    },
    tooltipNegative: {
      color: theme.colors.danger
    },
    tooltipValue: {
      color: theme.colors.text,
      fontSize: 15,
      fontWeight: "800",
      marginTop: 1
    },
    touchLayer: {
      bottom: 0,
      left: 0,
      position: "absolute",
      right: 0,
      top: 0,
      zIndex: 10
    },
    wrapper: {
      gap: 3
    }
  });
}
