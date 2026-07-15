import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Switch, Text, View } from "react-native";

import { useAuth } from "@/features/auth/AuthContext";
import { useAppSettings } from "@/features/settings/AppSettingsContext";
import { translate, type AppLanguage } from "@/features/settings/i18n";
import { formatAmountInput } from "@/features/payments/paymentFormatters";
import { AppButton } from "@/shared/ui/AppButton";
import { AppTextInput } from "@/shared/ui/AppTextInput";
import { Card } from "@/shared/ui/Card";
import { ScreenContainer } from "@/shared/ui/ScreenContainer";
import { SettingsMenuItem } from "@/shared/ui/SettingsMenuItem";
import { useTheme, type AppAccentColor, type AppTheme, type AppThemeMode } from "@/shared/theme/theme";

const accentOptions: Array<{ id: AppAccentColor; labelRu: string; labelEn: string; color: string }> = [
  { id: "white", labelRu: "Белый", labelEn: "White", color: "#F2F7F4" },
  { id: "green", labelRu: "Зелёный", labelEn: "Green", color: "#36D987" },
  { id: "blue", labelRu: "Синий", labelEn: "Blue", color: "#7BA7FF" },
  { id: "mint", labelRu: "Мята", labelEn: "Mint", color: "#7CE7C9" },
  { id: "amber", labelRu: "Янтарь", labelEn: "Amber", color: "#F2C96B" },
  { id: "violet", labelRu: "Фиолетовый", labelEn: "Violet", color: "#B59BFF" },
  { id: "coral", labelRu: "Коралловый", labelEn: "Coral", color: "#FF8FA3" }
];

export default function SettingsScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { settings, saveSettings } = useAppSettings();
  const theme = useTheme();
  const styles = createStyles(theme);
  const [loading, setLoading] = useState(false);
  const [displayName, setDisplayName] = useState(settings.displayName);
  const [editingName, setEditingName] = useState(false);
  const [language, setLanguage] = useState<AppLanguage>(settings.language);
  const [includeIncome, setIncludeIncome] = useState(settings.includeIncome);
  const [openingBalance, setOpeningBalance] = useState(formatAmountInput(String(settings.openingBalance)));
  const [themeMode, setThemeMode] = useState<AppThemeMode>(settings.themeMode);
  const [accentColor, setAccentColor] = useState<AppAccentColor>(settings.accentColor);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  useEffect(() => {
    setDisplayName(settings.displayName);
    setLanguage(settings.language);
    setIncludeIncome(settings.includeIncome);
    setOpeningBalance(formatAmountInput(String(settings.openingBalance)));
    setThemeMode(settings.themeMode);
    setAccentColor(settings.accentColor);
  }, [settings]);

  useEffect(() => {
    if (!savedMessage) return;
    const timeout = setTimeout(() => setSavedMessage(null), 2200);
    return () => clearTimeout(timeout);
  }, [savedMessage]);

  async function handleSaveSettings() {
    setLoading(true);

    try {
      const parsedOpeningBalance = Number(openingBalance.trim().replace(/\./g, "").replace(",", "."));

      if (includeIncome && !Number.isFinite(parsedOpeningBalance)) {
        Alert.alert(translate("Ошибка", "Error"), translate("Введите начальный остаток числом.", "Enter the opening balance as a number."));
        return;
      }

      await saveSettings({
        ...settings,
        language,
        includeIncome,
        openingBalance: includeIncome ? parsedOpeningBalance : settings.openingBalance,
        themeMode,
        accentColor
      });
      setSavedMessage(translate("Настройки сохранены", "Settings saved"));
    } catch (error) {
      Alert.alert(
        translate("Ошибка", "Error"),
        error instanceof Error ? error.message : translate("Не удалось сохранить настройки.", "Could not save settings.")
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveName() {
    setLoading(true);

    try {
      await saveSettings({ ...settings, displayName: displayName.trim() });
      setEditingName(false);
    } catch (error) {
      Alert.alert(
        translate("Ошибка", "Error"),
        error instanceof Error ? error.message : translate("Не удалось сохранить имя.", "Could not save the name.")
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSignOut() {
    setLoading(true);
    try {
      await signOut();
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScreenContainer contentStyle={styles.screenContent}>
      {savedMessage ? (
        <View style={styles.savedToast}>
          <Ionicons color={theme.colors.text} name="checkmark-circle-outline" size={18} />
          <Text style={styles.savedToastText}>{savedMessage}</Text>
        </View>
      ) : null}

      <Card style={styles.preferencesCard}>
        <View style={styles.sectionHeader}>
          <View style={styles.profileIdentity}>
            <View style={styles.profileIcon}>
              <Ionicons color={theme.colors.primary} name="person-outline" size={20} />
            </View>
            <View style={styles.profileText}>
              <Text style={styles.sectionTitle}>{settings.displayName.trim() || translate("Профиль", "Profile")}</Text>
              <Text numberOfLines={1} style={styles.email}>{user?.email ?? "—"}</Text>
            </View>
          </View>
          {!editingName ? (
            <Pressable
              accessibilityLabel={translate("Редактировать имя", "Edit name")}
              onPress={() => setEditingName(true)}
              style={styles.editNameButton}
            >
              <Ionicons color={theme.colors.primary} name="pencil-outline" size={18} />
            </Pressable>
          ) : null}
        </View>
        {editingName ? (
          <>
            <AppTextInput
              label={translate("Имя на Главной", "Name on Home")}
              onChangeText={setDisplayName}
              placeholder={translate("Например, Евгений", "For example, Eugene")}
              value={displayName}
            />
            <View style={styles.nameActions}>
              <AppButton loading={loading} onPress={handleSaveName} title={translate("Сохранить", "Save")} />
              <AppButton
                onPress={() => {
                  setDisplayName(settings.displayName);
                  setEditingName(false);
                }}
                title={translate("Отмена", "Cancel")}
                variant="secondary"
              />
            </View>
          </>
        ) : null}
      </Card>

      <Card style={[styles.preferencesCard, styles.incomePreferencesCard]}>
        <View style={styles.incomeSettingRow}>
          <View style={styles.incomeSettingText}>
            <Text style={styles.sectionTitle}>{translate("Учитывать доходы", "Track income")}</Text>
          </View>
          <Switch
            disabled={loading}
            onValueChange={setIncludeIncome}
            thumbColor={includeIncome ? theme.colors.primary : theme.colors.textMuted}
            trackColor={{ false: theme.colors.surface, true: theme.colors.primarySoft }}
            value={includeIncome}
          />
        </View>
        {includeIncome ? (
          <>
            <AppTextInput
              keyboardType="decimal-pad"
              label={translate("Остаток на начало месяца", "Opening balance")}
              onChangeText={(value) => setOpeningBalance(formatAmountInput(value))}
              placeholder="0"
              value={openingBalance}
            />
          </>
        ) : null}
        <View style={styles.settingsDivider} />
        <Text style={styles.sectionTitle}>{translate("Язык", "Language")}</Text>
        <View style={styles.choiceRow}>
          {[
            { id: "ru" as const, label: "Русский" },
            { id: "en" as const, label: "English" }
          ].map((option) => (
            <Pressable
              key={option.id}
              onPress={() => setLanguage(option.id)}
              style={[styles.choice, language === option.id && styles.choiceActive]}
            >
              <Text style={[styles.choiceText, language === option.id && styles.choiceTextActive]}>{option.label}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.settingsDivider} />
        <Text style={styles.sectionTitle}>{translate("Тема", "Theme")}</Text>
        <View style={styles.choiceRow}>
          {[
            { id: "dark" as const, label: translate("Тёмная", "Dark") },
            { id: "light" as const, label: translate("Светлая", "Light") }
          ].map((option) => (
            <Pressable
              key={option.id}
              onPress={() => setThemeMode(option.id)}
              style={[styles.choice, themeMode === option.id && styles.choiceActive]}
            >
              <Text style={[styles.choiceText, themeMode === option.id && styles.choiceTextActive]}>{option.label}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.label}>{translate("Акцентный цвет", "Accent color")}</Text>
        <View style={styles.accentRow}>
          {accentOptions.map((option) => (
            <Pressable
              accessibilityLabel={translate(option.labelRu, option.labelEn)}
              key={option.id}
              onPress={() => setAccentColor(option.id)}
              style={[
                styles.accentChoice,
                { backgroundColor: option.color },
                accentColor === option.id && styles.accentChoiceActive
              ]}
            >
              {accentColor === option.id ? (
                <Ionicons color={option.id === "white" ? "#152019" : "#0B1410"} name="checkmark" size={17} />
              ) : null}
            </Pressable>
          ))}
        </View>
        <AppButton loading={loading} onPress={handleSaveSettings} title={translate("Сохранить настройки", "Save settings")} />
      </Card>

      <View style={styles.menu}>
        <SettingsMenuItem
          icon="grid-outline"
          onPress={() => router.push("/categories")}
          subtitle={translate("Локальные категории платежей", "Local payment categories")}
          title={translate("Категории", "Categories")}
        />
        <SettingsMenuItem
          badge={translate("Скоро", "Soon")}
          disabled
          icon="notifications-outline"
          subtitle={translate("Напоминания о платежах", "Payment reminders")}
          title={translate("Уведомления", "Notifications")}
        />
      </View>

      <AppButton icon="log-out-outline" loading={loading} onPress={handleSignOut} title={translate("Выйти", "Sign out")} variant="danger" />
    </ScreenContainer>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
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
  menu: {
    gap: theme.spacing.md
  },
  preferencesCard: {
    gap: 12,
    padding: 10
  },
  incomePreferencesCard: {
    gap: 12,
    paddingBottom: 10,
    paddingTop: 10
  },
  screenContent: {
    paddingBottom: 132
  },
  settingsDivider: {
    backgroundColor: theme.colors.border,
    height: 1,
    marginVertical: 0
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 17,
    fontWeight: "700"
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  profileIdentity: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: theme.spacing.sm
  },
  profileIcon: {
    alignItems: "center",
    backgroundColor: theme.colors.primarySoft,
    borderRadius: 20,
    height: 40,
    justifyContent: "center",
    width: 40
  },
  profileText: {
    flex: 1,
    gap: 2
  },
  savedToast: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10
  },
  savedToastText: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: "700"
  },
  editNameButton: {
    alignItems: "center",
    backgroundColor: theme.colors.primarySoft,
    borderRadius: 18,
    height: 36,
    justifyContent: "center",
    width: 36
  },
  displayName: {
    color: theme.colors.text,
    fontSize: 17,
    fontWeight: "600"
  },
  nameActions: {
    gap: theme.spacing.sm
  },
  incomeSettingRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.sm,
    justifyContent: "space-between",
    marginBottom: -4,
    marginTop: -4
  },
  incomeSettingText: {
    flex: 1,
    gap: 0
  },
  hint: {
    color: theme.colors.textMuted,
    fontSize: 13,
    lineHeight: 18
  },
  choiceRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm
  },
  choice: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    minHeight: 38,
    justifyContent: "center",
    paddingHorizontal: theme.spacing.md
  },
  choiceActive: {
    backgroundColor: theme.colors.primarySoft,
    borderColor: theme.colors.primary
  },
  choiceText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: "700"
  },
  choiceTextActive: {
    color: theme.colors.primary
  },
  accentRow: {
    flexDirection: "row",
    justifyContent: "space-between"
  },
  accentChoice: {
    alignItems: "center",
    borderColor: theme.colors.border,
    borderRadius: 18,
    borderWidth: 1,
    height: 36,
    justifyContent: "center",
    width: 36
  },
  accentChoiceActive: {
    borderColor: theme.colors.text,
    borderWidth: 2
  }
  });
}
