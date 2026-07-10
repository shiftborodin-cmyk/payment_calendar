import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type PressableProps } from "react-native";

import { useTheme, type AppTheme } from "@/shared/theme/theme";

type AppButtonProps = PressableProps & {
  title: string;
  loading?: boolean;
  variant?: "primary" | "secondary";
  icon?: keyof typeof Ionicons.glyphMap;
};

export function AppButton({
  title,
  loading = false,
  variant = "primary",
  icon,
  disabled,
  ...props
}: AppButtonProps) {
  const isDisabled = disabled || loading;
  const theme = useTheme();
  const styles = createStyles(theme);

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
        <View style={styles.content}>
          {icon ? (
            <Ionicons
              color={variant === "secondary" ? theme.colors.text : theme.colors.background}
              name={icon}
              size={19}
            />
          ) : null}
          <Text style={[styles.title, variant === "secondary" && styles.titleSecondary]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
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
  content: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.sm
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
}
