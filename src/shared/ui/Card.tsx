import { StyleSheet, View, type ViewProps } from "react-native";

import { useTheme, type AppTheme } from "@/shared/theme/theme";

type CardProps = ViewProps & {
  children: React.ReactNode;
};

export function Card({ children, style, ...props }: CardProps) {
  const theme = useTheme();
  const styles = createStyles(theme);

  return (
    <View style={[styles.card, style]} {...props}>
      {children}
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surfaceElevated,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    padding: theme.spacing.md
  }
  });
}
