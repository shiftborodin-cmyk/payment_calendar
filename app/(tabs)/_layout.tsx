import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import type { ComponentProps } from "react";
import type { ColorValue } from "react-native";

import { translate } from "@/features/settings/i18n";
import { theme } from "@/shared/theme/theme";

type TabIconName = ComponentProps<typeof Ionicons>["name"];

function tabIcon(name: TabIconName) {
  return ({ color, size }: { color: ColorValue; size: number }) => (
    <Ionicons name={name} size={size} color={color} />
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      initialRouteName="index"
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: theme.colors.background },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 8,
          paddingTop: 8
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "500"
        },
        tabBarItemStyle: {
          borderRadius: theme.radius.md
        }
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: translate("Главная", "Home"),
          tabBarIcon: tabIcon("home-outline")
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: translate("Календарь", "Calendar"),
          tabBarIcon: tabIcon("calendar-outline")
        }}
      />
      <Tabs.Screen
        name="list"
        options={{
          title: translate("Список", "List"),
          tabBarIcon: tabIcon("list-outline")
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: translate("Настройки", "Settings"),
          tabBarIcon: tabIcon("settings-outline")
        }}
      />
    </Tabs>
  );
}
