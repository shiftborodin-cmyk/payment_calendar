import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Switch, Text, View } from "react-native";

import { useAuth } from "@/features/auth/AuthContext";
import { useAppSettings } from "@/features/settings/AppSettingsContext";
import { translate, type AppLanguage } from "@/features/settings/i18n";
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
  { id: "amber", labelRu: "Янтарь", labelEn: "Amber", color: "#F2C96B" }
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
  const [openingBalance, setOpeningBalance] = useState(String(settings.openingBalance));
  const [themeMode, setThemeMode] = useState<AppThemeMode>(settings.themeMode);
  const [accentColor, setAccentColor] = useState<AppAccentColor>(settings.accentColor);

  useEffect(() => {
    setDisplayName(settings.displayName);
    setLanguage(settings.language);
    setIncludeIncome(settings.includeIncome);
    setOpeningBalance(String(settings.openingBalance));
    setThemeMode(settings.themeMode);
    setAccentColor(settings.accentColor);
  }, [settings]);

  async function handleSaveSettings() {
    setLoading(true);

    try {
      const parsedOpeningBalance = Number(openingBalance.trim().replace(",", "."));

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
      Alert.alert(translate("Готово", "Done"), translate("Настройки сохранены.", "Settings saved."));
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

  async function handleIncomeToggle(nextValue: boolean) {
    setIncludeIncome(nextValue);
    setLoading(true);

    try {
      const parsedOpeningBalance = Number(openingBalance.trim().replace(",", "."));
      await saveSettings({
        ...settings,
        includeIncome: nextValue,
        openingBalance: Number.isFinite(parsedOpeningBalance) ? parsedOpeningBalance : 0
      });
    } catch (error) {
      setIncludeIncome(settings.includeIncome);
      Alert.alert(
        translate("Ошибка", "Error"),
        error instanceof Error ? error.message : translate("Не удалось изменить настройку доходов.", "Could not update the income setting.")
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
    <ScreenContainer>
      <View style={styles.header}>
        <Text style={styles.title}>{translate("Настройки", "Settings")}</Text>
        <Text style={styles.subtitle}>{translate("Параметры приложения и аккаунта", "App and account preferences")}</Text>
      </View>

      <Card style={styles.accountCard}>
        <Text style={styles.label}>{translate("Аккаунт", "Account")}</Text>
        <Text style={styles.email}>{user?.email ?? "—"}</Text>
        <Text style={styles.accountHint}>{translate("Личные платежи будут привязаны к этому аккаунту.", "Local payments are linked to this account on this device.")}</Text>
      </Card>

      <Card style={styles.preferencesCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{translate("Профиль", "Profile")}</Text>
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
        ) : (
          <Text style={styles.displayName}>{settings.displayName.trim() || translate("Имя не указано", "Name not set")}</Text>
        )}
        <Text style={styles.hint}>{translate("Если оставить поле пустым, будет показана часть email.", "If left empty, part of your email will be shown.")}</Text>
      </Card>

      <Card style={styles.preferencesCard}>
        <View style={styles.incomeSettingRow}>
          <View style={styles.incomeSettingText}>
            <Text style={styles.sectionTitle}>{translate("Учитывать доходы", "Track income")}</Text>
            <Text style={styles.hint}>{translate("Добавляет доходы и подготовит расчёт доступных денег.", "Adds income and prepares available-money forecasting.")}</Text>
          </View>
          <Switch
            disabled={loading}
            onValueChange={(nextValue) => void handleIncomeToggle(nextValue)}
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
              onChangeText={setOpeningBalance}
              placeholder="0"
              value={openingBalance}
            />
            <Text style={styles.hint}>{translate("Переключатель применяется сразу. Остаток сохранится кнопкой ниже.", "The switch applies immediately. Save the opening balance with the button below.")}</Text>
          </>
        ) : null}
      </Card>

      <Card style={styles.preferencesCard}>
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
        <AppButton loading={loading} onPress={handleSaveSettings} title={translate("Сохранить настройки", "Save settings")} />
      </Card>

      <Card style={styles.preferencesCard}>
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
        <Text style={styles.hint}>{translate("Светлая тема мягкая, без чисто белого фона.", "The light theme is soft, without a pure white background.")}</Text>

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
        <AppButton loading={loading} onPress={handleSaveSettings} title={translate("Сохранить тему", "Save theme")} />
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

      <AppButton loading={loading} onPress={handleSignOut} title={translate("Выйти", "Sign out")} variant="secondary" />
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
  },
  preferencesCard: {
    gap: theme.spacing.sm
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
    gap: theme.spacing.md,
    justifyContent: "space-between"
  },
  incomeSettingText: {
    flex: 1,
    gap: theme.spacing.xs
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
    gap: theme.spacing.sm
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
