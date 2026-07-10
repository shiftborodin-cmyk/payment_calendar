import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider, useAuth } from "@/features/auth/AuthContext";
import { AppSettingsProvider, useAppSettings } from "@/features/settings/AppSettingsContext";
import { LoadingScreen } from "@/shared/ui/LoadingScreen";
import { theme } from "@/shared/theme/theme";

function RootLayoutNav() {
  const { session, isLoading } = useAuth();
  const { isLoading: isSettingsLoading } = useAppSettings();
  const segments = useSegments();
  const router = useRouter();

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
    <>
      <StatusBar style="light" />
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
    </>
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
