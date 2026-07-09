import { Stack } from "expo-router";

import { theme } from "@/shared/theme/theme";

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: theme.colors.background },
        headerShown: false
      }}
    />
  );
}
