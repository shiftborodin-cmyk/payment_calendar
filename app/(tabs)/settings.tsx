import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/features/auth/AuthContext";
import { AppButton } from "@/shared/ui/AppButton";
import { Card } from "@/shared/ui/Card";
import { ScreenContainer } from "@/shared/ui/ScreenContainer";
import { SettingsMenuItem } from "@/shared/ui/SettingsMenuItem";
import { theme } from "@/shared/theme/theme";

export default function SettingsScreen() {
  const { user, signOut } = useAuth();
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    setLoading(true);
    await signOut();
    setLoading(false);
  }

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Text style={styles.title}>Настройки</Text>
        <Text style={styles.subtitle}>Параметры приложения и аккаунта</Text>
      </View>

      <Card style={styles.accountCard}>
        <Text style={styles.label}>Аккаунт</Text>
        <Text style={styles.email}>{user?.email ?? "—"}</Text>
        <Text style={styles.accountHint}>Личные платежи будут привязаны к этому аккаунту.</Text>
      </Card>

      <View style={styles.menu}>
        <SettingsMenuItem icon="grid-outline" subtitle="Управление категориями появится позже" title="Категории" />
        <SettingsMenuItem
          icon="notifications-outline"
          subtitle="Напоминания о платежах"
          title="Уведомления"
        />
        <SettingsMenuItem icon="color-palette-outline" subtitle="Тёмная тема" title="Тема" />
      </View>

      <AppButton loading={loading} onPress={handleSignOut} title="Выйти" variant="secondary" />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.sm
  },
  title: {
    color: theme.colors.text,
    fontSize: 26,
    fontWeight: "700"
  },
  subtitle: {
    color: theme.colors.textMuted,
    fontSize: 15
  },
  accountCard: {
    gap: theme.spacing.xs
  },
  label: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: "500"
  },
  email: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: "600"
  },
  accountHint: {
    color: theme.colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: theme.spacing.xs
  },
  menu: {
    gap: theme.spacing.sm
  }
});
