import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { useAuth } from "@/features/auth/AuthContext";
import { setCurrentLanguage, type AppLanguage } from "@/features/settings/i18n";
import type { AppAccentColor, AppThemeMode } from "@/shared/theme/theme";

export type AppSettings = {
  displayName: string;
  language: AppLanguage;
  includeIncome: boolean;
  openingBalance: number;
  themeMode: AppThemeMode;
  accentColor: AppAccentColor;
};

type AppSettingsContextValue = {
  settings: AppSettings;
  isLoading: boolean;
  saveSettings: (nextSettings: AppSettings) => Promise<void>;
};

const defaultSettings: AppSettings = {
  displayName: "",
  language: "ru",
  includeIncome: false,
  openingBalance: 0,
  themeMode: "dark",
  accentColor: "white"
};

const AppSettingsContext = createContext<AppSettingsContextValue | null>(null);

function getStorageKey(userId: string) {
  return `payment_app_settings:${userId}`;
}

function normalizeSettings(value: unknown): AppSettings {
  if (!value || typeof value !== "object") {
    return defaultSettings;
  }

  const candidate = value as Partial<AppSettings>;
  return {
    displayName: typeof candidate.displayName === "string" ? candidate.displayName : "",
    language: candidate.language === "en" ? "en" : "ru",
    includeIncome: candidate.includeIncome === true,
    openingBalance:
      typeof candidate.openingBalance === "number" && Number.isFinite(candidate.openingBalance)
        ? candidate.openingBalance
        : 0,
    themeMode: candidate.themeMode === "light" ? "light" : "dark",
    accentColor:
      candidate.accentColor === "green" ||
      candidate.accentColor === "blue" ||
      candidate.accentColor === "mint" ||
      candidate.accentColor === "amber" ||
      candidate.accentColor === "violet" ||
      candidate.accentColor === "coral"
        ? candidate.accentColor
        : "white"
  };
}

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);

  setCurrentLanguage(settings.language);

  useEffect(() => {
    let isActive = true;

    async function loadSettings() {
      if (isAuthLoading) {
        return;
      }

      if (!user) {
        setSettings(defaultSettings);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      try {
        const rawValue = await AsyncStorage.getItem(getStorageKey(user.id));
        const nextSettings = rawValue ? normalizeSettings(JSON.parse(rawValue)) : defaultSettings;

        if (isActive) {
          setSettings(nextSettings);
        }
      } catch {
        if (isActive) {
          setSettings(defaultSettings);
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    loadSettings();

    return () => {
      isActive = false;
    };
  }, [isAuthLoading, user]);

  const value = useMemo<AppSettingsContextValue>(
    () => ({
      settings,
      isLoading,
      async saveSettings(nextSettings) {
        if (!user) {
          throw new Error("Нужно войти в аккаунт.");
        }

        const normalized = normalizeSettings(nextSettings);
        await AsyncStorage.setItem(getStorageKey(user.id), JSON.stringify(normalized));
        setSettings(normalized);
      }
    }),
    [isLoading, settings, user]
  );

  return <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>;
}

export function useAppSettings() {
  const context = useContext(AppSettingsContext);

  if (!context) {
    throw new Error("useAppSettings must be used within AppSettingsProvider");
  }

  return context;
}
