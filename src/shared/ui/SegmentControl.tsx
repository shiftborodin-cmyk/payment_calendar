import { Pressable, StyleSheet, Text, View } from "react-native";

import { useTheme, type AppTheme } from "@/shared/theme/theme";

type SegmentOption<T extends string> = {
  id: T;
  label: string;
};

type SegmentControlProps<T extends string> = {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
};

export function SegmentControl<T extends string>({
  options,
  value,
  onChange
}: SegmentControlProps<T>) {
  const theme = useTheme();
  const styles = createStyles(theme);

  return (
    <View style={styles.container}>
      {options.map((option) => {
        const isActive = option.id === value;

        return (
          <Pressable
            key={option.id}
            onPress={() => onChange(option.id)}
            style={[styles.segment, isActive && styles.segmentActive]}
          >
            <Text style={[styles.label, isActive && styles.labelActive]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
  container: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    flexDirection: "row",
    padding: theme.spacing.xs
  },
  segment: {
    alignItems: "center",
    borderRadius: theme.radius.sm,
    flex: 1,
    paddingVertical: theme.spacing.sm
  },
  segmentActive: {
    backgroundColor: theme.colors.primarySoft
  },
  label: {
    color: theme.colors.textMuted,
    fontSize: 14,
    fontWeight: "500"
  },
  labelActive: {
    color: theme.colors.primary,
    fontWeight: "600"
  }
  });
}
