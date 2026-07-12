import { createContext, useContext } from "react";

export type AppThemeMode = "dark" | "light";
export type AppAccentColor = "white" | "green" | "blue" | "mint" | "amber" | "violet" | "coral";

type ThemeColors = {
  background: string;
  surface: string;
  surfaceElevated: string;
  primary: string;
  primarySoft: string;
  text: string;
  textMuted: string;
  border: string;
  danger: string;
  warning: string;
};

export type AppTheme = {
  mode: AppThemeMode;
  accent: AppAccentColor;
  colors: ThemeColors;
  radius: {
    sm: number;
    md: number;
    lg: number;
  };
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
  };
};

const accentColors: Record<AppAccentColor, string> = {
  white: "#F2F7F4",
  green: "#36D987",
  blue: "#7BA7FF",
  mint: "#7CE7C9",
  amber: "#F2C96B",
  violet: "#B59BFF",
  coral: "#FF8FA3"
};

const darkBase: Omit<ThemeColors, "primary" | "primarySoft"> = {
  background: "#0B1410",
  surface: "#111D17",
  surfaceElevated: "#17261E",
  text: "#F2F7F4",
  textMuted: "#9BAAA2",
  border: "#24352C",
  danger: "#FF7A7A",
  warning: "#F2C94C"
};

const lightBase: Omit<ThemeColors, "primary" | "primarySoft"> = {
  background: "#E9EDE9",
  surface: "#DDE3DE",
  surfaceElevated: "#E4E9E5",
  text: "#152019",
  textMuted: "#68776E",
  border: "#D1DAD2",
  danger: "#C85050",
  warning: "#A87918"
};

function getPrimarySoft(mode: AppThemeMode, accent: AppAccentColor) {
  if (mode === "dark") {
    return accent === "white" ? "#29332E" : `${accentColors[accent]}26`;
  }

  return accent === "white" ? "#D3DAD4" : `${accentColors[accent]}30`;
}

export function createAppTheme(mode: AppThemeMode, accent: AppAccentColor): AppTheme {
  const base = mode === "light" ? lightBase : darkBase;
  const primary = mode === "light" && accent === "white" ? "#56635B" : accentColors[accent];

  return {
    mode,
    accent,
    colors: {
      ...base,
      primary,
      primarySoft: getPrimarySoft(mode, accent)
    },
    radius: {
      sm: 8,
      md: 12,
      lg: 16
    },
    spacing: {
      xs: 4,
      sm: 8,
      md: 16,
      lg: 24,
      xl: 32
    }
  };
}

export const theme = createAppTheme("dark", "white");

const ThemeContext = createContext<AppTheme>(theme);

export const ThemeProvider = ThemeContext.Provider;

export function useTheme() {
  return useContext(ThemeContext);
}
