import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider, useAuth } from "@/features/auth/AuthContext";
import { AppSettingsProvider, useAppSettings } from "@/features/settings/AppSettingsContext";
import { LoadingScreen } from "@/shared/ui/LoadingScreen";
import { createAppTheme, ThemeProvider } from "@/shared/theme/theme";

function RootLayoutNav() {
  const { session, isLoading } = useAuth();
  const { settings, isLoading: isSettingsLoading } = useAppSettings();
  const segments = useSegments();
  const router = useRouter();
  const theme = createAppTheme(settings.themeMode, settings.accentColor);

  useEffect(() => {
    if (isLoading || isSettingsLoading) {
      return;
    }

    const inAuthGroup = segments[0] === "(auth)";

    if (!session && !inAuthGroup) {
      router.replace("/(auth)/login");
      return;
    }

    if (session && inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [isLoading, isSettingsLoading, router, segments, session]);

  if (isLoading || isSettingsLoading) {
    return <LoadingScreen />;
  }

  return (
    <ThemeProvider value={theme}>
      <StatusBar style={settings.themeMode === "light" ? "dark" : "light"} />
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: theme.colors.background },
          headerShown: false
        }}
      >
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="add-payment" />
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AppSettingsProvider>
          <RootLayoutNav />
        </AppSettingsProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
