import { StyleSheet, Text, View } from "react-native";

import { Card } from "@/shared/ui/Card";
import { useTheme, type AppTheme } from "@/shared/theme/theme";

type PaymentPlaceholderCardProps = {
  index: number;
};

export function PaymentPlaceholderCard({ index }: PaymentPlaceholderCardProps) {
  const theme = useTheme();
  const styles = createStyles(theme);

  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <View style={[styles.iconStub, index % 2 === 0 && styles.iconStubAlt]} />
        <View style={styles.content}>
          <View style={styles.linePrimary} />
          <View style={styles.lineSecondary} />
        </View>
        <View style={styles.amountStub} />
      </View>
    </Card>
  );
}

export function EmptyStateText({ children }: { children: string }) {
  const theme = useTheme();
  const styles = createStyles(theme);

  return <Text style={styles.emptyText}>{children}</Text>;
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
  card: {
    opacity: 0.7,
    padding: theme.spacing.md
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.md
  },
  iconStub: {
    backgroundColor: theme.colors.primarySoft,
    borderRadius: theme.radius.sm,
    height: 44,
    width: 44
  },
  iconStubAlt: {
    backgroundColor: theme.colors.surface
  },
  content: {
    flex: 1,
    gap: theme.spacing.sm
  },
  linePrimary: {
    backgroundColor: theme.colors.border,
    borderRadius: 4,
    height: 12,
    width: "70%"
  },
  lineSecondary: {
    backgroundColor: theme.colors.border,
    borderRadius: 4,
    height: 10,
    opacity: 0.6,
    width: "45%"
  },
  amountStub: {
    backgroundColor: theme.colors.border,
    borderRadius: 4,
    height: 14,
    width: 48
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontSize: 15,
    lineHeight: 22
  }
  });
}
