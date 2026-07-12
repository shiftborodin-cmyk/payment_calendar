import { StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";

import { useTheme, type AppTheme } from "@/shared/theme/theme";

type AppTextInputProps = TextInputProps & {
  label: string;
};

export function AppTextInput({ label, style, ...props }: AppTextInputProps) {
  const theme = useTheme();
  const styles = createStyles(theme);

  return (
    <View style={styles.field}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={theme.colors.textMuted}
        style={[styles.input, style]}
        {...props}
      />
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
  field: {
    gap: theme.spacing.xs
  },
  label: {
    color: theme.colors.textMuted,
    fontSize: 14,
    fontWeight: "500"
  },
  input: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    color: theme.colors.text,
    fontSize: 16,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm + 4
  }
  });
}
