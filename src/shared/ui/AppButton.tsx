import { ActivityIndicator, Pressable, StyleSheet, Text, type PressableProps } from "react-native";

import { theme } from "@/shared/theme/theme";

type AppButtonProps = PressableProps & {
  title: string;
  loading?: boolean;
  variant?: "primary" | "secondary";
};

export function AppButton({
  title,
  loading = false,
  variant = "primary",
  disabled,
  ...props
}: AppButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        variant === "secondary" ? styles.buttonSecondary : styles.buttonPrimary,
        pressed && !isDisabled && styles.buttonPressed,
        isDisabled && styles.buttonDisabled
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={variant === "secondary" ? theme.colors.text : theme.colors.background} />
      ) : (
        <Text style={[styles.title, variant === "secondary" && styles.titleSecondary]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    borderRadius: theme.radius.md,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: theme.spacing.md
  },
  buttonPrimary: {
    backgroundColor: theme.colors.primary
  },
  buttonSecondary: {
    backgroundColor: theme.colors.primarySoft,
    borderColor: theme.colors.border,
    borderWidth: 1
  },
  buttonPressed: {
    opacity: 0.85
  },
  buttonDisabled: {
    opacity: 0.55
  },
  title: {
    color: theme.colors.background,
    fontSize: 16,
    fontWeight: "600"
  },
  titleSecondary: {
    color: theme.colors.text
  }
});
